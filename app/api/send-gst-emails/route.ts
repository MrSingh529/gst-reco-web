import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { 
  normalize, groupByGSTINInv, 
  identifyMismatchesForEmail, RawRow 
} from '@/lib/reconcile'
import { prepareMismatchEmails, sendMismatchEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Check if Gmail credentials are configured
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { 
          error: 'Gmail credentials not configured',
          details: 'Please add GMAIL_USER and GMAIL_APP_PASSWORD to environment variables'
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
    
    // Check Gmail daily limit (100-150 emails per day)
    // Include CC emails in the count
    const ccCount = process.env.EMAIL_CC ? 
      process.env.EMAIL_CC.split(',').filter(email => email.trim()).length : 0;
    const totalEmailCount = mismatches.length + ccCount;
    
    if (totalEmailCount > 100) {
      return NextResponse.json({
        success: false,
        error: 'Gmail daily limit exceeded',
        details: `You're trying to send ${totalEmailCount} emails. Gmail free tier allows only 100-150 emails per day. Please reduce the number of recipients or split into multiple batches.`,
        summary: {
          totalClients: mismatches.length,
          emailsToSend: totalEmailCount,
          gmailDailyLimit: 100
        }
      }, { status: 400 })
    }
    
    // Prepare email data
    const emailData = prepareMismatchEmails(mismatches)
    
    // Send emails using Gmail - Sequential sending with Gmail-specific delay
    const results = [];
    let dailyEmailCount = 0;
    const MAX_DAILY_EMAILS = 100; // Conservative Gmail daily limit
    
    for (let i = 0; i < emailData.length; i++) {
      const data = emailData[i];
      
      // Check daily limit before sending
      if (dailyEmailCount >= MAX_DAILY_EMAILS) {
        console.warn(`Daily Gmail limit reached (${MAX_DAILY_EMAILS}). Stopping email sending.`);
        break;
      }
      
      try {
        console.log(`Sending email ${i + 1} of ${emailData.length} to ${data.email} (Daily count: ${dailyEmailCount + 1}/${MAX_DAILY_EMAILS})`);
        
        const success = await sendMismatchEmail(data);
        results.push({
          gstin: data.gstin,
          tradeName: data.tradeName,
          email: data.email,
          success,
          invoicesCount: data.mismatchedInvoices.length
        });
        
        dailyEmailCount++;
        
        // Gmail rate limiting: 4-5 second delay between emails
        // Gmail allows ~15-20 emails per minute, so 4-5 seconds is safe
        if (i < emailData.length - 1) {
          const delayMs = 4500 + Math.random() * 1000; // 4.5-5.5 seconds with random variation
          console.log(`Waiting ${Math.round(delayMs/1000)} seconds before next email...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
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
        
        // If it's a rate limit error, wait longer
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('rate limit') || errorMsg.includes('quota') || errorMsg.includes('550')) {
          console.log('Gmail rate limit detected, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }
    
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    
    // Calculate time estimate for remaining emails if limit was reached
    let timeEstimate = '';
    if (dailyEmailCount >= MAX_DAILY_EMAILS && emailData.length > MAX_DAILY_EMAILS) {
      const remaining = emailData.length - MAX_DAILY_EMAILS;
      const hoursNeeded = Math.ceil(remaining / 15); // ~15 emails per hour with 4-second delay
      timeEstimate = ` Gmail daily limit reached. ${remaining} emails remaining (approx. ${hoursNeeded} hours to send tomorrow).`;
    }
    
    return NextResponse.json({
      success: successful.length > 0,
      summary: {
        totalClients: emailData.length,
        emailsSent: successful.length,
        emailsFailed: failed.length,
        emailsSkipped: emailData.length - results.length,
        dailyLimitReached: dailyEmailCount >= MAX_DAILY_EMAILS,
        details: results
      },
      recommendations: failed.length > 0 ? 
        `Some emails failed to send: ${failed.map(f => f.email).join(', ')}.${timeEstimate}` :
        `All ${successful.length} emails sent successfully via Gmail.${timeEstimate}`,
      mismatchesCount: mismatches.length,
      gmailLimits: {
        daily: MAX_DAILY_EMAILS,
        sentToday: dailyEmailCount,
        remainingToday: MAX_DAILY_EMAILS - dailyEmailCount
      }
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