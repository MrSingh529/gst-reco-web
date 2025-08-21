'use client'

import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  sheetToRows, normalize, groupByGSTINInv,
  buildZohoVsGSTR, buildGSTRVsZoho, buildSumFunction,
  buildBillsWise, buildGSTINWise, buildTradeWise,
  buildWorkbook, EPS_DEFAULT
} from '@/lib/reconcile'

export default function Page() {
  const [eps, setEps] = useState<number>(EPS_DEFAULT)
  const [fileName, setFileName] = useState<string>('')
  const [log, setLog] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    setLog('')
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const wbIn = XLSX.read(buf, { type: 'array' })

      const wsG = wbIn.Sheets['GSTR-2B']
      const wsZ = wbIn.Sheets['Zoho Data']
      if (!wsG || !wsZ) throw new Error('Sheets "GSTR-2B" and "Zoho Data" are required')

      const gRows = sheetToRows(wsG)
      const zRows = sheetToRows(wsZ)

      const { clean: g2bClean, tradeByGSTIN: t1 } = normalize(gRows)
      const { clean: zohoClean, tradeByGSTIN: t2 } = normalize(zRows)

      const tradeByGSTIN = new Map<string, string>(t1)
      for (const [k, v] of Array.from(t2.entries())) if (v) tradeByGSTIN.set(k, v)

      const g2bGrp = groupByGSTINInv(g2bClean)
      const zohoGrp = groupByGSTINInv(zohoClean)

      const aoa = {
        'Zoho Book Vs GSTR': buildZohoVsGSTR(zohoGrp, g2bGrp, eps),
        'GSTR VS Zoho Book': buildGSTRVsZoho(g2bGrp, zohoGrp, eps),
        'Sum Function':      buildSumFunction(zohoGrp, g2bGrp),
        'Bills Wise Summary':  buildBillsWise(zohoGrp, g2bGrp, eps),
        'GSTIN Wise Summary':  buildGSTINWise(zohoGrp, g2bGrp, eps),
        'Trade Name Wise Summary': buildTradeWise(zohoGrp, g2bGrp, tradeByGSTIN, eps),
      } as const

      const wbOut = buildWorkbook(aoa)
      XLSX.writeFile(wbOut, 'reconciliation_output.xlsx')
      setLog('✅ Reconciliation complete. File downloaded: reconciliation_output.xlsx')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      setLog('❌ Error: ' + msg)
    } finally {
      setBusy(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
    if (inputRef.current) inputRef.current.value = ''
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">GST Reconciliation</h1>
        <p className="small mt-1">Runs fully in browser. No data is uploaded.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Controls */}
        <section className="card md:col-span-1">
          <div className="card-pad space-y-5">
            <div>
              <label className="label">Tolerance (₹)</label>
              <input
                type="number"
                className="input w-40"
                value={eps}
                onChange={(e)=> setEps(Number(e.target.value))}
                step={0.5}
                min={0}
              />
              <p className="small mt-1">Differences ≤ tolerance are treated as 0 in all sheets.</p>
            </div>

            <div>
              <label className="label">Upload Excel</label>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                onDragOver={(e)=> e.preventDefault()}
                onDrop={onDrop}
                className="block cursor-pointer rounded-2xl border border-dashed bg-slate-50 hover:bg-slate-100 transition p-6 text-center"
              >
                <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-white shadow grid place-items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-slate-700"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.5M7 12l5-5m0 0 5 5m-5-5V21"/></svg>
                </div>
                <div className="font-medium">Drag & drop or click to upload</div>
                <div className="small mt-1">Required sheets in One Excel: “GSTR-2B” & “Zoho Data”</div>
              </label>
            </div>

            <div className="small text-slate-600">
              <div><span className="font-medium">Selected:</span> {fileName || '—'}</div>
            </div>

            <button
              className="btn btn-primary w-full disabled:opacity-60"
              onClick={()=> inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"></span>
                  Processing…
                </span>
              ) : (
                'Choose File'
              )}
            </button>
          </div>
        </section>

        {/* Right: Status panel */}
        <section className="card md:col-span-2">
          <div className="card-pad">
            <h2 className="text-lg font-semibold">Run Log</h2>
            <div className={`mt-3 min-h-[84px] rounded-xl border bg-slate-50 px-4 py-3 text-sm ${log.startsWith('✅') ? 'border-emerald-300 text-emerald-800' : log.startsWith('❌') ? 'border-rose-300 text-rose-800' : 'border-slate-200 text-slate-700'}`}>
              {busy ? 'Processing…' : (log || 'No run yet.')}
            </div>

            <div className="mt-6 small text-slate-500">
              Invoice matching is exact on (GSTIN, Invoice Number) after normalization. The ₹ tolerance only affects differences (treated as 0 when within ± tolerance).
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
