import jsPDF from "jspdf";
import { calculateLabelLayout, resolveItemAtSlot } from "./layoutMath";
import QRCode from "qrcode";

/**
 * PDF Generation Worker
 */
const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (e) => {
    const { config, imageItems, appMode, textConfig } = e.data;

    try {
        // 1. Calculate Layout
        const layout = calculateLabelLayout(config);
        if (layout.error) {
            throw new Error(layout.error);
        }

        // 2. Load all images (only if in image mode)
        const loadedImages = appMode === 'image' ? await Promise.all(imageItems.map(async (item: { buffer: ArrayBuffer; type: string; id: string }, idx: number) => {
            // Report progress for loading (0% - 30%)
            ctx.postMessage({ type: 'progress', data: Math.round(((idx + 1) / imageItems.length) * 30) });

            const arrayBuffer = item.buffer;
            const blob = new Blob([arrayBuffer], { type: item.type });
            const bitmap = await createImageBitmap(blob);

            let format: "PNG" | "JPEG" = "PNG";
            if (item.type === "image/jpeg" || item.type === "image/jpg") {
                format = "JPEG";
            }

            const uint8Array = new Uint8Array(arrayBuffer);

            return {
                ...item,
                data: uint8Array,
                format,
                width: bitmap.width,
                height: bitmap.height
            };
        })) : [];

        // 3. Create PDF
        const pdf = new jsPDF({
            orientation: config.orientation,
            unit: "mm",
            format: [layout.pageWidth, layout.pageHeight],
        });

        // 4. Calculate total labels
        const totalCount = appMode === 'image'
            ? imageItems.reduce((acc: number, item: { count: number }) => acc + item.count, 0)
            : textConfig.count;

        const slotsPerPage = layout.positions.length;
        const totalPages = Math.ceil(totalCount / slotsPerPage);

        // 5. Draw Content
        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            if (pageIdx > 0) {
                pdf.addPage();
            }

            const startSlotIdx = pageIdx * slotsPerPage;

            for (let localIdx = 0; localIdx < layout.positions.length; localIdx++) {
                const pos = layout.positions[localIdx];
                const globalIdx = startSlotIdx + localIdx;
                if (globalIdx >= totalCount) continue;

                // Report progress (30% to 90%)
                if (globalIdx % 5 === 0) {
                    ctx.postMessage({ type: 'progress', data: 30 + Math.round((globalIdx / totalCount) * 60) });
                }

                if (appMode === 'image') {
                    const img = resolveItemAtSlot(globalIdx, loadedImages);
                    if (!img) continue;

                    const scale = Math.min(pos.width / img.width, pos.height / img.height);
                    const w = img.width * scale;
                    const h = img.height * scale;
                    const x = pos.x + (pos.width - w) / 2;
                    const y = pos.y + (pos.height - h) / 2;

                    pdf.addImage(img.data, img.format, x, y, w, h, undefined, 'FAST');
                } else {
                    // 文本模式 (可选带二维码)
                    const currentNumber = textConfig.startNumber + globalIdx;
                    const formattedNumber = String(currentNumber).padStart(textConfig.digits, '0');
                    const text = `${textConfig.prefix}${formattedNumber}`;

                    if (textConfig.showQrCode) {
                        // 二维码内容
                        const qrValue = `${textConfig.qrContentPrefix}${text}`;

                        // 生成二维码图片数据
                        // 使用 toDataURL，qrcode 库在 OffscreenCanvas 模式下表现良好
                        try {
                            const qrDataUrl = await QRCode.toDataURL(qrValue, {
                                margin: 1,
                                errorCorrectionLevel: 'M',
                                width: 256 // 足够清晰的像素大小
                            });

                            // 布局计算：二维码在上方，文字在下方
                            // 二维码尺寸由 qrSizeRatio 决定，取 (宽, 高) 的最小值
                            const qrDim = Math.min(pos.width, pos.height) * textConfig.qrSizeRatio;
                            const qrX = pos.x + (pos.width - qrDim) / 2;
                            const qrY = pos.y + pos.height * 0.1; // 上留白 10%

                            pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrDim, qrDim);

                            // 绘制下方文字
                            pdf.setFont("courier", "bold");
                            // 字号自动计算：占剩余空间的 80%
                            const targetTextHeight = pos.height * 0.2;
                            const fontSizePt = Math.min(
                                (pos.width * 0.9 / (text.length * 0.6)) / 0.3527,
                                targetTextHeight / 0.3527
                            );
                            pdf.setFontSize(fontSizePt);
                            const textWidth = pdf.getStringUnitWidth(text) * fontSizePt * 0.3527;
                            pdf.text(
                                text,
                                pos.x + (pos.width - textWidth) / 2,
                                qrY + qrDim + (pos.height - (qrY - pos.y) - qrDim + fontSizePt * 0.3527) / 2,
                                { align: "left" }
                            );
                        } catch (qrErr) {
                            console.error("QR Generation failed", qrErr);
                            // 降级只画文字
                        }
                    } else {
                        // 仅文字模式
                        pdf.setFont("courier", "bold");
                        const fontSizePt = Math.min(
                            (pos.width * 0.8 / (text.length * 0.6)) / 0.3527,
                            (pos.height * 0.5) / 0.3527
                        );
                        pdf.setFontSize(fontSizePt);
                        const textWidth = pdf.getStringUnitWidth(text) * fontSizePt * 0.3527;
                        const textHeight = fontSizePt * 0.3527;
                        pdf.text(
                            text,
                            pos.x + (pos.width - textWidth) / 2,
                            pos.y + (pos.height + textHeight / 2) / 2,
                            { align: "left" }
                        );
                    }
                }
            }
        }

        ctx.postMessage({ type: 'progress', data: 95 });

        // 5. Generate Output
        const output = pdf.output('arraybuffer');
        ctx.postMessage({ type: 'complete', data: output }, [output]);

    } catch (error) {
        ctx.postMessage({ type: 'error', data: (error as Error).message });
    }
};
