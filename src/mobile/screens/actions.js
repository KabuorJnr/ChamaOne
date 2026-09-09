/* Shared non-UI actions used across screens. */

// Send a reminder to every member who hasn't fully paid this cycle.
// In LIVE mode this would hit your SMS/WhatsApp provider; here it drops an
// in-app notification per member and returns the count.
export function remindUnpaid(store) {
  const cy = store.activeCycle().id;
  const unpaid = store.members().filter((m) => store.memberStatus(m.id, cy).state !== 'paid');
  unpaid.forEach((m) => store.notify('money', `Reminder sent to ${m.name} (${store.displayPhone(m.phone)}).`));
  return unpaid.length;
}
