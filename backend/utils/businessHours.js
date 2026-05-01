/**
 * Stall open hours use 24h "HH:mm" strings, evaluated in Asia/Colombo.
 * Closed interval semantics: same-day uses [open, close) half-open minutes; overnight when open > close uses [open, dayEnd) ∪ [0, close).
 */

const TZ = process.env.STALL_TIMEZONE || 'Asia/Colombo';

function normalizeTimeInput(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return false;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function minutesFromHm(hm) {
  if (!hm || typeof hm !== 'string') return null;
  const parts = hm.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const min = Number(parts[1]);
  return h * 60 + min;
}

function minuteOfDayInZone(date = new Date(), timeZone = TZ) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour').value);
    const minute = Number(parts.find((p) => p.type === 'minute').value);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

function deriveStatusFromHours(openHm, closeHm, now = new Date()) {
  const o = minutesFromHm(openHm);
  const c = minutesFromHm(closeHm);
  const nowMin = minuteOfDayInZone(now);
  if (o === null || c === null || nowMin === null) return null;
  if (o === c) return 'Closed';

  let openWithin;
  if (o < c) {
    openWithin = nowMin >= o && nowMin < c;
  } else {
    openWithin = nowMin >= o || nowMin < c;
  }

  return openWithin ? 'Open' : 'Closed';
}

async function persistAutoStatusForStall(StallModel, stallDoc, now = new Date()) {
  if (!stallDoc) return null;
  if (!stallDoc.hoursAuto || !stallDoc.openingTime || !stallDoc.closingTime) return stallDoc;
  const next = deriveStatusFromHours(stallDoc.openingTime, stallDoc.closingTime, now);
  if (!next || stallDoc.status === next) return stallDoc;

  stallDoc.status = next;
  await stallDoc.save();
  return stallDoc;
}

module.exports = {
  TZ,
  normalizeTimeInput,
  deriveStatusFromHours,
  persistAutoStatusForStall,
  minuteOfDayInZone,
};
