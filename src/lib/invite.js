/* =====================================================================
 * ChamaOne — lib/invite.js
 * Member onboarding invites: the public app URL, the WhatsApp message a
 * chairperson sends, and the wa.me deep link that opens it pre-filled.
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

export function inviteMessage({ groupName, memberName, code }) {
  const who = memberName ? `Karibu ${memberName}!` : 'Karibu!';
  return [
    `${who} You've been added to "${groupName}" on ChamaOne.`,
    '',
    'To join:',
    `1. Open ${siteUrl()}`,
    '2. Create your account (your name and a password)',
    `3. Enter your invite code: ${code}`,
    '',
    "You'll then see the group's contributions, loans and meetings.",
  ].join('\n');
}

// wa.me deep link. Phone is stored normalized (2547…), which is what wa.me wants.
export function whatsappInviteUrl({ phone, groupName, memberName, code }) {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(inviteMessage({ groupName, memberName, code }));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
