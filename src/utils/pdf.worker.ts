import jsPDF from "jspdf";
import { calculateLabelLayout, resolveItemAtSlot } from "./layoutMath";

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

            // Buffer is already transferred from main thread
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

        // 4. Calculate total labels to draw across all pages
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
            
            layout.positions.forEach((pos: { x: number; y: number; width: number; height: number }, localIdx: number) => {
                const globalIdx = startSlotIdx + localIdx;
                if (globalIdx >= totalCount) return;

                // Report progress (30% to 90%)
                if (globalIdx % 5 === 0) {
                    ctx.postMessage({ type: 'progress', data: 30 + Math.round((globalIdx / totalCount) * 60) });
                }

                if (appMode === 'image') {
                    const img = resolveItemAtSlot(globalIdx, loadedImages);
                    if (!img) return;

                    const scale = Math.min(pos.width / img.width, pos.height / img.height);
                    const w = img.width * scale;
                    const h = img.height * scale;
                    const x = pos.x + (pos.width - w) / 2;
                    const y = pos.y + (pos.height - h) / 2;

                    pdf.addImage(
                        img.data,
                        img.format,
                        x,
                        y,
                        w,
                        h,
                        undefined,
                        'FAST'
                    );
                } else {
                    // 文本模式
                    const currentNumber = textConfig.startNumber + globalIdx;
                    const formattedNumber = String(currentNumber).padStart(textConfig.digits, '0');
                    const text = `${textConfig.prefix}${formattedNumber}`;
                    
                    // 计算字号：根据标签宽度和文字长度估算
                    const charCount = text.length;
                    // 粗略估算：1pt ≈ 0.35mm，jsPDF 默认字号是 16pt ≈ 5.6mm
                    // 我们希望文字宽度占标签宽度的 80%，高度占 50%
                    const targetWidthMm = pos.width * 0.8;
                    const targetHeightMm = pos.height * 0.5;
                    
                    // jsPDF 中，字符串宽度的计算比较复杂，这里用比例简单处理
                    // 假设每个字符平均宽度是高度的 0.6 倍 (对于 Maple Mono 这种等宽字体)
                    const fontSizePt = Math.min(
                        (targetWidthMm / (charCount * 0.6)) / 0.3527,
                        targetHeightMm / 0.3527
                    );

                    pdf.setFont("courier", "bold"); // 默认使用等宽字体
                    pdf.setFontSize(fontSizePt);
                    pdf.setTextColor(0, 0, 0);
                    
                    // 居中写入
                    const textWidth = pdf.getStringUnitWidth(text) * fontSizePt * 0.3527;
                    const textHeight = fontSizePt * 0.3527;
                    
                    pdf.text(
                        text, 
                        pos.x + (pos.width - textWidth) / 2, 
                        pos.y + (pos.height + textHeight / 2) / 2, // 垂直基线居中
                        { align: "left" }
                    );
                }
            });
        }

        ctx.postMessage({ type: 'progress', data: 95 });

        // 5. Generate Output
        const output = pdf.output('arraybuffer');
        ctx.postMessage({ type: 'complete', data: output }, [output]);

    } catch (error) {
        ctx.postMessage({ type: 'error', data: (error as Error).message });
    }
};
