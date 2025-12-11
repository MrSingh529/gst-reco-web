import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { 
  normalize, groupByGSTINInv, 
  identifyMismatchesForEmail, RawRow 
} from '@/lib/reconcile'
import { prepareMismatchEmails, sendMismatchEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Resend API key not configured',
          details: 'Please add RESEND_API_KEY to environment variables'
        },
        { status: 500 }
      )
    }

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

    // Parse files
    const bookData = await parseExcelFile(bookFile, 'Zoho Data')
    const gstrData = await parseExcelFile(gstrFile, 'GSTR-2B')
    
    if (!bookData.length || !gstrData.length) {
      return NextResponse.json(
        { error: 'Could not parse data from files. Ensure sheets exist.' },
        { status: 400 }
      )
    }
    
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
    
    console.log(`Found ${mismatches.length} vendors with mismatches`)
    
    if (mismatches.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalClients: 0,
          emailsSent: 0,
          emailsFailed: 0,
          details: []
        },
        message: 'No mismatches found. All invoices match within tolerance.'
      })
    }
    
    // Prepare email data
    const emailData = prepareMismatchEmails(mismatches)
    
    // Send emails using Resend - FIXED: Sequential sending with delay
    const results = [];
    for (let i = 0; i < emailData.length; i++) {
      const data = emailData[i];
      try {
        console.log(`Sending email ${i + 1} of ${emailData.length} to ${data.email}`);
        
        const success = await sendMismatchEmail(data);
        results.push({
          gstin: data.gstin,
          tradeName: data.tradeName,
          email: data.email,
          success,
          invoicesCount: data.mismatchedInvoices.length
        });
        
        // Add delay between emails (1 second to stay under 2 requests/second limit)
        // Only add delay if not the last email
        if (i < emailData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (error) {
        console.error(`Failed to send email to ${data.email}:`, error);
        results.push({
          gstin: data.gstin,
          tradeName: data.tradeName,
          email: data.email,
          success: false,
          invoicesCount: data.mismatchedInvoices.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
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
        `Some emails failed to send: ${failed.map(f => f.email).join(', ')}` :
        'All emails sent successfully via Resend.',
      mismatchesCount: mismatches.length
    })
    
  } catch (error) {
    console.error('Error processing GST emails:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process GST reconciliation emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to parse Excel files with specific sheet
async function parseExcelFile(file: File, sheetName: string): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  
  // Try to find the sheet (case-insensitive)
  const sheet = workbook.Sheets[sheetName] || 
                workbook.Sheets[sheetName.toLowerCase()] ||
                workbook.Sheets[sheetName.toUpperCase()]
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in ${file.name}`)
  }
  
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return data as RawRow[]
}