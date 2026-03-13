/* assets/js/fetching.js */
// Centralized logic for Google Sheets fetching

export const SHEET_ID = '1D1eDZ89Jd71SyHQNX2fns8CoQlcCUrqAMprwjaOisCs';

/**
 * Fetches data from a specific Google Sheet tab and returns it as JSON.
 * @param {string} tabName - The name of the sheet tab.
 * @returns {Promise<Array>} - The rows of the sheet.
 */
export async function fetchSheetData(tabName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${tabName}`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        const jsonStr = text.substring(text.indexOf("({") + 1, text.lastIndexOf("})") + 1);
        const data = JSON.parse(jsonStr);
        return data.table.rows;
    } catch (error) {
        console.error(`Error fetching sheet ${tabName}:`, error);
        throw error;
    }
}

/**
 * Helper to get value from a cell safely
 */
export function getCellValue(row, index, defaultValue = '') {
    return (row && row.c && row.c[index] && row.c[index].v !== null) ? row.c[index].v : defaultValue;
}

/**
 * Helper to get formatted value from a cell safely
 */
export function getCellFormattedValue(row, index, defaultValue = '') {
    return (row && row.c && row.c[index] && row.c[index].f !== null) ? row.c[index].f : getCellValue(row, index, defaultValue);
}
