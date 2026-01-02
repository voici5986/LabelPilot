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
    const imgProps = await getImageProperties(imageData);

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
        // addImage(imageData, format, x, y, w, h)
        pdf.addImage(
            imageData,
            imgProps.format,
            pos.x,
            pos.y,
            pos.width,
            pos.height,
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
 * Helper to get image format (JPEG/PNG) and validity
 */
function getImageProperties(dataUrl: string): Promise<{ format: string }> {
    return new Promise((resolve) => {
        // Simple check based on data header
        if (dataUrl.startsWith("data:image/png")) {
            resolve({ format: "PNG" });
        } else if (dataUrl.startsWith("data:image/jpeg")) {
            resolve({ format: "JPEG" });
        } else {
            resolve({ format: "PNG" }); // Fallback or handle error
        }
    });
}
