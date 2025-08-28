// lib/bankSheet.ts
import * as XLSX from 'xlsx'
import { classifyNarration } from './bankRules'

const up = (s: unknown) => String(s ?? '').toUpperCase()

/**
 * Finds the header row (where col A ~ 'Date' and col B contains 'Narration'),
 * adds Division/Remarks columns if missing, and fills empty cells from rules.
 */
export function annotateStatement(wsIn: XLSX.WorkSheet): XLSX.WorkSheet {
  const aoa = XLSX.utils.sheet_to_json<string[]>({ ...wsIn }, { header: 1, raw: false })
  if (!aoa.length) return wsIn

  // find header row (bank dumps usually have a lot of text above)
  const hdrIdx = aoa.findIndex(
    r => up(r?.[0]).startsWith('DATE') && up(r?.[1]).includes('NARRATION')
  )
  if (hdrIdx === -1) throw new Error('Could not locate header row with "Date" & "Narration".')

  const header = aoa[hdrIdx]
  let divCol = header.findIndex(h => up(h) === 'DIVISION')
  let remCol = header.findIndex(h => up(h) === 'REMARKS')

  // append columns if not present
  if (divCol === -1) { divCol = header.length; header.push('Division') }
  if (remCol === -1) { remCol = header.length; header.push('Remarks') }

  for (let r = hdrIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || []
    const narration = row[1] || ''
    if (!narration) continue

    const alreadyDiv = String(row[divCol] ?? '').trim()
    const alreadyRem = String(row[remCol] ?? '').trim()
    if (alreadyDiv && alreadyRem) continue // don’t overwrite manual entries

    const { division, remark } = classifyNarration(narration)
    if (!alreadyDiv) row[divCol] = division
    if (!alreadyRem) row[remCol] = remark ?? ''
    aoa[r] = row
  }

  return XLSX.utils.aoa_to_sheet(aoa)
}
