import nodemailer from 'nodemailer'

export interface MismatchData {
  gstin: string
  tradeName: string
  email: string
  mismatchedInvoices: Array<{
    invoiceNumber: string
    bookValue: number
    gstrValue: number
    difference: number
  }>
  totalDifference: number
}

export async function sendMismatchEmail(
    mismatchData: MismatchData,
    senderEmail: string = process.env.EMAIL_FROM_ADDRESS || 'harpinder.singh@rvsolutions.in',
    senderName: string = process.env.EMAIL_FROM_NAME || 'Harpinder Singh'
  ): Promise<boolean> {
    try {
      // Debug logging
      console.log('SMTP Configuration:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        secure: parseInt(process.env.EMAIL_PORT || '587') === 465,
        from: senderEmail,
        fromName: senderName,
        cc: process.env.EMAIL_CC,
        bcc: process.env.EMAIL_BCC
      });
  
      const port = 587;
      const secure = false;
      
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'mail.rvsolutions.in',
        port: port,
        secure: secure,
        auth: {
          user: process.env.EMAIL_USER || 'harpinder.singh@rvsolutions.in',
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      });

    // Format the mismatched invoices table
    const invoicesTable = mismatchData.mismatchedInvoices
      .map(inv => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${inv.invoiceNumber}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">₹${inv.bookValue.toLocaleString('en-IN')}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">₹${inv.gstrValue.toLocaleString('en-IN')}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: ${inv.difference > 0 ? '#d63031' : '#00b894'}">
            ₹${Math.abs(inv.difference).toLocaleString('en-IN')} ${inv.difference > 0 ? '(Excess)' : '(Short)'}
          </td>
        </tr>
      `)
      .join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>GST Reconciliation Mismatch - ${mismatchData.tradeName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #3498db; color: white; padding: 12px; text-align: left; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>RV Solutions</h1>
            <h2>GST Reconciliation Notice</h2>
          </div>
          
          <div class="content">
            <p>Dear ${mismatchData.tradeName},</p>
            
            <p>During our monthly GST reconciliation process, we have identified discrepancies between your submitted invoices and our GSTR-2B records for GSTIN: <strong>${mismatchData.gstin}</strong>.</p>
            
            <p><strong>Summary of Mismatches:</strong></p>
            <table border="1" cellpadding="0" cellspacing="0">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Book Value (₹)</th>
                  <th>GSTR-2B Value (₹)</th>
                  <th>Difference (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${invoicesTable}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align: right; font-weight: bold;">Total Difference:</td>
                  <td style="font-weight: bold; color: ${mismatchData.totalDifference > 0 ? '#d63031' : '#00b894'}">
                    ₹${Math.abs(mismatchData.totalDifference).toLocaleString('en-IN')} 
                    ${mismatchData.totalDifference > 0 ? '(Excess)' : '(Short)'}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            <p><strong>Required Action:</strong></p>
            <ol>
              <li>Please verify the invoice details mentioned above</li>
              <li>Check your GSTR-2B for the corresponding period</li>
              <li>Provide clarification or corrected documents if needed</li>
              <li>Reply to this email with your confirmation or corrections</li>
            </ol>
            
            <p><strong>Response Deadline:</strong> 7 days from the date of this email</p>
            
            <p>If you have already resolved these discrepancies or have any questions, please contact our accounts team at accounts@rvsolutions.in or call +91-XXXXXXXXXX.</p>
            
            <p>Best regards,<br>
            <strong>Accounts Department</strong><br>
            RV Solutions Private Limited<br>
            Email: accounts@rvsolutions.in<br>
            Phone: +91-XXXXXXXXXX</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email from RV Solutions GST Reconciliation System.</p>
            <p>Please do not reply to this email address. Use accounts@rvsolutions.in for correspondence.</p>
            <p>© ${new Date().getFullYear()} RV Solutions Private Limited. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
      GST Reconciliation Mismatch Notice
      
      Dear ${mismatchData.tradeName},
      
      We have identified discrepancies in GST reconciliation for your GSTIN: ${mismatchData.gstin}
      
      Mismatched Invoices:
      ${mismatchData.mismatchedInvoices.map(inv => `
        Invoice: ${inv.invoiceNumber}
        Book Value: ₹${inv.bookValue}
        GSTR-2B Value: ₹${inv.gstrValue}
        Difference: ₹${inv.difference} ${inv.difference > 0 ? '(Excess)' : '(Short)'}
      `).join('\n')}
      
      Total Difference: ₹${mismatchData.totalDifference}
      
      Please review and respond within 7 days.
      
      Accounts Department
      RV Solutions Private Limited
      accounts@rvsolutions.in
    `

    const ccEmails = process.env.EMAIL_CC ? process.env.EMAIL_CC.split(',') : [];
    const bccEmails = process.env.EMAIL_BCC ? process.env.EMAIL_BCC.split(',') : [];

    // Add default accounts email if not already in CC
    if (!ccEmails.includes('accounts@rvsolutions.in')) {
      ccEmails.push('accounts@rvsolutions.in');
    }

    const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: mismatchData.email,
        cc: ccEmails.join(','),
        bcc: bccEmails.join(','),
        subject: `GST Reconciliation Discrepancy - ${mismatchData.tradeName} (${mismatchData.gstin})`,
        text: textContent,
        html: htmlContent,
        priority: 'high' as const
      }

    console.log('Sending email with:', {
      to: mismatchData.email,
      cc: mailOptions.cc,
      bcc: mailOptions.bcc,
      subject: mailOptions.subject
    });

    const info = await transporter.sendMail(mailOptions)
    console.log(`✅ Email sent to ${mismatchData.email}: ${info.messageId}`)
    return true
    
  } catch (error) {
    console.error(`❌ Failed to send email to ${mismatchData.email}:`, error)
    return false
  }
}

export function prepareMismatchEmails(
  mismatchedResults: Array<{
    gstin: string;
    tradeName: string;
    email: string;
    mismatchedInvoices: Array<{
      invoiceNumber: string;
      bookValue: number;
      gstrValue: number;
      difference: number;
    }>;
  }>
): MismatchData[] {
  return mismatchedResults.map(result => ({
    ...result,
    totalDifference: result.mismatchedInvoices.reduce((sum, inv) => sum + inv.difference, 0)
  }))
}