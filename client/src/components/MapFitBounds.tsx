import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Fits the map to show every point when the set of tracked bus ids changes (new/removed buses).
 * Does not re-fit on every GPS tick so the view stays stable while markers move.
 */
export function MapFitBounds({
  busIdsKey,
  points,
}: {
  busIdsKey: string;
  points: [number, number][];
}): null {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    const pts = pointsRef.current;
    if (!busIdsKey || pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
  }, [busIdsKey, map]);

  return null;
}
