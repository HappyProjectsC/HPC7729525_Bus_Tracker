import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";

interface BusInfo {
  _id: string;
  label: string;
  isTracking?: boolean;
}

export function DriverPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [bus, setBus] = useState<BusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [socketFallback, setSocketFallback] = useState(false);
  const socket = useSocket(accessToken, tracking && !!bus?._id);

  const load = useCallback(async () => {
    const { data } = await api.get<{ data: BusInfo | null }>("/api/driver/me/bus");
    setBus(data.data);
    setTracking(!!data.data?.isTracking);
  }, []);

  useEffect(() => {
    load()
      .catch(() => setMsg("Could not load bus"))
      .finally(() => setLoading(false));
  }, [load]);

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
        () => setMsg("GPS error — check browser permissions"),
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
      );
    };
    tick();
    intervalRef.current = setInterval(tick, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tracking, bus?._id, sendLocation]);

  async function start(): Promise<void> {
    setMsg(null);
    await api.post("/api/driver/tracking/start");
    setTracking(true);
    await load();
  }

  async function stop(): Promise<void> {
    setMsg(null);
    await api.post("/api/driver/tracking/stop");
    setTracking(false);
    await load();
  }

  if (loading) {
    return <p className="text-slate-600">Loading…</p>;
  }

  if (!bus) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900">
        <p className="font-medium">No bus assigned</p>
        <p className="text-sm mt-2">Ask an administrator to assign you as the driver of a bus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-800">Driver</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <p>
          <span className="text-slate-500">Bus</span>{" "}
          <span className="font-medium">{bus.label}</span>
        </p>
        {socketFallback && tracking && (
          <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Live connection lost — sending location via backup HTTP until reconnected.
          </p>
        )}
        {msg && <p className="text-red-600 text-sm">{msg}</p>}
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
        <p className="text-xs text-slate-500">
          Location is sent about every 8 seconds while tracking is on. Allow location access when
          prompted.
        </p>
      </div>
    </div>
  );
}
