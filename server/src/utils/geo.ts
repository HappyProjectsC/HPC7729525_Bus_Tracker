/** Haversine distance in meters between two WGS84 points */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Approximate speed km/h between two points given time delta seconds */
export function impliedSpeedKmh(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  deltaSec: number
): number {
  if (deltaSec <= 0) return Infinity;
  const m = haversineMeters(lat1, lng1, lat2, lng2);
  return (m / 1000 / deltaSec) * 3600;
}

/** Cumulative length along polyline in meters */
export function polylineLengthMeters(points: [number, number][]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const [lng1, lat1] = points[i - 1];
    const [lng2, lat2] = points[i];
    sum += haversineMeters(lat1, lng1, lat2, lng2);
  }
  return sum;
}

/** Distance from point to segment [a,b], return min distance in meters */
function distPointToSegmentMeters(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return haversineMeters(py, px, ay, ax);
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  );
  const nx = ax + t * dx;
  const ny = ay + t * dy;
  return haversineMeters(py, px, ny, nx);
}

/** Minimum distance from point to polyline (meters) */
export function pointToPolylineDistanceMeters(
  lat: number,
  lng: number,
  polyline: [number, number][]
): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    const [lng0, lat0] = polyline[0];
    return haversineMeters(lat, lng, lat0, lng0);
  }
  let min = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    const [lng1, lat1] = polyline[i - 1];
    const [lng2, lat2] = polyline[i];
    const d = distPointToSegmentMeters(lng, lat, lng1, lat1, lng2, lat2);
    if (d < min) min = d;
  }
  return min;
}

/** Find index along polyline closest to bus; return progress 0-1 and distance along route to end */
export function progressAlongPolyline(
  lat: number,
  lng: number,
  polyline: [number, number][]
): { progress: number; distanceToEndM: number; distanceFromStartM: number } {
  if (polyline.length < 2) {
    return { progress: 0, distanceToEndM: 0, distanceFromStartM: 0 };
  }
  let bestI = 0;
  let bestDist = Infinity;
  let segStartM = 0;
  const segLens: number[] = [];
  for (let i = 1; i < polyline.length; i++) {
    const [lng1, lat1] = polyline[i - 1];
    const [lng2, lat2] = polyline[i];
    const len = haversineMeters(lat1, lng1, lat2, lng2);
    segLens.push(len);
    const d = distPointToSegmentMeters(lng, lat, lng1, lat1, lng2, lat2);
    if (d < bestDist) {
      bestDist = d;
      bestI = i - 1;
    }
  }
  let fromStart = 0;
  for (let i = 0; i < bestI; i++) fromStart += segLens[i] ?? 0;
  const [lngA, latA] = polyline[bestI];
  const [lngB, latB] = polyline[bestI + 1];
  const segLen = segLens[bestI] ?? 0;
  let t = 0;
  if (segLen > 0) {
    const dx = lngB - lngA;
    const dy = latB - latA;
    t = Math.max(0, Math.min(1, ((lng - lngA) * dx + (lat - latA) * dy) / (dx * dx + dy * dy)));
  }
  fromStart += t * segLen;
  const total = polylineLengthMeters(polyline);
  const toEnd = Math.max(0, total - fromStart);
  return {
    progress: total > 0 ? fromStart / total : 0,
    distanceToEndM: toEnd,
    distanceFromStartM: fromStart,
  };
}
