import { useEffect, useRef, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Smooth interpolation toward latest GPS target (ease in-out). */
export function useInterpolatedPosition(target: LatLng | null, durationMs = 650): LatLng | null {
  const [display, setDisplay] = useState<LatLng | null>(null);
  const displayRef = useRef<LatLng | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!target) {
      displayRef.current = null;
      setDisplay(null);
      return;
    }
    const from = displayRef.current ?? target;
    const t0 = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / durationMs);
      const e = u * u * (3 - 2 * u);
      const next = {
        lat: from.lat + (target.lat - from.lat) * e,
        lng: from.lng + (target.lng - from.lng) * e,
      };
      displayRef.current = next;
      setDisplay(next);
      if (u < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target?.lat, target?.lng, durationMs]);

  return display;
}
