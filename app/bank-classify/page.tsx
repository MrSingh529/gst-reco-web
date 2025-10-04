// page.tsx
'use client'
import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { annotateStatement } from '@/lib/bankSheet'
import { buildSummarySheet } from '@/lib/bankSummary'   // ⬅️ add this

export default function Page() {
  const [log, setLog] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    try {
      setLog('Processing…')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]

      // 1) Classify Division/Remarks
      const wsClassified = annotateStatement(ws)

      // 2) Build the Summary sheet (uses the classified sheet so it can use Remarks)
      const wsSummary = buildSummarySheet(wsClassified)

      // 3) Write a new workbook with both sheets
      const wbOut = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wbOut, wsClassified, firstSheetName)
      XLSX.utils.book_append_sheet(wbOut, wsSummary, 'Summary')  // ⬅️
      XLSX.writeFile(wbOut, 'statement_classified.xlsx')

      setLog('✅ Done. Downloaded: statement_classified.xlsx')
    } catch (e) {
      const err = e as Error
      setLog('❌ ' + err.message)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Bank Statement — Auto Division & Remarks</h1>
      <p className="text-sm text-slate-600 mb-6">
        Runs 100% in your browser. We read the first sheet, add Division/Remarks, and create a Summary.
      </p>

      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" id="file" />
      <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>Choose Excel</button>

      <div
        className={`mt-4 rounded-md border p-3 text-sm ${
          log.startsWith('✅') ? 'border-emerald-300 text-emerald-800'
          : log.startsWith('❌') ? 'border-rose-300 text-rose-800'
          : 'border-slate-200 text-slate-700'
        }`}
      >
        {log || 'No run yet.'}
      </div>

      <ul className="mt-6 text-sm text-slate-600 list-disc pl-5 space-y-1">
        <li>Detect header (Date/Narration), fill missing “Division” & “Remarks”.</li>
        <li>Create a <em>Summary</em> sheet: Inflow/Outflow by month and by “Remarks” (fallback: Narration), with totals and % contribution.</li>
        <li>Manual values are never overwritten.</li>
      </ul>
    </main>
  )
}
