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
    console.log('Sending email via Gmail to:', mismatchData.email, 'for', mismatchData.tradeName);

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

    // Separate invoices by type for better clarity
    const missingInGSTR = mismatchData.mismatchedInvoices.filter(
      inv => inv.bookInvoiceValue > 0 && inv.gstrInvoiceValue === 0
    );
    
    const inGSTROnly = mismatchData.mismatchedInvoices.filter(
      inv => inv.bookInvoiceValue === 0 && inv.gstrInvoiceValue > 0
    );
    
    const amountMismatches = mismatchData.mismatchedInvoices.filter(
      inv => inv.bookInvoiceValue > 0 && inv.gstrInvoiceValue > 0
    );

    // Build different tables for different mismatch types
    let invoicesTable = '';
    
    // Table 1: Invoices ONLY in our books (missing in GSTR)
    if (missingInGSTR.length > 0) {
      invoicesTable += `
        <tr><td colspan="8" style="padding: 12px; background-color: #f8f9fa; font-weight: bold; border: 1px solid #ddd;">
          Invoices in our records but NOT found in GSTR-2B:
        </td></tr>
      `;
      
      invoicesTable += missingInGSTR.map(inv => {
        const invoiceAmount = inv.bookInvoiceValue;
        const gstAmount = inv.bookIGST + inv.bookCGST + inv.bookSGST;
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
    }
    
    // Table 2: Invoices ONLY in GSTR (not in our books) - WARNING
    if (inGSTROnly.length > 0) {
      invoicesTable += `
        <tr><td colspan="8" style="padding: 12px; background-color: #fff3cd; font-weight: bold; border: 1px solid #ffc107; color: #856404;">
          ⚠️ Invoices found in GSTR-2B but NOT in our records (Please verify if these are your invoices):
        </td></tr>
      `;
      
      invoicesTable += inGSTROnly.map(inv => {
        const invoiceAmount = inv.gstrInvoiceValue;
        const gstAmount = inv.gstrIGST + inv.gstrCGST + inv.gstrSGST;
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
    }
    
    // Table 3: Invoices in both but amounts differ
    if (amountMismatches.length > 0) {
      invoicesTable += `
        <tr><td colspan="8" style="padding: 12px; background-color: #f8d7da; font-weight: bold; border: 1px solid #dc3545; color: #721c24;">
          ⚠️ Invoices with amount discrepancies between our records and GSTR-2B:
        </td></tr>
      `;
      
      invoicesTable += amountMismatches.map(inv => {
        // For amount mismatches, show BOTH amounts
        const bookInvoiceAmount = inv.bookInvoiceValue;
        const gstrInvoiceAmount = inv.gstrInvoiceValue;
        const bookGST = inv.bookIGST + inv.bookCGST + inv.bookSGST;
        const gstrGST = inv.gstrIGST + inv.gstrCGST + inv.gstrSGST;
        const invoiceDate = inv.invoiceDate;
        
        return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">09AADCR9806P1ZL</td>
          <td style="padding: 8px; border: 1px solid #ddd;">RV Solutions Private Limited</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${mismatchData.tradeName}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${mismatchData.gstin}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${inv.invoiceNumber}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${invoiceDate}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">
            <div>Our Record: ₹${bookInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div>GSTR-2B: ₹${gstrInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div><strong>Diff: ₹${(bookInvoiceAmount - gstrInvoiceAmount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></div>
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">
            <div>Our Record: ₹${bookGST.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div>GSTR-2B: ₹${gstrGST.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div><strong>Diff: ₹${(bookGST - gstrGST).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></div>
          </td>
        </tr>
      `}).join('');
    }

    // Update email content with clearer message
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>GST Reconciliation - ${mismatchData.tradeName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th { background-color: #3498db; color: white; padding: 12px; text-align: left; }
          .legal-note { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
          .warning { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin: 20px 0; }
          .info { background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 12px; margin: 20px 0; }
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
            </div>
            
            <div class="info">
              <p><strong>GST Reconciliation Findings for ${mismatchData.tradeName} (GSTIN: ${mismatchData.gstin}):</strong></p>
              <ul>
                ${missingInGSTR.length > 0 ? `<li><strong>${missingInGSTR.length} invoices</strong> in our purchase records but NOT found in GSTR-2B</li>` : ''}
                ${inGSTROnly.length > 0 ? `<li><strong>${inGSTROnly.length} invoices</strong> found in GSTR-2B but NOT in our purchase records</li>` : ''}
                ${amountMismatches.length > 0 ? `<li><strong>${amountMismatches.length} invoices</strong> with amount discrepancies between our records and GSTR-2B</li>` : ''}
              </ul>
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
              <p><strong>Action Required:</strong></p>
              <p>1. For invoices <strong>missing in GSTR-2B</strong>: Please file GSTR-1 return to reflect these invoices</p>
              ${inGSTROnly.length > 0 ? `<p>2. For invoices <strong>found only in GSTR-2B</strong>: Please verify if these are your invoices and share supporting documents</p>` : ''}
              ${amountMismatches.length > 0 ? `<p>3. For invoices <strong>with amount discrepancies</strong>: Please reconcile the amounts and provide correct invoices</p>` : ''}
              <p><strong>• If any non-compliance is identified, a Debit note of GST Value with 18% interest will be raised.</strong></p>
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
