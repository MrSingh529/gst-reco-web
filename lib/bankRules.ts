// lib/bankRules.ts
export type Div = 'TSG' | 'CSD' | 'ITSS' | 'Common';
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
  // Named entities / vendors
  R('NATIONAL INFORMATICS CENTRE SERVICE', 'ITSS', 'NICSI'),
  R('BHARTI HEXACOM', 'TSG', 'Bharti'),
  R('BEETEL TELETECH', 'TSG', 'Beetel'),
  R('ZTE', 'TSG', 'ZTE'),
  R('BHARAT SANCHAR NIGAM', 'TSG', 'BSNL'),
  R('VODAFONE IDEA', 'TSG', 'Vodafone'),
  R('INDUS TOWERS', 'TSG', 'Indus'),
  R('BHARTI AIRTEL', 'TSG', 'Airtel'),
  R('MANTARAV', 'ITSS', 'Mantrav'),
  R('LARSEN AND TOUBRO', 'TSG', 'L&T'),
  R('KIRAN MALIK', 'TSG', 'Rent'),
  R('NEERU CHHABRA', 'Common', 'Rent'),
  R(/SAMSUNG INDIA ELECTRONICS (PVT|PRIVATE)/, 'CSD', 'Samsung'),
  R('SAMSUNG INDIA ELECTRONICS PVT LTD BHIWAN', 'CSD', 'Samsung Bhiwani'),
  R('ADISOFT', 'ITSS', 'Adisoft'),

  // Imprest with explicit division tag (fixes “IMPREST CSD/IT/COM”)
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
      /VENDOR/i.test(s) ? 'Vendor payment'
      : /\bFNF\b/i.test(s) ? 'FNF'
      : /RENT/i.test(s) ? 'Rent'
      : /(FUND TRANSFER|^FT\b)/i.test(s) ? 'FT'
      : undefined,
  },
  R(/\bCSD\b/i, 'CSD'),
  R(/\bITC?\b/i, 'ITSS'),

  // generic Imprest (kept *after* the tagged rule)
  R(/IMPREST/i, 'Common', 'Imprest'),
];

/** ---------- Classifier ---------- */
export function classifyNarration(narr: string): { division: Div; remark?: string } {
  const raw = narr || '';
  for (const rule of [...PRIORITY_RULES, ...FALLBACK_RULES]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = typeof rule.test === 'function' ? (rule.test(raw) ? [] as any : null) : raw.match(rule.test);
    if (!match) continue;
    const division = typeof rule.division === 'function' ? rule.division(raw, match) : (rule.division ?? 'Common');
    const remark = typeof rule.remark === 'function' ? rule.remark(raw) : rule.remark;
    return { division, remark };
  }
  return { division: 'Common' };
}
