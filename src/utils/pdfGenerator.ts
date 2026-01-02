import jsPDF from "jspdf";
import { calculateLabelLayout } from "./layoutMath";
import type { HelperLayoutConfig } from "./layoutMath";

export async function generatePDF(config: HelperLayoutConfig, imageFile: File): Promise<void> {
    // 1. Calculate Layout
    const layout = calculateLabelLayout(config);
    if (layout.error) {
        throw new Error(layout.error);
    }

    // 2. Load Image to get format/data
    const imageData = await fileToDataURL(imageFile);
    const { format, width: imgWidth, height: imgHeight } = await getImageProperties(imageData);

    // 3. Create PDF
    // jsPDF default unit is mm, which matches our calculation
    const pdf = new jsPDF({
        orientation: config.orientation,
        unit: "mm",
        format: "a4",
    });

    // 4. Draw Images
    // We use the positions from our layout math
    layout.positions.forEach(pos => {
        // Calculate aspect ratio fit (Contain)
        const scale = Math.min(pos.width / imgWidth, pos.height / imgHeight);

        const w = imgWidth * scale; // Rendered width
        const h = imgHeight * scale; // Rendered height

        // Center the image in the slot
        const x = pos.x + (pos.width - w) / 2;
        const y = pos.y + (pos.height - h) / 2;

        pdf.addImage(
            imageData,
            format,
            x,
            y,
            w,
            h,
            undefined,
            'FAST' // Compression
        );
    });

    // 5. Save
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, ""); // YYYYMMDDHHMMSS
    pdf.save(`label_${dateStr}.pdf`);
}

/**
 * Helper to convert File to Base64 DataURL
 */
function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Helper to get image format (JPEG/PNG) and dimensions
 */
function getImageProperties(dataUrl: string): Promise<{ format: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let format = "PNG";
            if (dataUrl.startsWith("data:image/jpeg")) {
                format = "JPEG";
            }
            resolve({
                format,
                width: img.width,
                height: img.height
            });
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}
