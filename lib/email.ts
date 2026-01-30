import nodemailer from 'nodemailer';

export interface MismatchData {
  gstin: string;
  tradeName: string;
  email: string;
  mismatchedInvoices: Array<{
    invoiceNumber: string;
    invoiceDate: string;
    bookInvoiceValue: number;
    bookTaxableValue: number;
    bookIGST: number;
    bookCGST: number;
    bookSGST: number;
    gstrInvoiceValue: number;
    gstrTaxableValue: number;
    gstrIGST: number;
    gstrCGST: number;
    gstrSGST: number;
    difference: number;
  }>;
  totalDifference: number;
}

export async function sendMismatchEmail(
  mismatchData: MismatchData
): Promise<boolean> {
  try {
    console.log('Sending email via Gmail to:', mismatchData.email);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 10,
      rateDelta: 4000,
      rateLimit: 15,
    });

    const invoicesTable = mismatchData.mismatchedInvoices
      .map(inv => {
        // 1. Invoice Amount: Use whichever exists (Zoho or GSTR)
        //    Priority: Zoho Invoice Value > GSTR Invoice Value
        let invoiceAmount = 0;
        if (inv.bookInvoiceValue > 0) {
          invoiceAmount = inv.bookInvoiceValue; // From Zoho
        } else if (inv.gstrInvoiceValue > 0) {
          invoiceAmount = inv.gstrInvoiceValue; // From GSTR (if Zoho is 0)
        }
        
        // 2. GST Amount: Sum of GST components
        //    Priority: Use Zoho GST if exists, otherwise GSTR GST
        let gstAmount = 0;
        if (inv.bookIGST !== 0 || inv.bookCGST !== 0 || inv.bookSGST !== 0) {
          gstAmount = inv.bookIGST + inv.bookCGST + inv.bookSGST;
        } else if (inv.gstrIGST !== 0 || inv.gstrCGST !== 0 || inv.gstrSGST !== 0) {
          gstAmount = inv.gstrIGST + inv.gstrCGST + inv.gstrSGST;
        }
        
        const invoiceDate = inv.invoiceDate;
        
        return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">09AADCR9806P1ZL</td>
          <td style="padding: 8px; border: 1px solid #ddd;">RV Solutions Private Limited</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${mismatchData.tradeName}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${mismatchData.gstin}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${inv.invoiceNumber}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoiceDate}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">₹${invoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        </tr>
      `}).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>GST Reconciliation Discrepancy - ${mismatchData.tradeName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th { background-color: #3498db; color: white; padding: 12px; text-align: left; }
          .legal-note { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
          .warning { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin: 20px 0; }
          ul { padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <!-- Header intentionally left blank per accounts team request -->
          </div>
          
          <div class="content">
            <p>Dear Sir/Madam,</p>
            
            <div class="legal-note">
              <p><strong>• As per GST law, Input tax Credit (ITC) of any tax invoices can only be availed by recipient subject to reflection of the said invoices in GSTR-2B of the recipient, filing of GST returns, payment of taxes, receipt of supply etc.</strong></p>
              <p><strong>• In respect of the above, we would like to inform you that the attached invoices are not reflecting in GSTR2B. Therefore, you are requested to file GSTR1 return as soon as possible and confirm the same to us.</strong></p>
            </div>
            
            <p><strong>Discrepancy Details:</strong></p>
            <table border="1" cellpadding="0" cellspacing="0">
              <thead>
                <tr>
                  <th>Buyer GSTIN</th>
                  <th>Company Name</th>
                  <th>Supplier Name</th>
                  <th>Supplier GSTIN</th>
                  <th>Invoice Number</th>
                  <th>Invoice Date</th>
                  <th>Invoice Amount (₹)</th>
                  <th>GST Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${invoicesTable}
              </tbody>
            </table>
            
            <div class="warning">
              <p><strong>• If any non-compliance is identified in GSTR 2A/2B/Reconciliation (short filling/not filling/wrong GSTN filling) for the said period, then a Debit note of GST Value with 18% interest will be raised on you on immediate basis which will be adjusted from your payment. Request you to please do the needful as early as possible for the cases as enclosed and file / correct your GSTR 1 return.</strong></p>
              <p><strong>• In case the GST returns are correctly filed, then would request you to please share screenshot of invoices along with Invoice number/date, Amount, Receiver + Supplier GSTN and filing status from GST portal.</strong></p>
            </div>
            
            <p>If you have already resolved these discrepancies or have any questions, please contact our accounts team at gsthelpdesk@rvsolutions.in</p>
            
            <p>Best regards,<br>
            <strong>Accounts Department</strong><br>
            RV Solutions Private Limited<br>
            Email: gsthelpdesk@rvsolutions.in</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email from RV Solutions GST Reconciliation System.</p>
            <p>Please do not reply to this email address. Use gsthelpdesk@rvsolutions.in for correspondence.</p>
            <p>© ${new Date().getFullYear()} RV Solutions Private Limited. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
GST Reconciliation Discrepancy

Dear Sir/Madam,

• As per GST law, Input tax Credit (ITC) of any tax invoices can only be availed by recipient subject to reflection of the said invoices in GSTR-2B of the recipient, filing of GST returns, payment of taxes, receipt of supply etc.

• In respect of the above, we would like to inform you that the attached invoices are not reflecting in GSTR2B. Therefore, you are requested to file GSTR1 return as soon as possible and confirm the same to us.

Buyer GSTIN: 09AADCR9806P1ZL
Company Name: RV Solutions Private Limited
Supplier Name: ${mismatchData.tradeName}
Supplier GSTIN: ${mismatchData.gstin}

Discrepancy Invoices:
${mismatchData.mismatchedInvoices.map(inv => {
  const invoiceAmount = inv.bookInvoiceValue;
  let gstAmount = 0;
  
  if (inv.gstrIGST !== 0 || inv.gstrCGST !== 0 || inv.gstrSGST !== 0) {
    gstAmount = inv.gstrIGST + inv.gstrCGST + inv.gstrSGST;
  } else {
    gstAmount = inv.bookIGST + inv.bookCGST + inv.bookSGST;
  }
  
  return `
Invoice Number: ${inv.invoiceNumber}
Invoice Date: ${inv.invoiceDate}
Invoice Amount: ₹${invoiceAmount.toLocaleString('en-IN')}
GST Amount: ₹${gstAmount.toLocaleString('en-IN')}
----------------------------------------
`;
}).join('')}

• If any non-compliance is identified in GSTR 2A/2B/Reconciliation (short filling/not filling/wrong GSTN filling) for the said period, then a Debit note of GST Value with 18% interest will be raised on you on immediate basis which will be adjusted from your payment. Request you to please do the needful as early as possible for the cases as enclosed and file / correct your GSTR 1 return.

• In case the GST returns are correctly filed, then would request you to please share screenshot of invoices along with Invoice number/date, Amount, Receiver + Supplier GSTN and filing status from GST portal.

If you have already resolved these discrepancies or have any questions, please contact our accounts team at gsthelpdesk@rvsolutions.in

Best regards,
Accounts Department
RV Solutions Private Limited
Email: gsthelpdesk@rvsolutions.in
`;

    // Get CC emails from environment or use default
    const ccEmails = process.env.EMAIL_CC ? 
      process.env.EMAIL_CC.split(',').filter(email => email.trim()) : 
      ['gsthelpdesk@rvsolutions.in'];
    
    // Get BCC emails from environment
    const bccEmails = process.env.EMAIL_BCC ? 
      process.env.EMAIL_BCC.split(',').filter(email => email.trim()) : 
      [];

    // Prepare email options
    const mailOptions = {
      from: '"RV Solutions Accounts" <harpindersingh529@gmail.com>',
      to: mismatchData.email,
      cc: ccEmails.join(','),
      bcc: bccEmails.join(','),
      replyTo: process.env.REPLY_TO || 'gsthelpdesk@rvsolutions.in',
      subject: `GST Reconciliation Discrepancy - ${mismatchData.tradeName} (${mismatchData.gstin})`,
      text: textContent,
      html: htmlContent,
    };

    console.log('Sending email with Gmail:', {
      to: mailOptions.to,
      cc: mailOptions.cc,
      subject: mailOptions.subject,
    });

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${mismatchData.email} via Gmail. ID:`, info.messageId);
    
    // Add delay to respect Gmail's rate limits (15-20 emails per minute)
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    return true;
    
  } catch (error) {
    console.error(`Failed to send email to ${mismatchData.email}:`, error);
    
    // FIXED: Proper error type checking
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Object && 'code' in error ? String(error.code) : '';
    
    // If it's a rate limit error, wait longer before retrying
    if (errorCode === 'EENVELOPE' || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      console.log('Rate limit detected, waiting 60 seconds...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    
    return false;
  }
}

export function prepareMismatchEmails(
  mismatchedResults: Array<{
    gstin: string;
    tradeName: string;
    email: string;
    mismatchedInvoices: Array<{
      invoiceNumber: string;
      invoiceDate: string;
      bookInvoiceValue: number;
      bookTaxableValue: number;
      bookIGST: number;
      bookCGST: number;
      bookSGST: number;
      gstrInvoiceValue: number;
      gstrTaxableValue: number;
      gstrIGST: number;
      gstrCGST: number;
      gstrSGST: number;
      difference: number;
    }>;
  }>
): MismatchData[] {
  return mismatchedResults.map(result => ({
    ...result,
    totalDifference: result.mismatchedInvoices.reduce((sum, inv) => sum + inv.difference, 0),
  }));
}
