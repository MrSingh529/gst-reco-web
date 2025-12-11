'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function EmailSender() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleSendEmails = async () => {
    setSending(true)
    try {
      // You'll need to have the bookData and gstrData from your reconciliation
      const formData = new FormData()
      // Append your files here
      
      const response = await fetch('/api/send-gst-emails', {
        method: 'POST',
        body: formData
      })
      
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
        </div>
      )}
    </div>
  )
}