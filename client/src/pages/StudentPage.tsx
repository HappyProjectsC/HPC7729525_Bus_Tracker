import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup } from "react-leaflet";
import { MapRecenter } from "../components/MapRecenter";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { useInterpolatedPosition, type LatLng } from "../hooks/useInterpolatedPosition";
import { toLeafletLatLngs } from "../lib/geo";

interface Stop {
  _id: string;
  name: string;
  order: number;
  location: { coordinates: [number, number] };
}

interface Eta {
  stopId: string;
  name: string;
  order: number;
  distanceMeters: number;
  etaMinutes: number;
}

interface MyBusPayload {
  bus: {
    _id: string;
    label: string;
    lastLocation?: { coordinates?: [number, number] };
    route?: unknown;
  };
  route: { name: string; polyline?: [number, number][]; avgSpeedKmh?: number } | null;
  stops: Stop[];
  etas: Eta[];
  boardingStop: { _id: string; name: string; order: number } | null;
}

export function StudentPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [data, setData] = useState<MyBusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState<LatLng | null>(null);
  const busId = data?.bus._id;
  const socket = useSocket(accessToken, !!busId);

  const load = useCallback(async () => {
    const { data: res } = await api.get<{ data: MyBusPayload | null }>("/api/student/my-bus");
    setData(res.data);
  }, []);

  useEffect(() => {
    load().catch(() => setErr("Could not load assignment"));
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(), 45000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const coords = data?.bus.lastLocation?.coordinates;
    if (coords) {
      setLive({ lat: coords[1], lng: coords[0] });
    }
  }, [data?.bus.lastLocation]);

  useEffect(() => {
    if (!socket || !busId) return;
    socket.emit("subscribe:bus", { busId }, (e?: string) => {
      if (e) setErr("Cannot subscribe to live updates");
    });
    const onLoc = (p: {
      busId: string;
      lat: number;
      lng: number;
    }): void => {
      if (p.busId === busId) {
        setLive({ lat: p.lat, lng: p.lng });
      }
    };
    socket.on("bus:location", onLoc);
    return () => {
      socket.off("bus:location", onLoc);
    };
  }, [socket, busId]);

  const smooth = useInterpolatedPosition(live);

  const center = useMemo(() => {
    if (smooth) return [smooth.lat, smooth.lng] as [number, number];
    if (data?.stops?.[0]) {
      const [lng, lat] = data.stops[0].location.coordinates;
      return [lat, lng] as [number, number];
    }
    return [12.9716, 77.5946] as [number, number];
  }, [smooth, data?.stops]);

  const polyline = useMemo(() => {
    const p = data?.route?.polyline;
    if (!p?.length) return [];
    return toLeafletLatLngs(p);
  }, [data?.route?.polyline]);

  if (err && !data) {
    return <p className="text-red-600">{err}</p>;
  }

  if (!data?.bus) {
    return (
      <div className="bg-slate-100 rounded-xl p-6 text-slate-700">
        <p className="font-medium">No bus assigned</p>
        <p className="text-sm mt-2">An administrator must assign a bus to your student account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-800">My bus: {data.bus.label}</h1>
        {data.route && (
          <span className="text-sm text-slate-600">Route: {data.route.name}</span>
        )}
      </div>
      {data.stops.length > 0 && (
        <BoardingStopSelect
          stops={data.stops}
          boardingStopId={data.boardingStop?._id ?? null}
          onSaved={load}
        />
      )}
      <div className="h-[420px] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full">
          <MapRecenter center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {polyline.length > 1 && <Polyline positions={polyline} pathOptions={{ color: "#2563eb", weight: 4 }} />}
          {data.stops.map((s) => {
            const [lng, lat] = s.location.coordinates;
            const isBoarding = data.boardingStop?._id === s._id;
            return (
              <CircleMarker
                key={s._id}
                center={[lat, lng]}
                radius={isBoarding ? 11 : 8}
                pathOptions={{
                  color: isBoarding ? "#15803d" : "#0f172a",
                  fillColor: isBoarding ? "#bbf7d0" : "#fff",
                  fillOpacity: 0.95,
                }}
              >
                <Popup>
                  {s.name} (stop {s.order + 1})
                  {isBoarding && <span className="block text-green-700 font-medium">Your boarding stop</span>}
                </Popup>
              </CircleMarker>
            );
          })}
          {smooth && (
            <Marker position={[smooth.lat, smooth.lng]}>
              <Popup>Bus live position</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <PushNotifyButton />
      {data.etas.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-medium text-slate-800 mb-3">ETA to stops</h2>
          <ul className="divide-y divide-slate-100">
            {data.etas.map((e) => {
              const mine = data.boardingStop?._id === e.stopId;
              return (
                <li
                  key={e.stopId}
                  className={`py-2 flex justify-between text-sm ${mine ? "bg-emerald-50 -mx-4 px-4 rounded-lg" : ""}`}
                >
                  <span>
                    {e.name}
                    {mine && (
                      <span className="ml-2 text-xs font-medium text-emerald-800">(your stop)</span>
                    )}
                  </span>
                  <span className="text-slate-600">
                    {e.etaMinutes} min · {e.distanceMeters} m
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function BoardingStopSelect({
  stops,
  boardingStopId,
  onSaved,
}: {
  stops: Stop[];
  boardingStopId: string | null;
  onSaved: () => Promise<void>;
}): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const value = boardingStopId ?? "";

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    const v = e.target.value;
    setErr(null);
    setSaving(true);
    try {
      await api.patch("/api/student/boarding-stop", {
        stopId: v === "" ? null : v,
      });
      await onSaved();
    } catch {
      setErr("Could not save boarding stop.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <label htmlFor="boarding-stop" className="block text-sm font-medium text-slate-800 mb-1">
        Where I board
      </label>
      <p className="text-xs text-slate-500 mb-2">
        Push alerts only for this stop when set. Leave as “All stops” to get alerts at every stop.
      </p>
      <select
        id="boarding-stop"
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        value={value}
        disabled={saving}
        onChange={(e) => void onChange(e)}
      >
        <option value="">All stops (no filter)</option>
        {stops.map((s) => (
          <option key={s._id} value={s._id}>
            {s.order + 1}. {s.name}
          </option>
        ))}
      </select>
      {err && <p className="text-sm text-red-600 mt-1">{err}</p>}
    </div>
  );
}

function PushNotifyButton(): React.ReactElement {
  const [status, setStatus] = useState<string | null>(null);
  async function enable(): Promise<void> {
    setStatus(null);
    try {
      const { data: v } = await api.get<{ data: { publicKey: string | null } }>(
        "/api/notifications/vapid-public-key"
      );
      const key = v.data.publicKey;
      if (!key) {
        setStatus("Push is not configured on the server.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("Notifications blocked.");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await api.post("/api/notifications/subscribe", sub.toJSON());
      setStatus("Notifications enabled.");
    } catch {
      setStatus("Could not enable notifications.");
    }
  }
  if (!("Notification" in window)) return <></>;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        onClick={() => void enable()}
      >
        Enable stop alerts (push)
      </button>
      {status && <span className="text-sm text-slate-600">{status}</span>}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
