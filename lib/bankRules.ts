// lib/bankRules.ts
export type Div = 'TSG' | 'CSD' | 'ITSS' | 'Common' | '';
export type Rule = {
  test: RegExp | ((raw: string) => boolean);
  division?: Div | ((raw: string, m?: RegExpMatchArray) => Div);
  remark?: string | ((raw: string) => string | undefined);
};

// tiny helper
const rx = (s: string | RegExp) => (typeof s === 'string' ? new RegExp(s, 'i') : s);
const R = (test: string | RegExp, division?: Rule['division'], remark?: Rule['remark']): Rule =>
  ({ test: rx(test), division, remark });

/** ---------- HIGH-PRIORITY, most specific first ---------- */
export const PRIORITY_RULES: Rule[] = [
  {
    test: /BONSAI ENTERPRISES PVT LTD/i,
    division: 'TSG',
    remark: (raw: string) => {
      const isDebit = /\bDR\b/i.test(raw);
      const isCredit = /\bCR\b/i.test(raw);
      if (isDebit) return 'Vendor';
      if (isCredit) return 'Bonsai';
      return 'Bonsai'; // fallback
    }
  },

  {
    test: /DD ISSUE.*TN CIRCLE/i,
    division: 'TSG',
    remark: 'EMD'
  },

  // USD amounts above 1000
  {
    test: (raw: string) => {
      const usdMatch = raw.match(/USD(\d+(?:\.\d{1,2})?)@/i);
      if (!usdMatch) return false;
      const amount = parseFloat(usdMatch[1]);
      return amount > 1000;
    },
    division: 'TSG',
    remark: 'YTL'
  },

  // Strings starting with 4200
  {
    test: /^4200/,
    division: 'TSG',
    remark: 'Reliance'
  },

  // DD Issue with BSNL - should come before generic DD ISSUE rule
  {
    test: /DD ISSUE.*BSNL/i,
    division: 'TSG',
    remark: 'EMD'
  },
  
  // Named entities / vendors
  R('NATIONAL INFORMATICS CENTRE SERVICE', 'ITSS', 'NICSI'),
  R('BHARTI HEXACOM', 'TSG', 'Bharti'),
  R('BEETEL TELETECH', 'TSG', 'Bharti'),
  R('ZTE', 'TSG', 'ZTE'),
  R('BHARAT SANCHAR NIGAM', 'TSG', 'BSNL'),
  R('VODAFONE IDEA', 'TSG', 'Vodafone'),
  R('INDUS TOWERS', 'TSG', 'Indus'),
  R('BHARTI AIRTEL', 'TSG', 'Bharti'),
  R('MANTARAV', 'ITSS', 'Mantrav'),
  R('LARSEN AND TOUBRO', 'TSG', 'L&T'),
  R('KIRAN MALIK', 'TSG', 'Rent'),
  R('NEERU CHHABRA', 'Common', 'Rent'),
  R(/SAMSUNG INDIA ELECTRONICS (PVT|PRIVATE)/, 'CSD', 'Samsung'),
  R('SAMSUNG BHIWANI', 'CSD', 'Samsung Bhiwani'),
  R('ADISOFT', 'TSG', 'Adisoft'),
  R('SOHAM ENTERPRISES', 'TSG', 'Vendor'),
  R('MC CANCELLED', 'Common', 'EMD'),
  R('BONSAI ENTERPRISES PVT LTD', 'TSG', 'Vendor'),
  R('VARDHMAN PLASTIC', 'Common', 'Vendor'),
  R('ESIC', 'Common', 'ESIC'),
  R('VERTIV ENERGY PRIVATE LIMITED', 'TSG', 'Vertiv'),
  R('INDOFAST SWAP ENERGY PRIVATE LIMITED', 'TSG', 'Indofast'),
  R('DD/MC CANCELLATION', 'TSG', 'Bank Charges'),
  R('BILLDKUPPOWER CORPLTD', 'Common', 'Electricity'),
  R('EPFO', 'Common', 'EPFO'),
  R('ACME DIGITEK SOLUTIONS PRIVATE', 'ITSS', 'Digitek'),
  R('04850330000355', 'TSG', 'ATC'),
  R('RV SOLUTIONS PRIVATE LIMITED-RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('RV SOLUTIONS PVT LTD-RV SOLUTIONS PVT LTD', 'Common', 'Interbank'),
  R('HARMAN INTERNATIONAL \\(INDIA\\)', 'CSD', 'Harman'),
  R('REALME MOBILE TELECO', 'CSD', 'Realme'),
  R('SINGH CORPORATION', 'TSG', 'Singh Corp'),
  R('CLN ENERGY LIMITED', 'TSG', 'CLN'),
  R('BHARATSANCHARNIGAM', 'TSG', 'BSNL'),
  R('STL NETWORKS', 'TSG', 'STL'),
  R('DMI HOUSING FINANCE', 'ITSS', 'DMI'),
  R('DAIKIN AIRCONDITIONING INDIA', 'TSG', 'Daikin'),
  R('UVASKA', 'TSG', 'Uvaska'),
  R('RV SOLUTIONS PRIVATE LIMITED-R V SOLUTIONS PVT LTD', 'Common', 'Interbank'),
  R('RV SOLUTIONS PRIVATE LIMITED-RV SOLUTIONS PVT LTD', 'Common', 'Interbank'),
  R(/\bSALARY\s+ITC\b/i, 'ITSS', 'Manpower'),
  R('TOYOTAFINANCIALSERVI','Common','Loan'),
  R(/VENDOR\s+PAYMENT\s+CSD/i, 'CSD', 'Vendor payment'),
  R(/VENDOR\s+PAYMENT\s+ITC?/i, 'ITSS', 'Vendor payment'),
  R(/VENDOR\s+PAYMENT\s+COM/i, 'Common', 'Vendor payment'),
  R(/FT\s*-\s*SALARY\s+ADV\s+IT\b/i, 'ITSS', 'Salary Adv'),
  R(/\bSALARY\s+IT\b/i, 'ITSS', 'Salary'),
  R('GST/BANK', '', 'GST'),
  R('CBDT/BANK', 'Common', 'TDS'),
  R('DD ISSUE', '', 'EMD'),
  R('TRAVELS COM', 'Common', 'Imprest'),
  R('ESCROW', 'CSD', 'ESC'),
  R('CMS INFO SYSTEMS LIMITED', 'CSD', 'CMS'),
  R('LIFELONG', 'CSD', 'Lifelong'),
  R('RV 786 TO 7600-RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('CUSHMAN AND WAKEFIELD PROPERTY', 'CSD', 'Cushman'),
  R('50200064467600 - RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('ONSITE ELECTRO', 'CSD', 'Onsite'),
  R('RVS TO VS LOAN', 'Common', 'VS Loan'),
  R('INFO TECH CORPORATION OF GOA LIMITED', 'ITSS', 'ITG GOA'),
  R('DADAR HOUSEKEEPING', 'CSD', 'Vendor'),
  R('DADAR TEA EXPENSE', 'CSD', 'Vendor'),
  R('DADAR WATER EXPENS', 'CSD', 'Vendor'),
  R('AMAZON SELLER', 'CSD', 'Amazon'),
  R('HDFC 786 TO 7600-RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('TRANSFER TO 7600-RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('TPT-TRF-RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('HDFC1P-442145XXXXXX9300', 'TSG', 'CREDIT Card'),
  R('HDFC1P-442145XXXXXX8914', 'TSG', 'CREDIT Card'),
  R('QDIGI SERVICES LIMITED', 'CSD', 'Qdigi'),
  R('NIBIT INTERNATIONAL PRIVATE', 'CSD', 'Nibit'),
  R('BHIWANI TEA VENDOR', 'CSD', 'Vendor'),
  R('LENOVO (INDIA) PVT LTD', 'CSD', 'Lenovo'),
  R('IMAGINE MARKETING LIMITED', 'CSD', 'Boat'),
  R('SERVICE CHARGES', '', 'Bank Charges'),
  R('UPI SETTLEMENT', 'CSD', 'ESC'),
  R('NASHIK TEA EXPENSE', 'CSD', 'Vendor'),
  R('NASHIK HOUSE KEEPI', 'CSD', 'Vendor'),
  R('HDFC1P-442145XXXXXX7123', 'Common', 'CREDIT Card'),
  R('PSAV GLOBAL TECH PRIVATE LIMITED', 'CSD', 'Honor'),
  R('AHMEDABAD HOUSE KE', 'CSD', 'Vendor'),
  R('SONIPAT-NETBANK', 'CSD', 'Samsung Sonipat'),
  R('CANDES TECHNOLOGY PRIVATE LIMITED', 'CSD', 'Candes'),
  R('REIM', '', 'Reimbursement'),
  R('GUARANTEE ISSUED', '', 'Bank Guarantee'),
  R('INS_LOMB_BBG', 'Common', 'Insurance'),
  R('18972560000575 - RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('GUARANTEE AMENDMENT', '', 'Bank Guarantee'),
  R('INTEREST DEBITED', 'Common', 'Interest'),
  R('IMPS CHG', 'Common', 'Bank Charges'),
  R('GST', '', 'GST'),
  R('JPMC', 'TSG', 'Honeywell'),
  R('20082560000786 - RV SOLUTIONS PRIVATE LIMITED', 'Common', 'Interbank'),
  R('RV Solutions PriVATE', 'Common', 'Interbank'),

  // Imprest with explicit division tag (fixes "IMPREST CSD/IT/COM")
  {
    test: /IMPREST\s+(CSD|COM|ITC?|IT)\b/i,
    division: (_raw, m) => {
      const tag = (m?.[1] || '').toUpperCase();
      return (tag === 'CSD') ? 'CSD'
           : (tag === 'COM') ? 'Common'
           : /* IT / ITC */     'ITSS';
    },
    remark: 'Imprest',
  },

  // Specific TSG activity phrases
  R(/VENDOR\s+PAYMENT\s+TSG/i, 'TSG', 'Vendor payment'),
  R(/\bFNF\s+TSG\b/i, 'TSG', 'FNF'),
  R(/\bRENT\s+TSG\b/i, 'TSG', 'Rent'),
  R(/\bELE(?:CTRICITY)?\s*PAYMENT\s+TSG\b/i, 'TSG', 'Electricity payment'),
  R(/VENDOR PAYMENT\s+TSG/i, 'TSG', 'Vendor payment'),

  // Interbank style
  R(/IB FUNDS TRANSFER|TPT-RV.*TO.*575|TO 575-?RV SOLUTIONS/i, 'Common', 'Interbank'),
];

/** ---------- FALLBACKS, more generic ---------- */
export const FALLBACK_RULES: Rule[] = [
  // Common TSG transfer phrasing
  R(/FUND TRANSFER\s+TSG|FT\s*-\s*FUND TRANSFER\s+TSG/i, 'TSG', 'FT'),

  // division tokens
  {
    test: /\bTSG\b/i,
    division: 'TSG',
    remark: (s) =>
      /SALARY/i.test(s) ? 'Salary'
      : /VENDOR/i.test(s) ? 'Vendor payment'
      : /\bFNF\b/i.test(s) ? 'FNF'
      : /RENT/i.test(s) ? 'Rent'
      : /(FUND TRANSFER|^FT\b)/i.test(s) ? 'FT'
      : undefined,
  },

  {
    test: /\bCSD\b/i,
    division: 'CSD',
    remark: (s) =>
      /SALARY/i.test(s) ? 'Salary'
      : /\bFNF\b/i.test(s) ? 'FNF'
      : /\bRENT\b/i.test(s) ? 'Rent'
      : /\bVENDOR/i.test(s) ? 'Vendor payment'
      : undefined,
  },

  {
    test: /\bITC?\b/i,
    division: 'ITSS',
    remark: (s) =>
      /\bFNF\b/i.test(s) ? 'FNF'
      : /\bRENT\b/i.test(s) ? 'Rent'
      : /\bVENDOR/i.test(s) ? 'Vendor payment'
      : undefined,
  },

  // generic Imprest (kept *after* the tagged rule)
  R(/IMPREST/i, 'Common', 'Imprest'),

  // vendor catch-all
  R('VENDOR PAYMENT', 'Common', 'Vendor'),

  // general FNF fallback (in case division rule doesn't catch it)
  R(/\bFNF\b/i, undefined, 'FNF'),
];

/** ---------- Classifier ---------- */
export function classifyNarration(
  narr: string
): { division?: Div; remark?: string } {
  const raw = narr ?? '';

  for (const rule of [...PRIORITY_RULES, ...FALLBACK_RULES]) {
    const match: RegExpMatchArray | null =
      typeof rule.test === 'function' ? null : raw.match(rule.test);

    const hit =
      typeof rule.test === 'function'
        ? (rule.test as (s: string) => boolean)(raw)
        : match !== null;

    if (!hit) continue;

    const division =
      typeof rule.division === 'function'
        ? (rule.division as (s: string, m?: RegExpMatchArray) => Div)(raw, match ?? undefined)
        : (rule.division ?? 'Common');

    const remark =
      typeof rule.remark === 'function'
        ? (rule.remark as (s: string) => string | undefined)(raw)
        : rule.remark;

    return { division, remark };
  }

  return { division: undefined, remark: undefined };
}