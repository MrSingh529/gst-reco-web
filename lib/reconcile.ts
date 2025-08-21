import * as XLSX from 'xlsx'

export const EPS_DEFAULT = 10 // ₹10 tolerance

const COLS = {
  gstin: 'GSTIN of Supplier',
  trade: 'Trade Name',
  date:  'Invoice Date',
  inv:   'Invoice Number',
  inv_val: 'Invoice Value',
  igst:  'Integrated Tax (IGST)',
  cgst:  'Central Tax (CGST)',
  sgst:  'State Tax (SGST)',
  taxable: 'Taxable Value',
} as const

export type RawRow = Record<string, unknown>

export interface CleanRow {
  GSTIN_clean: string
  INV_clean: string
  TRADE_clean: string
  inv_val: number
  igst: number
  cgst: number
  sgst: number
  taxable: number
}

function asString(v: unknown): string {
  return String(v ?? '')
}
function cleanGSTIN(s: unknown): string {
  return asString(s).trim().toUpperCase()
}
function cleanInv(s: unknown): string {
  let v = asString(s).toUpperCase().trim()
  v = v.replace(/[\s\-]/g, '')
  v = v.replace(/\\/g, '/')
  v = v.replace(/^0+([1-9])/, '$1')
  return v
}
function cleanTrade(s: unknown): string {
  return asString(s).toUpperCase().trim().replace(/\s+/g, ' ')
}
function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const n = parseFloat(asString(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function clamp(diff: number, eps: number): number {
  return Math.abs(diff) <= eps ? 0 : diff
}

export function sheetToRows(ws: XLSX.WorkSheet): RawRow[] {
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as RawRow[]
}

export function normalize(rows: RawRow[]): { clean: CleanRow[]; tradeByGSTIN: Map<string,string> } {
  const clean: CleanRow[] = []
  const tradeCounts = new Map<string, Map<string, number>>()

  for (const r of rows) {
    const gstin = cleanGSTIN((r as Record<string, unknown>)[COLS.gstin])
    const inv   = cleanInv((r as Record<string, unknown>)[COLS.inv])
    const trade = cleanTrade((r as Record<string, unknown>)[COLS.trade])
    const row: CleanRow = {
      GSTIN_clean: gstin,
      INV_clean: inv,
      TRADE_clean: trade,
      inv_val: toNum((r as Record<string, unknown>)[COLS.inv_val]),
      igst: toNum((r as Record<string, unknown>)[COLS.igst]),
      cgst: toNum((r as Record<string, unknown>)[COLS.cgst]),
      sgst: toNum((r as Record<string, unknown>)[COLS.sgst]),
      taxable: toNum((r as Record<string, unknown>)[COLS.taxable]),
    }
    clean.push(row)

    if (gstin) {
      if (!tradeCounts.has(gstin)) tradeCounts.set(gstin, new Map())
      const m = tradeCounts.get(gstin)!
      m.set(trade, (m.get(trade) || 0) + 1)
    }
  }

  const tradeByGSTIN = new Map<string,string>()
  for (const [gstin, m] of Array.from(tradeCounts.entries())) {
    let best = '', cnt = -1
    for (const [t, c] of Array.from(m.entries())) {
      if (c > cnt) {
        best = t
        cnt = c
      }
    }
    tradeByGSTIN.set(gstin, best)
  }

  return { clean, tradeByGSTIN }
}

export interface GroupedRow {
  GSTIN_clean: string
  INV_clean: string
  inv_val: number
  igst: number
  cgst: number
  sgst: number
  taxable: number
}

export function groupByGSTINInv(rows: CleanRow[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>()
  for (const r of rows) {
    const key = `${r.GSTIN_clean}|${r.INV_clean}`
    const cur = map.get(key) || { GSTIN_clean: r.GSTIN_clean, INV_clean: r.INV_clean, inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 }
    cur.inv_val += r.inv_val
    cur.igst += r.igst
    cur.cgst += r.cgst
    cur.sgst += r.sgst
    cur.taxable += r.taxable
    map.set(key, cur)
  }
  return Array.from(map.values())
}

export function totals(rows: {inv_val:number; igst:number; cgst:number; sgst:number; taxable:number;}[]) {
  return rows.reduce((a, r) => ({
    inv_val: a.inv_val + r.inv_val,
    igst: a.igst + r.igst,
    cgst: a.cgst + r.cgst,
    sgst: a.sgst + r.sgst,
    taxable: a.taxable + r.taxable,
  }), { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 })
}

// ----- Builders for each output sheet (return AOA = array of arrays) -----

export function buildZohoVsGSTR(z: GroupedRow[], g: GroupedRow[], eps: number): (string | number)[][] {
  const rightMap = new Map(g.map(r => [`${r.GSTIN_clean}|${r.INV_clean}`, r]));
  const rows: (string | number)[][] = [[
    'Invoice Number from Purchase Book',
    'Invoice Value from Purchase Book',
    'Invoice Value from GSTR-2B',
    'Difference'
  ]];
  for (const L of z) {
    const R = rightMap.get(`${L.GSTIN_clean}|${L.INV_clean}`);
    const diff = clamp(L.inv_val - (R?.inv_val || 0), eps);
    rows.push([L.INV_clean, L.inv_val, R?.inv_val || 0, diff]);
  }
  return rows;
}

export function buildGSTRVsZoho(g: GroupedRow[], z: GroupedRow[], eps: number): (string | number)[][] {
  const rightMap = new Map(z.map(r => [`${r.GSTIN_clean}|${r.INV_clean}`, r]));
  const rows: (string | number)[][] = [[
    'Invoice Number from GSTR-2B',
    'Invoice Value from GSTR-2B',
    'Invoice Value from Purchase Book',
    'Difference'
  ]];
  for (const L of g) {
    const R = rightMap.get(`${L.GSTIN_clean}|${L.INV_clean}`);
    const diff = clamp(L.inv_val - (R?.inv_val || 0), eps);
    rows.push([L.INV_clean, L.inv_val, R?.inv_val || 0, diff]);
  }
  return rows;
}

export function buildSumFunction(z: GroupedRow[], g: GroupedRow[]): (string | number)[][] {
  const tz = totals(z), tg = totals(g);
  const rows: (string | number)[][] = [[
    'Particulars', 'Invoice Value', 'Integrated Tax (IGST)', 'Central Tax (CGST)', 'State Tax (SGST)', 'Taxable Value'
  ]];
  rows.push(['GST as Per Book Data', tz.inv_val, tz.igst, tz.cgst, tz.sgst, tz.taxable]);
  rows.push(['GST as Per GSTR-2B', tg.inv_val, tg.igst, tg.cgst, tg.sgst, tg.taxable]);
  rows.push(['Difference', tz.inv_val - tg.inv_val, tz.igst - tg.igst, tz.cgst - tg.cgst, tz.sgst - tg.sgst, tz.taxable - tg.taxable]);
  return rows;
}

export function buildBillsWise(z: GroupedRow[], g: GroupedRow[], eps: number): (string | number)[][] {
  const leftMap = new Map(z.map(r => [`${r.GSTIN_clean}|${r.INV_clean}`, r]));
  const rightMap = new Map(g.map(r => [`${r.GSTIN_clean}|${r.INV_clean}`, r]));
  const keys = new Set<string>(Array.from(leftMap.keys()).concat(Array.from(rightMap.keys())));
  const rows: (string | number)[][] = [[
    'GSTIN of Supplier', 'Invoice Number',
    'Book: Invoice Value', '2B: Invoice Value', 'Diff: Invoice Value',
    'Book: Total Tax', '2B: Total Tax', 'Diff: Total Tax',
    'Book: Taxable', '2B: Taxable', 'Diff: Taxable', 'Status'
  ]];
  for (const k of Array.from(keys).sort()) {
    const L = leftMap.get(k), R = rightMap.get(k);
    const Ltot = (L?.igst || 0) + (L?.cgst || 0) + (L?.sgst || 0);
    const Rtot = (R?.igst || 0) + (R?.cgst || 0) + (R?.sgst || 0);
    const dInv = clamp((L?.inv_val || 0) - (R?.inv_val || 0), eps);
    const dTax = clamp(Ltot - Rtot, eps);
    const dTaxable = clamp((L?.taxable || 0) - (R?.taxable || 0), eps);
    let status = 'Match';
    const [gstin, inv] = k.split('|');
    if (L && !R) status = 'Missing in 2B';
    else if (!L && R) status = 'Missing in Book';
    else {
      const probs = [] as string[];
      if (dInv !== 0) probs.push('Invoice');
      if (dTax !== 0) probs.push('Tax');
      if (dTaxable !== 0) probs.push('Taxable');
      if (probs.length) status = 'Mismatch: ' + probs.join(', ');
    }
    rows.push([gstin, inv, L?.inv_val || 0, R?.inv_val || 0, dInv, Ltot, Rtot, dTax, L?.taxable || 0, R?.taxable || 0, dTaxable, status]);
  }
  return rows;
}

export function buildGSTINWise(z: GroupedRow[], g: GroupedRow[], eps: number): (string | number)[][] {
  const sumBy = (rows: GroupedRow[]) => {
    const m = new Map<string, { inv_val: number; igst: number; cgst: number; sgst: number; taxable: number }>();
    for (const r of rows) {
      const cur = m.get(r.GSTIN_clean) || { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 };
      cur.inv_val += r.inv_val; cur.igst += r.igst; cur.cgst += r.cgst; cur.sgst += r.sgst; cur.taxable += r.taxable;
      m.set(r.GSTIN_clean, cur);
    }
    return m;
  };
  const L = sumBy(z), R = sumBy(g);
  const keys = new Set<string>(Array.from(L.keys()).concat(Array.from(R.keys())));
  const rows: (string | number)[][] = [[
    'GSTIN of Supplier', 'Book: Invoice Value', '2B: Invoice Value', 'Diff: Invoice Value',
    'Book: Total Tax', '2B: Total Tax', 'Diff: Total Tax',
    'Book: Taxable', '2B: Taxable', 'Diff: Taxable', 'Status'
  ]];
  for (const gstin of Array.from(keys).sort()) {
    const a = L.get(gstin) || { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 };
    const b = R.get(gstin) || { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 };
    const atax = a.igst + a.cgst + a.sgst;
    const btax = b.igst + b.cgst + b.sgst;
    const dInv = clamp(a.inv_val - b.inv_val, eps);
    const dTax = clamp(atax - btax, eps);
    const dTaxable = clamp(a.taxable - b.taxable, eps);
    let status = 'Match';
    if (!L.has(gstin) && R.has(gstin)) status = 'Missing in Book';
    else if (L.has(gstin) && !R.has(gstin)) status = 'Missing in 2B';
    else {
      const probs = [] as string[];
      if (dInv !== 0) probs.push('Invoice');
      if (dTax !== 0) probs.push('Tax');
      if (dTaxable !== 0) probs.push('Taxable');
      if (probs.length) status = 'Mismatch: ' + probs.join(', ');
    }
    rows.push([gstin, a.inv_val, b.inv_val, dInv, atax, btax, dTax, a.taxable, b.taxable, dTaxable, status]);
  }
  return rows;
}

export function buildTradeWise(z: GroupedRow[], g: GroupedRow[], tradeByGSTIN: Map<string, string>, eps: number): (string | number)[][] {
  const roll = (rows: GroupedRow[]) => {
    const m = new Map<string, { inv_val: number; igst: number; cgst: number; sgst: number; taxable: number }>();
    for (const r of rows) {
      const trade = tradeByGSTIN.get(r.GSTIN_clean) || '';
      const cur = m.get(trade) || { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 };
      cur.inv_val += r.inv_val; cur.igst += r.igst; cur.cgst += r.cgst; cur.sgst += r.sgst; cur.taxable += r.taxable;
      m.set(trade, cur);
    }
    return m;
  };
  const L = roll(z), R = roll(g);
  const keys = new Set<string>(Array.from(L.keys()).concat(Array.from(R.keys())));
  const rows: (string | number)[][] = [[
    'Trade Name', 'Book: Invoice Value', '2B: Invoice Value', 'Diff: Invoice Value',
    'Book: Total Tax', '2B: Total Tax', 'Diff: Total Tax',
    'Book: Taxable', '2B: Taxable', 'Diff: Taxable', 'Status'
  ]];
  for (const trade of Array.from(keys).sort()) {
    const a = L.get(trade) || { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 };
    const b = R.get(trade) || { inv_val: 0, igst: 0, cgst: 0, sgst: 0, taxable: 0 };
    const atax = a.igst + a.cgst + a.sgst;
    const btax = b.igst + b.cgst + b.sgst;
    const dInv = clamp(a.inv_val - b.inv_val, eps);
    const dTax = clamp(atax - btax, eps);
    const dTaxable = clamp(a.taxable - b.taxable, eps);
    let status = 'Match';
    if (!L.has(trade) && R.has(trade)) status = 'Missing in Book';
    else if (L.has(trade) && !R.has(trade)) status = 'Missing in 2B';
    else {
      const probs = [] as string[];
      if (dInv !== 0) probs.push('Invoice');
      if (dTax !== 0) probs.push('Tax');
      if (dTaxable !== 0) probs.push('Taxable');
      if (probs.length) status = 'Mismatch: ' + probs.join(', ');
    }
    rows.push([trade, a.inv_val, b.inv_val, dInv, atax, btax, dTax, a.taxable, b.taxable, dTaxable, status]);
  }
  return rows;
}

export function buildWorkbook(aoaByName: Record<string, (string | number)[][]>) {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(aoaByName)) {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return wb
}