import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup } from "react-leaflet";
import { MapRecenter } from "../components/MapRecenter";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { useInterpolatedPosition, type LatLng } from "../hooks/useInterpolatedPosition";
import { toLeafletLatLngs } from "../lib/geo";
import { fieldErrorsFromAxios, formErrorFromAxios } from "../lib/apiErrors";
import { EtaList } from "../components/EtaList";
import { SkeletonCard } from "../components/Skeleton";
import type { BusStatus, MyBusPayload, Stop } from "../types/bus";
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

export function StudentPage(): React.ReactElement {
  const { accessToken, user, refreshUser } = useAuth();
  const [data, setData] = useState<MyBusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState<LatLng | null>(null);
  const [faultMsg, setFaultMsg] = useState<string | null>(null);
  const [showParentForm, setShowParentForm] = useState(false);
  const busId = data?.bus._id;
  const socket = useSocket(accessToken, !!busId);

  const load = useCallback(async () => {
    const { data: res } = await api.get<{ data: MyBusPayload | null }>("/api/student/my-bus");
    setData(res.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setErr("Could not load assignment"))
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
    const onLoc = (p: {
      busId: string;
      lat: number;
      lng: number;
    }): void => {
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
        <p className="font-medium">No bus assigned</p>
        <p className="text-sm mt-2">An administrator must assign a bus to your student account.</p>
      </div>
    );
  }

  const hasParent = Boolean(user?.linkedParent);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">My bus: {data.bus.label}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <BusStatusChip status={data.bus.status} />
          {data.route && (
            <span className="text-sm text-slate-600 dark:text-slate-400">Route: {data.route.name}</span>
          )}
        </div>
      </div>

      {!hasParent && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
            onClick={() => setShowParentForm(true)}
          >
            Add my parent
          </button>
        </div>
      )}
      {hasParent && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">A parent account is linked to your profile.</p>
      )}

      {showParentForm && (
        <AddParentModal
          onClose={() => setShowParentForm(false)}
          onSuccess={async () => {
            setShowParentForm(false);
            await refreshUser();
          }}
        />
      )}

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

      {data.stops.length > 0 && (
        <BoardingStopSelect
          stops={data.stops}
          boardingStopId={data.boardingStop?._id ?? null}
          onSaved={load}
        />
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
                    <span className="block text-green-700 dark:text-green-400 font-medium">Your boarding stop</span>
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
      <StudentFeedbackForm />
      {data.etas.length > 0 && (
        <EtaList
          etas={data.etas}
          boardingStopId={data.boardingStop?._id ?? null}
          yourStopLabel="(your stop)"
        />
      )}
    </div>
  );
}

function AddParentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}): React.ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFieldErr({});
    setFormErr(null);
    setLoading(true);
    try {
      await api.post("/api/student/parent", { name, email, password, confirmPassword });
      await onSuccess();
    } catch (err) {
      const fe = fieldErrorsFromAxios(err);
      if (Object.keys(fe).length) setFieldErr(fe);
      else setFormErr(formErrorFromAxios(err) ?? "Could not add parent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 max-w-md w-full p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Add parent account</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Creates a parent login with the email and password you set. One parent per student.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          {formErr && <p className="text-sm text-red-600">{formErr}</p>}
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Parent name</label>
            <input
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErr.name && <p className="text-sm text-red-600 mt-1">{fieldErr.name}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Parent email</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErr.email && <p className="text-sm text-red-600 mt-1">{fieldErr.email}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              required
              type="password"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErr.password && <p className="text-sm text-red-600 mt-1">{fieldErr.password}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Confirm password</label>
            <input
              required
              type="password"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {fieldErr.confirmPassword && (
              <p className="text-sm text-red-600 mt-1">{fieldErr.confirmPassword}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create parent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StudentFeedbackForm(): React.ReactElement {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErr(null);
    setStatus(null);
    try {
      await api.post("/api/student/feedback", { message });
      setMessage("");
      setStatus("Thanks — your feedback was sent to administrators.");
    } catch (error) {
      const fe = fieldErrorsFromAxios(error);
      setErr(fe.message ?? formErrorFromAxios(error) ?? "Could not send feedback.");
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4">
      <h2 className="font-medium text-slate-800 dark:text-slate-100 mb-2">Bus feedback</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Report issues about this bus (cleanliness, timing, etc.). Admins can reply in the app.
      </p>
      <form onSubmit={(e) => void submit(e)} className="space-y-2">
        <textarea
          required
          rows={3}
          placeholder="Describe the issue…"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {status && <p className="text-sm text-green-700 dark:text-green-400">{status}</p>}
        <button
          type="submit"
          className="rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 text-sm font-medium"
        >
          Send feedback
        </button>
      </form>
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
  const [localErr, setLocalErr] = useState<string | null>(null);
  const value = boardingStopId ?? "";

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    const v = e.target.value;
    setLocalErr(null);
    setSaving(true);
    try {
      await api.patch("/api/student/boarding-stop", {
        stopId: v === "" ? null : v,
      });
      await onSaved();
    } catch {
      setLocalErr("Could not save boarding stop.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4">
      <label htmlFor="boarding-stop" className="block text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">
        Where I board
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        Push alerts only for this stop when set. Leave as “All stops” to get alerts at every stop.
      </p>
      <select
        id="boarding-stop"
        className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
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
      {localErr && <p className="text-sm text-red-600 mt-1">{localErr}</p>}
    </div>
  );
}
