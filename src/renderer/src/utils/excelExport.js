import * as XLSX from 'xlsx';

/**
 * Export a dataset to an Excel workbook
 * @param {Array<Object>} data The array of objects representing rows
 * @param {string} sheetName Name of the sheet tab
 * @param {string} fileName Default filename for the output excel file
 */
export function exportToExcel(data, sheetName = 'Sheet1', fileName = 'export.xlsx') {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Auto-fit column widths
    const maxCols = data.reduce((acc, row) => Math.max(acc, Object.keys(row).length), 0);
    const wscols = [];
    for (let i = 0; i < maxCols; i++) {
      wscols.push({ wch: 18 }); // Set default width for columns
    }
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    XLSX.writeFile(workbook, fileName);
    return { success: true };
  } catch (error) {
    console.error("Excel export failed:", error);
    return { error: error.message };
  }
}
