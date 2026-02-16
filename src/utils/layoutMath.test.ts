import { describe, it, expect } from 'vitest';
import { calculateLabelLayout, A4_WIDTH_MM, A4_HEIGHT_MM } from './layoutMath';

describe('calculateLabelLayout', () => {
    it('should calculate standard A4 3x3 layout correctly', () => {
        const config = {
            rows: 3,
            cols: 3,
            marginMm: 20,
            spacingMm: 10,
            orientation: 'portrait' as const
        };

        const result = calculateLabelLayout(config);

        // Page: 210 x 297
        // Usable: (210 - 40) = 170, (297 - 40) = 257
        // Spacing: (3-1) * 10 = 20
        // Label Width: (170 - 20) / 3 = 50
        // Label Height: (257 - 20) / 3 = 79

        expect(result.labelWidth).toBeCloseTo(50, 1);
        expect(result.labelHeight).toBeCloseTo(79, 1);
        expect(result.positions.length).toBe(9);

        // Check first label position
        expect(result.positions[0].x).toBe(20);
        expect(result.positions[0].y).toBe(20);

        // Check second label position (col index 1)
        expect(result.positions[1].x).toBe(20 + 50 + 10); // 80
    });

    it('should handle orientation switching correctly', () => {
        const config = {
            rows: 2,
            cols: 2,
            marginMm: 10,
            spacingMm: 5,
            orientation: 'landscape' as const,
            pageWidthMm: A4_WIDTH_MM,
            pageHeightMm: A4_HEIGHT_MM
        };

        const result = calculateLabelLayout(config);

        // In landscape, width is 297, height is 210
        expect(result.pageWidth).toBe(297);
        expect(result.pageHeight).toBe(210);
    });

    it('should return error when margin is too large', () => {
        const config = {
            rows: 2,
            cols: 2,
            marginMm: 150, // More than 210 / 2
            spacingMm: 5,
            orientation: 'portrait' as const
        };

        const result = calculateLabelLayout(config);
        expect(result.error).toBe('MARGIN_TOO_LARGE');
    });

    it('should calculate zero spacing correctly', () => {
        const config = {
            rows: 2,
            cols: 2,
            marginMm: 10,
            spacingMm: 0,
            orientation: 'portrait' as const
        };

        const result = calculateLabelLayout(config);
        const expectedWidth = (210 - 20) / 2;
        expect(result.labelWidth).toBe(expectedWidth);
    });
});
