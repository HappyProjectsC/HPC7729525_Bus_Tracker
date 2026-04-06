import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup } from "react-leaflet";
import { MapRecenter } from "../components/MapRecenter";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { useInterpolatedPosition, type LatLng } from "../hooks/useInterpolatedPosition";
import { toLeafletLatLngs } from "../lib/geo";
import { EtaList } from "../components/EtaList";
import { SkeletonCard } from "../components/Skeleton";
import type { BusStatus, MyBusPayload } from "../types/bus";
import { PushNotifyButton } from "./student/PushNotifyButton";

function BusStatusChip({ status }: { status?: BusStatus }): React.ReactElement {
  const s = status ?? "idle";
  const cls =
    s === "active"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : s === "maintenance"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
        : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {s}
    </span>
  );
}

export function ParentPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [data, setData] = useState<MyBusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState<LatLng | null>(null);
  const [faultMsg, setFaultMsg] = useState<string | null>(null);
  const busId = data?.bus._id;
  const socket = useSocket(accessToken, !!busId);

  const load = useCallback(async () => {
    const { data: res } = await api.get<{ data: MyBusPayload | null }>("/api/parent/my-bus");
    setData(res.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setErr("Could not load bus information"))
      .finally(() => setLoading(false));
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
    const onLoc = (p: { busId: string; lat: number; lng: number }): void => {
      if (p.busId === busId) {
        setLive({ lat: p.lat, lng: p.lng });
      }
    };
    const onFault = (p: { busId: string; message: string }): void => {
      if (p.busId === busId) setFaultMsg(p.message);
    };
    socket.on("bus:location", onLoc);
    socket.on("bus:fault", onFault);
    return () => {
      socket.off("bus:location", onLoc);
      socket.off("bus:fault", onFault);
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
    return <p className="text-red-600 dark:text-red-400">{err}</p>;
  }

  if (loading && !data) {
    return <SkeletonCard />;
  }

  if (!data?.bus) {
    return (
      <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-6 text-slate-700 dark:text-slate-200">
        <p className="font-medium">No bus to show</p>
        <p className="text-sm mt-2">
          Your student must be assigned to a bus by an administrator for you to see live tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          Child&apos;s bus: {data.bus.label}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <BusStatusChip status={data.bus.status} />
          {data.route && (
            <span className="text-sm text-slate-600 dark:text-slate-400">Route: {data.route.name}</span>
          )}
        </div>
      </div>
      {faultMsg && (
        <div
          className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-amber-900 dark:text-amber-100 flex justify-between gap-3 items-start shadow-sm transition-all duration-200"
          role="alert"
        >
          <span className="flex gap-2">
            <span className="text-xl shrink-0" aria-hidden>
              ⚠️
            </span>
            <span>
              <strong>Driver update:</strong> {faultMsg}
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 text-sm font-medium rounded-lg px-2 py-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/40"
            onClick={() => setFaultMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {data.boardingStop && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4 text-sm text-slate-700 dark:text-slate-200">
          Student boarding stop:{" "}
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {data.boardingStop.name} (stop {data.boardingStop.order + 1})
          </span>
        </div>
      )}
      <div className="h-[420px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm">
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
                  {isBoarding && (
                    <span className="block text-green-700 dark:text-green-400 font-medium">
                      Student boarding stop
                    </span>
                  )}
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
        <EtaList
          etas={data.etas}
          boardingStopId={data.boardingStop?._id ?? null}
          yourStopLabel="(student stop)"
        />
      )}
    </div>
  );
}
