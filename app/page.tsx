'use client'

import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  sheetToRows, normalize, groupByGSTINInv,
  buildZohoVsGSTR, buildGSTRVsZoho, buildSumFunction,
  buildBillsWise, buildGSTINWise, buildTradeWise,
  buildWorkbook, EPS_DEFAULT, buildMatchedTaxableByGSTIN,
  buildInvoiceWise,
} from '@/lib/reconcile'

// Define interfaces for reconciliation data
interface ReconciliationData {
  zohoGrp: Array<{
    GSTIN_clean: string;
    INV_clean: string;
    inv_val: number;
    igst: number;
    cgst: number;
    sgst: number;
    taxable: number;
  }>;
  g2bGrp: Array<{
    GSTIN_clean: string;
    INV_clean: string;
    inv_val: number;
    igst: number;
    cgst: number;
    sgst: number;
    taxable: number;
  }>;
  tradeByGSTIN: Map<string, string>;
  emailByGSTIN: Map<string, string>;
  bookFile: File;
  gstrFile: File;
}

// Define interface for email results
interface EmailResult {
  gstin: string;
  tradeName: string;
  email: string;
  success: boolean;
  invoicesCount: number;
  error?: string;
}

export default function Page() {
  const [eps, setEps] = useState<number>(EPS_DEFAULT)
  const [fileName, setFileName] = useState<string>('')
  const [log, setLog] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null) // Fixed type
  
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
      const { clean: zohoClean, tradeByGSTIN: t2, emailByGSTIN } = normalize(zRows)

      const tradeByGSTIN = new Map<string, string>(t1)
      for (const [k, v] of Array.from(t2.entries())) if (v) tradeByGSTIN.set(k, v)

      const g2bGrp = groupByGSTINInv(g2bClean)
      const zohoGrp = groupByGSTINInv(zohoClean)

      const aoa = {
        'Zoho Book Vs GSTR':         buildZohoVsGSTR(zohoGrp, g2bGrp, tradeByGSTIN, eps),
        'GSTR VS Zoho Book':         buildGSTRVsZoho(g2bGrp, zohoGrp, tradeByGSTIN, eps),
        'Sum Function':              buildSumFunction(zohoGrp, g2bGrp),
        'Bills Wise Summary':        buildBillsWise(zohoGrp, g2bGrp, eps),
        'GSTIN Wise Summary':        buildGSTINWise(zohoGrp, g2bGrp, eps),
        'Trade Name Wise Summary':   buildTradeWise(zohoGrp, g2bGrp, tradeByGSTIN, eps),
        'Matched Taxable by GSTIN':  buildMatchedTaxableByGSTIN(zohoGrp, g2bGrp, tradeByGSTIN, eps),
        'Invoice Wise':              buildInvoiceWise(zohoGrp, g2bGrp, tradeByGSTIN, eps),
      } as const

      const wbOut = buildWorkbook(aoa)
      XLSX.writeFile(wbOut, 'reconciliation_output.xlsx')
      
      // Store data for email sending
      setReconciliationData({
        zohoGrp,
        g2bGrp,
        tradeByGSTIN,
        emailByGSTIN,
        bookFile: file,
        gstrFile: file
      })
      
      setLog('✅ Reconciliation complete. File downloaded: reconciliation_output.xlsx')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      setLog('❌ Error: ' + msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleSendEmails() {
    if (!reconciliationData) {
      setLog('❌ Please run reconciliation first')
      return
    }

    setEmailBusy(true)
    setLog('Sending emails to vendors with mismatches...')

    try {
      const formData = new FormData()
      
      // Create two separate files for API
      const bookFile = new File(
        [await reconciliationData.bookFile.arrayBuffer()], 
        'book_data.xlsx', 
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      )
      
      const gstrFile = new File(
        [await reconciliationData.gstrFile.arrayBuffer()], 
        'gstr_data.xlsx', 
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      )
      
      formData.append('bookFile', bookFile)
      formData.append('gstrFile', gstrFile)
      formData.append('eps', eps.toString())

      const response = await fetch('/api/send-gst-emails', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to send emails: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        const successfulCount = result.summary.emailsSent
        const totalCount = result.summary.totalClients
        
        setLog(`✅ Emails sent successfully! ${successfulCount} out of ${totalCount} vendors notified.`)
        
        // Show detailed results
        const failed = result.summary.details.filter((d: EmailResult) => !d.success)
        if (failed.length > 0) {
          const failedNames = failed.map((f: EmailResult) => f.tradeName).join(', ')
          setLog(prev => prev + ` Failed: ${failedNames}`)
        }
      } else {
        setLog(`❌ Email sending failed: ${result.error || 'Unknown error'}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      setLog('❌ Error sending emails: ' + msg)
    } finally {
      setEmailBusy(false)
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
                onChange={(e) => setEps(Number(e.target.value))}
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="block cursor-pointer rounded-2xl border border-dashed bg-slate-50 hover:bg-slate-100 transition p-6 text-center"
              >
                <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-white shadow grid place-items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-slate-700"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.5M7 12l5-5m0 0l5 5m-5-5V21"/></svg>
                </div>
                <div className="font-medium">Drag &amp; drop or click to upload</div>
                <div className="small mt-1">Required sheets in One Excel: &quot;GSTR-2B&quot; &amp; &quot;Zoho Data&quot;</div>
              </label>
            </div>

            <div className="small text-slate-600">
              <div><span className="font-medium">Selected:</span> {fileName || '—'}</div>
            </div>

            <button
              className="btn btn-primary w-full disabled:opacity-60"
              onClick={() => inputRef.current?.click()}
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

            {/* Email Sending Section - Only show after reconciliation */}
            {reconciliationData && (
              <div className="pt-4 border-t">
                <h3 className="label mb-3">Email Notifications</h3>
                <button
                  onClick={handleSendEmails}
                  disabled={emailBusy || !reconciliationData}
                  className="btn w-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {emailBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                      Sending Emails…
                    </span>
                  ) : (
                    '📧 Send Mismatch Emails to Vendors'
                  )}
                </button>
                <p className="small mt-2">
                  Send automated emails to vendors with GST mismatches. 
                  Ensure &quot;Email&quot; column exists in Zoho Data sheet.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right: Status panel */}
        <section className="card md:col-span-2">
          <div className="card-pad">
            <h2 className="text-lg font-semibold">Run Log</h2>
            <div className={`mt-3 min-h-[84px] rounded-xl border bg-slate-50 px-4 py-3 text-sm ${log.startsWith('✅') ? 'border-emerald-300 text-emerald-800' : log.startsWith('❌') ? 'border-rose-300 text-rose-800' : log.includes('Sending') ? 'border-blue-300 text-blue-800' : 'border-slate-200 text-slate-700'}`}>
              {busy ? 'Processing reconciliation...' : 
               emailBusy ? 'Sending emails to vendors...' : 
               (log || 'No run yet. Upload an Excel file to begin.')}
            </div>

            {reconciliationData && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="font-medium text-blue-800 mb-2">Ready to Send Emails</h3>
                <p className="text-sm text-blue-700">
                  Click the &quot;Send Mismatch Emails&quot; button to notify vendors with reconciliation discrepancies.
                  Emails will be sent from <strong>harpinder.singh@rvsolutions.in</strong>
                </p>
              </div>
            )}

            <div className="mt-6 small text-slate-500">
              Invoice matching is exact on (GSTIN, Invoice Number) after normalization. The ₹ tolerance only affects differences (treated as 0 when within ± tolerance).
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}