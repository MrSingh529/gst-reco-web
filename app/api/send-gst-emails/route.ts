import { NextRequest, NextResponse } from 'next/server'
import { identifyMismatchesForEmail, normalize, groupByGSTINInv } from '@/lib/reconcile'
import { prepareMismatchEmails, sendMismatchEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const bookFile = formData.get('bookFile') as File
    const gstrFile = formData.get('gstrFile') as File
    const eps = parseInt(formData.get('eps') as string) || 10
    
    if (!bookFile || !gstrFile) {
      return NextResponse.json(
        { error: 'Both book file and GSTR file are required' },
        { status: 400 }
      )
    }

    // Parse files (you'll need to implement file parsing)
    const bookData = await parseExcelFile(bookFile)
    const gstrData = await parseExcelFile(gstrFile)
    
    // Normalize and process data
    const { clean: bookClean, tradeByGSTIN, emailByGSTIN } = normalize(bookData)
    const { clean: gstrClean } = normalize(gstrData)
    
    const bookGrouped = groupByGSTINInv(bookClean)
    const gstrGrouped = groupByGSTINInv(gstrClean)
    
    // Identify mismatches
    const mismatches = identifyMismatchesForEmail(
      bookGrouped,
      gstrGrouped,
      emailByGSTIN,
      tradeByGSTIN,
      eps
    )
    
    // Prepare email data
    const emailData = prepareMismatchEmails(mismatches)
    
    // Send emails
    const results = await Promise.all(
      emailData.map(async (data) => {
        const success = await sendMismatchEmail(data)
        return {
          gstin: data.gstin,
          tradeName: data.tradeName,
          email: data.email,
          success,
          invoicesCount: data.mismatchedInvoices.length
        }
      })
    )
    
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    
    return NextResponse.json({
      success: true,
      summary: {
        totalClients: results.length,
        emailsSent: successful.length,
        emailsFailed: failed.length,
        details: results
      },
      recommendations: failed.length > 0 ? 
        `Some emails failed to send. Please check: ${failed.map(f => f.email).join(', ')}` :
        'All emails sent successfully.'
    })
    
  } catch (error) {
    console.error('Error processing GST emails:', error)
    return NextResponse.json(
      { error: 'Failed to process GST reconciliation emails' },
      { status: 500 }
    )
  }
}

// Helper function to parse Excel files
async function parseExcelFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(worksheet)
}