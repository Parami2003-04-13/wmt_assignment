/** Normalizes scanned or typed pickup codes for comparison with `orderId`. */
export function normalizePickupCode(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  if (!s) return '';
  try {
    const j = JSON.parse(s) as { orderId?: string };
    if (j && typeof j.orderId === 'string') s = j.orderId;
  } catch {
    /* use raw string */
  }
  return s.replace(/\s+/g, '').toUpperCase();
}

/** True if QR / manual payload matches this order's public order id (e.g. ORD-xxx). */
export function pickupCodeMatchesOrder(expectedOrderId: string, scannedRaw: unknown): boolean {
  const expected = normalizePickupCode(expectedOrderId);
  if (!expected) return false;
  const n = normalizePickupCode(scannedRaw);
  if (!n) return false;
  if (n === expected) return true;
  if (n.includes(expected)) return true;
  return false;
}
