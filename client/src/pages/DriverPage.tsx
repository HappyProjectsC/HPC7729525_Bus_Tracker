import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useSocket } from "../hooks/useSocket";
import { toLeafletLatLngs } from "../lib/geo";
import { MapRecenter } from "../components/MapRecenter";
import { SkeletonCard } from "../components/Skeleton";

interface DriverBus {
  _id: string;
  label: string;
  isTracking?: boolean;
  route?: { polyline?: [number, number][]; name?: string } | null;
}

export function DriverPage(): React.ReactElement {
  const { toast } = useToast();
  const { accessToken } = useAuth();
  const [bus, setBus] = useState<DriverBus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [faultText, setFaultText] = useState("");
  const [faultMsg, setFaultMsg] = useState<string | null>(null);
  const [socketFallback, setSocketFallback] = useState(false);
  const [mapPos, setMapPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const socket = useSocket(accessToken, tracking && !!bus?._id);

  const load = useCallback(async () => {
    const { data } = await api.get<{ data: DriverBus | null }>("/api/driver/me/bus");
    setBus(data.data);
    setTracking(!!data.data?.isTracking);
  }, []);

  useEffect(() => {
    void load()
      .catch(() => toast.error("Could not load bus"))
      .finally(() => setLoading(false));
  }, [load, toast]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = (): void => setSocketFallback(false);
    const onDisconnect = (): void => setSocketFallback(true);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setSocketFallback(!socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendLocation = useCallback(
    (lat: number, lng: number, speed?: number | null) => {
      if (!bus?._id) return;
      const payload = {
        busId: bus._id,
        lat,
        lng,
        speedKmh: speed != null && !Number.isNaN(speed) ? speed * 3.6 : undefined,
        recordedAt: Date.now(),
      };
      if (socket?.connected) {
        socket.emit("driver:location", payload, (err?: { message: string }) => {
          if (err?.message) {
            void api.post("/api/location", payload).catch(() => {});
          }
        });
      } else {
        void api.post("/api/location", payload).catch(() => {});
      }
    },
    [bus?._id, socket]
  );

  useEffect(() => {
    if (!tracking || !bus?._id) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const tick = (): void => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.speed);
        },
        () => toast.error("GPS error — check browser permissions"),
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
      );
    };
    tick();
    intervalRef.current = setInterval(tick, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tracking, bus?._id, sendLocation, toast]);

  useEffect(() => {
    if (!tracking) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setMapPos(null);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setMapPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => toast.error("Could not get position for map"),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
    watchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [tracking, toast]);

  async function start(): Promise<void> {
    await api.post("/api/driver/tracking/start");
    setTracking(true);
    await load();
    toast.success("Tracking started");
  }

  async function stop(): Promise<void> {
    await api.post("/api/driver/tracking/stop");
    setTracking(false);
    await load();
    toast.info("Tracking stopped");
  }

  async function submitFault(): Promise<void> {
    setFaultMsg(null);
    const t = faultText.trim();
    if (!t) return;
    try {
      await api.post("/api/driver/fault", { message: t });
      setFaultText("");
      setFaultMsg("Report sent to students and parents on this bus.");
      toast.success("Fault report sent");
    } catch {
      setFaultMsg("Could not send report.");
      toast.error("Could not send report");
    }
  }

  const polyline = useMemo(() => {
    const p = bus?.route?.polyline;
    if (!p?.length) return [] as [number, number][];
    return toLeafletLatLngs(p);
  }, [bus?.route?.polyline]);

  const mapCenter = useMemo((): [number, number] => {
    if (mapPos) return [mapPos.lat, mapPos.lng];
    if (polyline.length) {
      const [lat, lng] = polyline[0] as [number, number];
      return [lat, lng];
    }
    return [12.9716, 77.5946];
  }, [mapPos, polyline]);

  if (loading) {
    return <SkeletonCard />;
  }

  if (!bus) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-900 dark:text-amber-100">
        <p className="font-medium">No bus assigned</p>
        <p className="text-sm mt-2">Ask an administrator to assign you as the driver of a bus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Driver</h1>
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600 p-6 shadow-sm space-y-4">
        <p>
          <span className="text-slate-500">Bus</span>{" "}
          <span className="font-medium">{bus.label}</span>
        </p>
        {bus.route?.name && (
          <p className="text-sm text-slate-600 dark:text-slate-400">Route: {bus.route.name}</p>
        )}
        {socketFallback && tracking && (
          <p className="text-amber-800 dark:text-amber-200 text-sm bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Live connection lost — sending location via backup HTTP until reconnected.
          </p>
        )}
        <div className="flex gap-3">
          {!tracking ? (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 font-medium hover:bg-emerald-700"
              onClick={() => void start()}
            >
              Start tracking
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
              onClick={() => void stop()}
            >
              Stop tracking
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Location is sent about every 8 seconds while tracking is on. Allow location access when prompted.
        </p>
      </div>

      {tracking && (
        <div className="h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm z-0">
          <MapContainer center={mapCenter} zoom={14} className="h-full w-full" scrollWheelZoom>
            <MapRecenter center={mapCenter} />
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polyline.length > 1 && (
              <Polyline positions={polyline} pathOptions={{ color: "#2563eb", weight: 4 }} />
            )}
            {mapPos && (
              <Marker position={[mapPos.lat, mapPos.lng]}>
                <Popup>You are here (GPS)</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600 p-6 shadow-sm space-y-3">
        <h2 className="font-medium text-slate-800 dark:text-slate-100">Report an issue</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Breakdown, delay, or other problems — students and parents on this bus are notified.
        </p>
        <textarea
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[88px]"
          placeholder="Describe the situation…"
          value={faultText}
          onChange={(e) => setFaultText(e.target.value)}
        />
        {faultMsg && <p className="text-sm text-green-700 dark:text-green-400">{faultMsg}</p>}
        <button
          type="button"
          className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          disabled={!faultText.trim()}
          onClick={() => void submitFault()}
        >
          Send alert to bus
        </button>
      </div>
    </div>
  );
}
