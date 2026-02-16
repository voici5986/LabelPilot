/**
 * Utility for formatting values.
 */

/**
 * Formats a date for use in filenames: YYMMDD_hhmm
 */
export function formatDateForFilename(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    const YY = String(date.getFullYear()).slice(-2);
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());

    return `${YY}${MM}${DD}_${hh}${mm}`;
}
