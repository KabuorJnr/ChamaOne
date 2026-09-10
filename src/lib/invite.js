/* =====================================================================
 * ChamaOne — lib/invite.js
 * Member onboarding invites: public app URL, shareable join links,
 * WhatsApp deep links, and join-code URL extractors.
 * ===================================================================== */

// Where members should go to sign up. Uses the current web origin when we're
// on the web; native builds fall back to the configured public URL.
export function siteUrl() {
  const configured = import.meta.env.VITE_PUBLIC_URL;
  if (configured) return String(configured).replace(/\/+$/, '');
  try {
    const o = window.location.origin;
    if (/^https?:/i.test(o)) return o.replace(/\/+$/, '');
  } catch { /* native scheme */ }
  return 'https://chama-one-ten.vercel.app';
}

/** Build a direct one-click join link for a Chama. */
export function makeInviteLink(code) {
  const clean = (code || '').trim().toUpperCase();
  return `${siteUrl()}/?join=${encodeURIComponent(clean)}`;
}

/**
 * Extract a 4-10 char join code from either a raw code or a full URL
 * e.g. "https://chama-one-ten.vercel.app/?join=7QK2M9" -> "7QK2M9"
 */
export function extractJoinCode(input) {
  if (!input) return '';
  const str = String(input).trim();
  try {
    if (str.includes('http://') || str.includes('https://') || str.includes('?join=') || str.includes('?code=') || str.includes('&join=')) {
      const parsed = new URL(str.startsWith('http') ? str : `https://chama-one-ten.vercel.app/${str}`);
      const c = parsed.searchParams.get('join') || parsed.searchParams.get('code') || parsed.searchParams.get('invite');
      if (c) return c.trim().toUpperCase();
    }
  } catch { /* fallback to regex */ }

  const match = str.match(/([A-Z0-9]{4,10})/i);
  return match ? match[1].toUpperCase() : str.trim().toUpperCase();
}

/** Pre-composed WhatsApp / SMS invite message with clickable join link. */
export function inviteMessage({ groupName, memberName, code }) {
  const who = memberName ? `Karibu ${memberName}!` : 'Karibu!';
  const link = makeInviteLink(code);
  return [
    `${who} You're invited to join "${groupName || 'our Chama'}" on ChamaOne.`,
    '',
    'Tap this link to join immediately:',
    link,
    '',
    `(Or enter code: ${code || ''})`,
  ].join('\n');
}

/** wa.me deep link. Phone is stored normalized (2547…), which is what wa.me wants. */
export function whatsappInviteUrl({ phone, groupName, memberName, code }) {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(inviteMessage({ groupName, memberName, code }));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
