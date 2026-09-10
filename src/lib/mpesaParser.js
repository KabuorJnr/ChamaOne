/* =====================================================================
 * ChamaOne — lib/mpesaParser.js
 * Client-side M-Pesa SMS message extractor (zero permissions needed).
 * ===================================================================== */

export function parseMpesaSms(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text) return null;

  // 1. Transaction code: e.g. "QWX72918AB" (typically 10 alphanumeric characters)
  const codeMatch =
    text.match(/\b([A-Z0-9]{8,12})\s+Confirmed/i) ||
    text.match(/^([A-Z0-9]{8,12})\b/i) ||
    text.match(/\b([A-Z0-9]{8,12})\b/i);
  const code = codeMatch ? codeMatch[1].toUpperCase() : '';

  // 2. Amount: e.g. "Ksh1,000.00", "Ksh 500", "KES 2,500.00"
  const amountMatch = text.match(/(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  let amount = null;
  if (amountMatch) {
    const cleanNum = amountMatch[1].replace(/,/g, '');
    const n = parseFloat(cleanNum);
    if (!isNaN(n) && n > 0) amount = n;
  }

  // 3. Date and Time: e.g. "on 10/9/26 at 4:58 PM"
  const dateMatch = text.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
  let dateStr = '';
  if (dateMatch) {
    dateStr = `${dateMatch[1]} at ${dateMatch[2]}`;
  }

  // 4. Recipient name / till / paybill
  const recipientMatch =
    text.match(/sent to\s+([A-Z\s]+?)(?:\s+\d{10}|\s+on\s+)/i) ||
    text.match(/paid to\s+([A-Z0-9\s\.]+?)(?:\s+on\s+)/i);
  const recipient = recipientMatch ? recipientMatch[1].trim() : '';

  return {
    code,
    amount,
    dateStr,
    recipient,
    valid: !!(code || amount),
  };
}
