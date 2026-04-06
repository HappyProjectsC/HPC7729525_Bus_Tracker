export interface Stop {
  _id: string;
  name: string;
  order: number;
  location: { coordinates: [number, number] };
}

/** From API when route has a polyline; otherwise `unknown`. */
export type EtaRelativeToBus = "approaching" | "passed" | "unknown";

export interface Eta {
  stopId: string;
  name: string;
  order: number;
  distanceMeters: number;
  etaMinutes: number;
  relativeToBus: EtaRelativeToBus;
}

export type BusStatus = "idle" | "active" | "maintenance";

export interface MyBusPayload {
  bus: {
    _id: string;
    label: string;
    status?: BusStatus;
    lastLocation?: { coordinates?: [number, number] };
    route?: unknown;
  };
  route: { name: string; polyline?: [number, number][]; avgSpeedKmh?: number } | null;
  stops: Stop[];
  etas: Eta[];
  boardingStop: { _id: string; name: string; order: number } | null;
}
