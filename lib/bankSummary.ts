import * as XLSX from "xlsx";

/**
 * Builds a summary sheet with two pivot tables:
 *  - Inflow (credits) by Remark (fallback: Narration), per month
 *  - Outflow (debits) by Remark (fallback: Narration), per month
 *
 * It auto-detects the main columns from the header row:
 *   Date, Narration, Credit, Debit, Division, Remarks
 * …case-insensitively. It tolerates Excel serial dates and strings.
 */

type Cols = {
  date: number; narr: number;
  cr?: number; dr?: number;
  div?: number; rem?: number;
};

const up = (s: unknown) => String(s ?? "").toUpperCase();

function findHeaderRow(aoa: any[][]): number {
  const idx = aoa.findIndex(
    r => up(r?.[0]).startsWith("DATE") && up(r?.[1]).includes("NARRATION")
  );
  if (idx === -1) throw new Error('Could not locate header row with "Date" & "Narration".');
  return idx;
}

function indexCols(header: any[]): Cols {
    const H = header.map(h => up(String(h ?? "")));
  
    const find = (pred: (v: string) => boolean) => H.findIndex(pred);
  
    const date = find(h => h.startsWith("DATE"));                   // "Date"
    const narr = find(h => h.includes("NARRATION"));                // "Narration"
    if (date === -1 || narr === -1) throw new Error("Missing Date/Narration columns.");
  
    // Try CR/DR/CREDIT/DEBIT first, otherwise map bank-specific labels.
    let cr = find(h => /\bCR(EDIT)?\b/.test(h) || h.includes("CREDIT"));
    let dr = find(h => /\bDR(EBIT)?\b/.test(h) || h.includes("DEBIT"));
  
    if (cr === -1) cr = find(h => h.includes("DEPOSIT"));           // "Deposit Amt."
    if (dr === -1) dr = find(h => h.includes("WITHDRAWAL"));        // "Withdrawal Amt."
  
    const div = find(h => h === "DIVISION");
    const rem = find(h => h === "REMARKS");
  
    return {
      date, narr,
      cr: cr === -1 ? undefined : cr,
      dr: dr === -1 ? undefined : dr,
      div: div === -1 ? undefined : div,
      rem: rem === -1 ? undefined : rem,
    };
  }  

function excelSerialToDate(n: number): Date | null {
  // 25569 = days between 1899-12-30 and 1970-01-01 (Excel’s epoch handling)
  if (!isFinite(n)) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function coerceDate(v: any): Date | null {
    if (v == null || v === "") return null;
  
    // Excel serial
    if (typeof v === "number") return excelSerialToDate(v);
  
    const s = String(v).trim();
  
    // DD/MM/YY or DD/MM/YYYY (and also with '-' separators)
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      let yyyy = Number(m[3]);
      if (yyyy < 100) yyyy += 2000;     // assume 20xx for 2-digit years
      const d = new Date(yyyy, mm, dd);
      return isNaN(d.getTime()) ? null : d;
    }
  
    // fallback (ISO etc.)
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

function monthKey(d: Date): string {
  // e.g., "Apr-24"
  const MMM = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  const yy = (d.getFullYear() % 100).toString().padStart(2, "0");
  return `${MMM}-${yy}`;
}

type Acc = {
  months: string[];                 // ordered month labels
  map: Map<string, Map<string, number>>; // key -> (month -> amt)
  totals: Map<string, number>;      // key -> total
  grand: number;                    // sum of totals
};

function accumulate(
    rows: any[][],
    startRow: number,
    cols: Cols,
    kind: "CR" | "DR"
  ): Acc {
    const monthsSet = new Set<string>();
    const map = new Map<string, Map<string, number>>();
    const totals = new Map<string, number>();
    let grand = 0;
  
    // remarks to exclude from summary math
    const EXCLUDED_REMARKS = new Set(["INTERBANK"]);
  
    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
  
      const d = coerceDate(row[cols.date]);
      if (!d) continue;
      const mKey = monthKey(d);
      monthsSet.add(mKey);
  
      const narr = String(row[cols.narr] ?? "").trim();
      const remark = cols.rem != null ? String(row[cols.rem] ?? "").trim() : "";
      const remarkUC = remark.toUpperCase();
  
      // ⬇️ Skip excluded remarks (e.g., Interbank)
      if (remark && EXCLUDED_REMARKS.has(remarkUC)) continue;
  
      const key = remark || narr || "(Unlabeled)";
  
      // amount
      const cr = cols.cr != null ? Number(String(row[cols.cr]).replace(/,/g, "")) : 0;
      const dr = cols.dr != null ? Number(String(row[cols.dr]).replace(/,/g, "")) : 0;
  
      const amt = kind === "CR" ? (isFinite(cr) ? cr : 0) : (isFinite(dr) ? dr : 0);
      if (!amt) continue;
  
      if (!map.has(key)) map.set(key, new Map());
      const m = map.get(key)!;
      m.set(mKey, (m.get(mKey) ?? 0) + amt);
  
      totals.set(key, (totals.get(key) ?? 0) + amt);
      grand += amt;
    }
  
    // order months chronologically
    const months = Array.from(monthsSet.values()).sort((a, b) => {
      const [ma, ya] = a.split("-");
      const [mb, yb] = b.split("-");
      const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const da = new Date(2000 + Number(ya), M.indexOf(ma), 1).getTime();
      const db = new Date(2000 + Number(yb), M.indexOf(mb), 1).getTime();
      return da - db;
    });
  
    return { months, map, totals, grand };
  }  

function buildTable(title: string, acc: Acc): any[][] {
  const header = [title, ...acc.months, "Total", "% Contributions"];
  const keys = Array.from(acc.totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const rows: any[][] = [header];

  for (const k of keys) {
    const monthVals = acc.months.map(m => acc.map.get(k)?.get(m) ?? 0);
    const total = monthVals.reduce((s, x) => s + x, 0);
    const pct = acc.grand ? total / acc.grand : 0;
    rows.push([k, ...monthVals, total, pct]);
  }

  // Total row
  const colTotals = acc.months.map(m =>
    Array.from(acc.map.values()).reduce((s, mm) => s + (mm.get(m) ?? 0), 0)
  );
  const totalOfTotals = colTotals.reduce((s, x) => s + x, 0);
  rows.push(["Total", ...colTotals, totalOfTotals, 1]);

  // number formats (optional – safe to skip; shown here for better UX)
  // We'll add a minimal !ref, formats can be left to Excel’s auto-formatting.

  return rows;
}

export function buildSummarySheet(ws: XLSX.WorkSheet): XLSX.WorkSheet {
  const aoa = XLSX.utils.sheet_to_json<any[]>({ ...ws }, { header: 1, raw: true });
  if (!aoa.length) return XLSX.utils.aoa_to_sheet([["Summary"],["(empty)"]]);
  const hdrIdx = findHeaderRow(aoa);
  const cols = indexCols(aoa[hdrIdx]);

  const accCR = accumulate(aoa, hdrIdx + 1, cols, "CR");
  const accDR = accumulate(aoa, hdrIdx + 1, cols, "DR");

  const inflow = buildTable("Inflow", accCR);
  const outflow = buildTable("Outflow", accDR);

  // Space two blank rows between the two tables
  const sheetAOA: any[][] = [
    ...inflow,
    [],
    [],
    ...outflow,
  ];

  const wsOut = XLSX.utils.aoa_to_sheet(sheetAOA);

  // set column widths a bit wider
  (wsOut["!cols"] ||= []);
  wsOut["!cols"][0] = { wch: 40 };

  return wsOut;
}