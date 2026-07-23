/**
 * Excel export helper for the KPIs dashboard -- every chart/stat section
 * has its own "Export to Excel" button pulling the exact underlying rows
 * for the currently selected period, per the approved mockup.
 */

import * as XLSX from "xlsx";

export type SheetSpec = { name: string; rows: Record<string, string | number>[] };

export function downloadSheets(filename: string, sheets: SheetSpec[]): void {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
  });
  XLSX.writeFile(wb, filename);
}
