'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface EmailResult {
  success: boolean
  summary: {
    totalClients: number
    emailsSent: number
    emailsFailed: number
    details: Array<{
      gstin: string
      tradeName: string
      email: string
      success: boolean
      invoicesCount: number
    }>
  }
  recommendations?: string
}

export function EmailSender() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<EmailResult | null>(null)

  const handleSendEmails = async () => {
    setSending(true)
    try {
      // Get the files from the reconciliation results
      const bookFileInput = document.getElementById('bookFile') as HTMLInputElement
      const gstrFileInput = document.getElementById('gstrFile') as HTMLInputElement
      
      if (!bookFileInput?.files?.[0] || !gstrFileInput?.files?.[0]) {
        alert('Please upload both book and GSTR files first')
        return
      }

      const formData = new FormData()
      formData.append('bookFile', bookFileInput.files[0])
      formData.append('gstrFile', gstrFileInput.files[0])
      formData.append('eps', '10')
      
      const response = await fetch('/api/send-gst-emails', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setResult(data)
      
      if (data.success) {
        alert(`Emails sent successfully! ${data.summary.emailsSent} out of ${data.summary.totalClients} sent.`)
      }
    } catch (error) {
      console.error('Failed to send emails:', error)
      alert('Failed to send emails. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Send GST Mismatch Emails</h3>
      <p className="text-sm text-gray-600 mb-4">
        Send emails to clients with GST reconciliation mismatches using mail.rvsolutions.in
      </p>
      
      <input 
        type="file" 
        id="bookFile" 
        accept=".xlsx,.xls,.csv" 
        className="mb-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      <input 
        type="file" 
        id="gstrFile" 
        accept=".xlsx,.xls,.csv" 
        className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      
      <Button 
        onClick={handleSendEmails} 
        disabled={sending}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {sending ? 'Sending Emails...' : 'Send Mismatch Emails'}
      </Button>
      
      {result && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <h4 className="font-medium">Email Summary:</h4>
          <p>Total Clients: {result.summary.totalClients}</p>
          <p>Emails Sent: {result.summary.emailsSent}</p>
          <p>Failed: {result.summary.emailsFailed}</p>
          
          {result.summary.details.length > 0 && (
            <div className="mt-2">
              <h5 className="font-medium text-sm">Details:</h5>
              <ul className="text-sm space-y-1">
                {result.summary.details.map((detail, index) => (
                  <li key={index} className={`p-2 rounded ${detail.success ? 'bg-green-50' : 'bg-red-50'}`}>
                    {detail.tradeName} ({detail.gstin}): {detail.success ? '✓ Sent' : '✗ Failed'} 
                    - {detail.invoicesCount} invoices
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}