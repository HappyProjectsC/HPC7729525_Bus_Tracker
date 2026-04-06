import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function MapRecenter({ center }: { center: [number, number] }): null {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1], map]);
  return null;
}
