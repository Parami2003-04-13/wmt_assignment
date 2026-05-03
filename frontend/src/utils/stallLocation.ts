export function hasValidStallCoordinates(latitude: unknown, longitude: unknown): boolean {
  const la = Number(latitude);
  const lo = Number(longitude);
  return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

export function openStallInMaps(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
