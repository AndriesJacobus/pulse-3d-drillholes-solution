export function buildGoogleMapsUrl(points: { latitude: number; longitude: number }[]): string {
  if (points.length === 0) return 'https://www.google.com/maps';
  const stops = points.map((p) => `${p.latitude},${p.longitude}`).join('/');
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const centLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  return `https://www.google.com/maps/dir/${stops}/@${centLat},${centLon},15z/data=!4m2!4m1!3e2`;
}
