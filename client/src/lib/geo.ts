import type { LatLngExpression } from "leaflet";

/** Convert route polyline [lng, lat][] to Leaflet [lat, lng][] */
export function toLeafletLatLngs(poly: [number, number][]): LatLngExpression[] {
  return poly.map(([lng, lat]) => [lat, lng] as LatLngExpression);
}
