// Parser for Indian bank transaction alert SMS (covers UPI from any app: GPay, PhonePe, Paytm…)
const AMT = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
const DEBIT = /\b(debited|debit|spent|paid|sent|withdrawn|purchase|dr\.?|deducted|transferred to|payment of)\b/i;
const CREDIT = /\b(credited|credit|received|deposited|cr\.?|refund(?:ed)?|added to)\b/i;
const IGNORE = /\b(otp|one time password|verification code|will be debited|due on|due date|min(?:imum)? amount due|statement|request(?:ed)? money|collect request|is pending|failed|declined|reversed|emi of .* due|pre-?approved|offer|cashback up to|win|loan up to)\b/i;

function pickMerchant(body) {
  const b = body.replace(/\s+/g, ' ');
  const pats = [
    /(?:to|trf to|paid to|sent to)\s+(?:vpa\s+)?([A-Za-z0-9.\-_]+@[A-Za-z]+)/i, // VPA
    /(?:to|trf to|paid to|sent to|towards)\s+([A-Za-z][A-Za-z0-9 &.'\-]{2,40}?)(?:\s+(?:on|ref|upi|via|a\/c|avl|from|\.|,)|$)/i,
    /(?:at|@)\s+([A-Za-z][A-Za-z0-9 &.'\-]{2,40}?)(?:\s+(?:on|ref|txn|avl|\.|,)|$)/i,
    /(?:from|by)\s+(?:vpa\s+)?([A-Za-z0-9.\-_]+@[A-Za-z]+)/i,
    /(?:from|by)\s+([A-Za-z][A-Za-z0-9 &.'\-]{2,40}?)(?:\s+(?:on|ref|upi|via|a\/c|avl|\.|,)|$)/i,
    /info[:\-\s]+([A-Za-z0-9 *&.@\/\-]{3,40})/i,
  ];
  for (const p of pats) {
    const m = b.match(p);
    if (m && m[1]) {
      const v = m[1].trim().replace(/\s+(a\/c|ac|acct).*$/i, '');
      if (!/^(your|a\/c|ac|account|xx|x+\d+|upi|bank)\b/i.test(v)) return v;
    }
  }
  return '';
}

export function parseSms(body, ts) {
  if (!body) return null;
  const text = body.replace(/\s+/g, ' ');
  if (IGNORE.test(text)) return null;
  const am = text.match(AMT);
  if (!am) return null;
  const amount = parseFloat(am[1].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;
  const d = text.search(DEBIT);
  const c = text.search(CREDIT);
  let direction = null;
  if (d >= 0 && (c < 0 || d < c)) direction = 'debit';
  else if (c >= 0) direction = 'credit';
  if (!direction) return null;
  // Guard: "Avl Bal Rs 5,000" might be the first amount; prefer the amount nearest the verb
  let amt = amount;
  const all = [...text.matchAll(new RegExp(AMT.source, 'gi'))];
  if (all.length > 1) {
    const verbPos = direction === 'debit' ? d : c;
    const notBal = all.filter((m) => !/(bal|balance|limit)[^0-9]{0,15}$/i.test(text.slice(Math.max(0, m.index - 20), m.index)));
    const best = (notBal.length ? notBal : all).sort((a, b) => Math.abs(a.index - verbPos) - Math.abs(b.index - verbPos))[0];
    amt = parseFloat(best[1].replace(/,/g, ''));
  }
  return { amount: amt, direction, merchant: pickMerchant(text), ts: ts || Date.now(), raw: body };
}

export function smsKey(body, ts) {
  let h = 0;
  const s = `${Math.floor((ts || 0) / 60000)}|${body}`;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'sms' + (h >>> 0).toString(36);
}

// Guess a category from merchant text
const HINTS = [
  [/swiggy|zomato|restaurant|cafe|food|domino|pizza|kfc|mcdonald|burger|canteen|mess|chai|bakery|eatclub|dunzo/i, 'Food'],
  [/blinkit|zepto|bigbasket|instamart|dmart|grocery|jiomart|kirana|supermarket/i, 'Groceries'],
  [/uber|ola|rapido|irctc|redbus|metro|railway|petrol|fuel|indigo|air ?india|makemytrip|fastag|bpcl|hpcl|iocl/i, 'Travel'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|shop/i, 'Shopping'],
  [/netflix|spotify|hotstar|prime|youtube|bookmyshow|pvr|inox|steam|playstation|jiocinema|sonyliv/i, 'Entertainment'],
  [/airtel|jio|vodafone|vi |bsnl|electricity|bescom|mseb|broadband|recharge|gas|water bill|rent/i, 'Bills'],
  [/gym|cult|fitness|decathlon/i, 'Fitness'],
  [/udemy|coursera|book|college|iit|fees|exam|nptel/i, 'Education'],
];
export function guessCategory(merchant, cats) {
  for (const [re, name] of HINTS) {
    if (re.test(merchant || '')) {
      const c = cats.find((x) => x.name === name);
      if (c) return c;
    }
  }
  return null;
}
