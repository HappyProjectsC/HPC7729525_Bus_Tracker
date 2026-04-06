import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { useSocket } from "../hooks/useSocket";
import { MapFitBounds } from "../components/MapFitBounds";
import { SkeletonCard } from "../components/Skeleton";
import { fieldErrorsFromAxios, formErrorFromAxios } from "../lib/apiErrors";

type Tab = "fleet" | "buses" | "routes" | "stops" | "users" | "faults";

type BusStatus = "idle" | "active" | "maintenance";

interface BusRow {
  _id: string;
  label: string;
  plate?: string;
  status?: BusStatus;
  assignedDriver?: { _id: string; name: string; email: string } | null;
  route?: { _id: string; name: string } | null;
  lastLocation?: { coordinates?: [number, number] };
  speedKmh?: number;
  heading?: number;
}

interface FaultFeedItem {
  id: string;
  busId: string;
  busLabel: string;
  driverName?: string;
  message: string;
  createdAt: string;
}

function BusStatusBadge({ status }: { status?: BusStatus }): React.ReactElement {
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

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  assignedBus?: { _id: string; label: string } | null;
  linkedStudent?: { _id: string; name: string; email: string } | null;
}

export function AdminPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("fleet");
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [routes, setRoutes] = useState<{ _id: string; name: string }[]>([]);
  const [admins, setAdmins] = useState<UserRow[]>([]);
  const [drivers, setDrivers] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<UserRow[]>([]);
  const [parents, setParents] = useState<UserRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [faultFeed, setFaultFeed] = useState<FaultFeedItem[]>([]);

  const refreshBuses = useCallback(async () => {
    const { data } = await api.get<{ data: { items: BusRow[] } }>("/api/admin/buses?limit=100");
    setBuses(data.data.items);
  }, []);

  const adminSocket = useSocket(accessToken, tab === "fleet" || tab === "faults");

  useEffect(() => {
    if (!adminSocket || (tab !== "fleet" && tab !== "faults")) return;
    adminSocket.emit("subscribe:admin", {}, () => {});
    const onLoc = (payload: {
      busId: string;
      lat: number;
      lng: number;
      speedKmh?: number;
      heading?: number;
    }): void => {
      setBuses((prev) => {
        const idx = prev.findIndex((b) => b._id === payload.busId);
        if (idx === -1) {
          void refreshBuses();
          return prev;
        }
        const next = [...prev];
        const cur = next[idx];
        next[idx] = {
          ...cur,
          lastLocation: { coordinates: [payload.lng, payload.lat] },
          speedKmh: payload.speedKmh ?? cur.speedKmh,
          heading: payload.heading ?? cur.heading,
        };
        return next;
      });
    };
    const onFault = (p: {
      busId: string;
      message: string;
      createdAt?: string;
      busLabel?: string;
      driverName?: string;
    }): void => {
      const id = `${p.busId}-${p.createdAt ?? Date.now()}-${Math.random()}`;
      setFaultFeed((prev) => [
        {
          id,
          busId: p.busId,
          busLabel: p.busLabel ?? "Bus",
          driverName: p.driverName,
          message: p.message,
          createdAt: p.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
    };
    adminSocket.on("bus:location", onLoc);
    adminSocket.on("bus:fault", onFault);
    return () => {
      adminSocket.off("bus:location", onLoc);
      adminSocket.off("bus:fault", onFault);
    };
  }, [adminSocket, tab, refreshBuses]);

  const refreshRoutes = useCallback(async () => {
    const { data } = await api.get<{ data: { items: { _id: string; name: string }[] } }>(
      "/api/admin/routes?limit=100"
    );
    setRoutes(data.data.items);
  }, []);

  const refreshUsers = useCallback(async () => {
    const [a, d, s, p] = await Promise.all([
      api.get<{ data: { items: UserRow[] } }>("/api/admin/users?role=admin&limit=100"),
      api.get<{ data: { items: UserRow[] } }>("/api/admin/users?role=driver&limit=100"),
      api.get<{ data: { items: UserRow[] } }>("/api/admin/users?role=student&limit=100"),
      api.get<{ data: { items: UserRow[] } }>("/api/admin/users?role=parent&limit=100"),
    ]);
    setAdmins(a.data.data.items);
    setDrivers(d.data.data.items);
    setStudents(s.data.data.items);
    setParents(p.data.data.items);
  }, []);

  useEffect(() => {
    void Promise.all([refreshBuses(), refreshRoutes(), refreshUsers()]).finally(() => setPageLoading(false));
  }, [refreshBuses, refreshRoutes, refreshUsers]);

  useEffect(() => {
    if (tab !== "fleet") return;
    const id = setInterval(() => void refreshBuses(), 10000);
    return () => clearInterval(id);
  }, [tab, refreshBuses]);

  const busesWithLocation = useMemo(
    () => buses.filter((b) => b.lastLocation?.coordinates),
    [buses]
  );
  const fleetBusIdsKey = useMemo(
    () => busesWithLocation.map((b) => b._id).sort().join(","),
    [busesWithLocation]
  );
  const fleetPoints = useMemo(
    () =>
      busesWithLocation.map((b) => {
        const c = b.lastLocation!.coordinates!;
        const [lng, lat] = c;
        return [lat, lng] as [number, number];
      }),
    [busesWithLocation]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Admin</h1>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {(
          [
            ["fleet", "Live map"],
            ["buses", "Buses"],
            ["routes", "Routes"],
            ["stops", "Stops"],
            ["users", "Users"],
            ["faults", "Faults"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm ${
              tab === id
                ? "bg-brand-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {pageLoading && tab === "fleet" && (
        <SkeletonCard />
      )}

      {!pageLoading && tab === "fleet" && (
        <div className="h-[480px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm">
          <MapContainer center={[12.9716, 77.5946]} zoom={13} className="h-full w-full">
            <MapFitBounds busIdsKey={fleetBusIdsKey} points={fleetPoints} />
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {buses.map((b) => {
              const c = b.lastLocation?.coordinates;
              if (!c) return null;
              const [lng, lat] = c;
              const plate = b.plate?.trim() || "—";
              const speed =
                b.speedKmh != null && !Number.isNaN(b.speedKmh)
                  ? ` · ${b.speedKmh.toFixed(0)} km/h`
                  : "";
              return (
                <Marker key={b._id} position={[lat, lng]}>
                  <Tooltip direction="top" offset={[0, -36]} opacity={1} permanent={false}>
                    <span className="font-medium">{b.label}</span>
                    <span className="text-slate-600"> · {plate}</span>
                    {speed && <span className="text-slate-600">{speed}</span>}
                    <span className="ml-1 inline-block">
                      <BusStatusBadge status={b.status} />
                    </span>
                  </Tooltip>
                  <Popup>
                    {b.label}
                    <br />
                    Plate: {plate}
                    <br />
                    Status: <BusStatusBadge status={b.status} />
                    <br />
                    {b.assignedDriver?.name ?? "No driver"}
                    {speed && (
                      <>
                        <br />
                        Speed: {b.speedKmh!.toFixed(0)} km/h
                      </>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {tab === "buses" && (
        <BusesPanel
          buses={buses}
          routes={routes}
          drivers={drivers}
          onRefresh={async () => {
            await refreshBuses();
            toast.success("Saved.");
          }}
        />
      )}

      {tab === "routes" && <RoutesPanel routes={routes} onRefresh={refreshRoutes} />}

      {tab === "stops" && <StopsPanel routes={routes} onRefresh={refreshRoutes} />}

      {tab === "faults" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Driver-reported issues appear here in real time. Dismiss clears only from this list.
          </p>
          {faultFeed.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
              No faults yet. When a driver reports an issue, it will show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {faultFeed.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{f.busLabel}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {f.driverName && <span>{f.driverName} · </span>}
                      {new Date(f.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-2 whitespace-pre-wrap">
                      {f.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setFaultFeed((prev) => prev.filter((x) => x.id !== f.id))}
                  >
                    Dismiss
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "users" && (
        <UsersPanel
          admins={admins}
          drivers={drivers}
          students={students}
          parents={parents}
          buses={buses}
          onRefresh={async () => {
            await refreshUsers();
            await refreshBuses();
            toast.success("Saved.");
          }}
        />
      )}
    </div>
  );
}

interface FeedbackItem {
  _id: string;
  message: string;
  status: string;
  adminResponse?: string | null;
  student?: { name: string; email: string };
  createdAt: string;
}

function BusesPanel({
  buses,
  routes,
  drivers,
  onRefresh,
}: {
  buses: BusRow[];
  routes: { _id: string; name: string }[];
  drivers: UserRow[];
  onRefresh: () => Promise<void>;
}): React.ReactElement {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [plate, setPlate] = useState("");
  const [feedbackBusId, setFeedbackBusId] = useState<string | null>(null);

  async function createBus(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await api.post("/api/admin/buses", { label, plate });
    setLabel("");
    setPlate("");
    await onRefresh();
    toast.success("Bus created.");
  }

  async function assignDriver(busId: string, driverId: string): Promise<void> {
    await api.patch(`/api/admin/buses/${busId}/assign-driver`, {
      driverId: driverId || null,
    });
    await onRefresh();
  }

  async function assignRoute(busId: string, routeId: string): Promise<void> {
    await api.patch(`/api/admin/buses/${busId}/route`, { routeId: routeId || null });
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => void createBus(e)}
        className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-3 max-w-md"
      >
        <h2 className="font-medium text-slate-800 dark:text-slate-100">Add bus</h2>
        <input
          required
          placeholder="Bus Name / Bus Number"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          placeholder="Number Plate"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
        <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2">
          Create
        </button>
      </form>
      <div className="overflow-x-auto bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 text-left text-slate-700 dark:text-slate-200">
              <th className="p-2">Label</th>
              <th className="p-2">Status</th>
              <th className="p-2">Driver</th>
              <th className="p-2">Route</th>
              <th className="p-2">Student feedback</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((b) => (
              <tr key={b._id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="p-2 font-medium text-slate-800 dark:text-slate-100">{b.label}</td>
                <td className="p-2">
                  <BusStatusBadge status={b.status} />
                </td>
                <td className="p-2">
                  <select
                    className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 max-w-[200px] bg-white dark:bg-slate-900"
                    defaultValue={b.assignedDriver?._id ?? ""}
                    onChange={(e) => void assignDriver(b._id, e.target.value)}
                  >
                    <option value="">None</option>
                    {drivers.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 max-w-[200px] bg-white dark:bg-slate-900"
                    defaultValue={b.route?._id ?? ""}
                    onChange={(e) => void assignRoute(b._id, e.target.value)}
                  >
                    <option value="">None</option>
                    {routes.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    className="text-brand-600 dark:text-brand-400 text-sm font-medium hover:underline"
                    onClick={() => setFeedbackBusId(b._id)}
                  >
                    View issues
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {feedbackBusId && (
        <BusFeedbackModal
          busId={feedbackBusId}
          busLabel={buses.find((x) => x._id === feedbackBusId)?.label ?? ""}
          onClose={() => setFeedbackBusId(null)}
        />
      )}
    </div>
  );
}

function BusFeedbackModal({
  busId,
  busLabel,
  onClose,
}: {
  busId: string;
  busLabel: string;
  onClose: () => void;
}): React.ReactElement {
  const { toast } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<{ data: { items: FeedbackItem[] } }>(
      `/api/admin/buses/${busId}/feedback`
    );
    setItems(data.data.items);
    setLoading(false);
  }, [busId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitResponse(id: string): Promise<void> {
    const text = responses[id]?.trim();
    if (!text) return;
    setErr(null);
    try {
      await api.patch(`/api/admin/feedback/${id}`, {
        adminResponse: text,
        status: "resolved",
      });
      setResponses((r) => ({ ...r, [id]: "" }));
      await load();
      toast.success("Response sent.");
    } catch (e) {
      const m = formErrorFromAxios(e) ?? "Could not save response.";
      setErr(m);
      toast.error(m);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex justify-between items-start gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Bus issues</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{busLabel}</p>
          </div>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {loading && <p className="text-sm text-slate-600 dark:text-slate-400">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">No feedback yet for this bus.</p>
        )}
        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        <ul className="space-y-4">
          {items.map((fb) => (
            <li key={fb._id} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fb.student?.name ?? "Student"} · {new Date(fb.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{fb.message}</p>
              {fb.adminResponse && (
                <div className="mt-2 pl-3 border-l-2 border-brand-500 text-slate-700 dark:text-slate-300">
                  <span className="text-xs font-medium text-slate-500">Admin reply</span>
                  <p className="whitespace-pre-wrap">{fb.adminResponse}</p>
                </div>
              )}
              {!fb.adminResponse && fb.status === "open" && (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm"
                    rows={2}
                    placeholder="Reply to student…"
                    value={responses[fb._id] ?? ""}
                    onChange={(e) => setResponses((r) => ({ ...r, [fb._id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm"
                    onClick={() => void submitResponse(fb._id)}
                  >
                    Send response
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RoutesPanel({
  routes,
  onRefresh,
}: {
  routes: { _id: string; name: string }[];
  onRefresh: () => Promise<void>;
}): React.ReactElement {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [avg, setAvg] = useState("25");
  const [poly, setPoly] = useState("[[77.59,12.97],[77.60,12.98]]");

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    let polyline: [number, number][] = [];
    try {
      polyline = JSON.parse(poly) as [number, number][];
    } catch {
      toast.error("Invalid polyline JSON");
      return;
    }
    await api.post("/api/admin/routes", {
      name,
      avgSpeedKmh: Number(avg) || 25,
      polyline,
    });
    setName("");
    await onRefresh();
    toast.success("Route created");
  }

  return (
    <form
      onSubmit={(e) => void create(e)}
      className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-3 max-w-lg shadow-sm"
    >
      <h2 className="font-medium text-slate-800 dark:text-slate-100">Add route</h2>
      <input
        required
        placeholder="Name"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Avg speed km/h"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        value={avg}
        onChange={(e) => setAvg(e.target.value)}
      />
      <textarea
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs h-28 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        value={poly}
        onChange={(e) => setPoly(e.target.value)}
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Polyline JSON: array of [lng, lat] pairs.
      </p>
      <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 hover:bg-brand-700">
        Create route
      </button>
      <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
        {routes.map((r) => (
          <li key={r._id}>{r.name}</li>
        ))}
      </ul>
    </form>
  );
}

function StopsPanel({
  routes,
  onRefresh,
}: {
  routes: { _id: string; name: string }[];
  onRefresh: () => Promise<void>;
}): React.ReactElement {
  const { toast } = useToast();
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!routeId) {
      toast.error("Select a route");
      return;
    }
    await api.post("/api/admin/stops", {
      route: routeId,
      name,
      order: Number(order),
      lat: Number(lat),
      lng: Number(lng),
    });
    await onRefresh();
    toast.success("Stop created");
  }

  return (
    <form
      onSubmit={(e) => void create(e)}
      className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-3 max-w-md shadow-sm"
    >
      <h2 className="font-medium text-slate-800 dark:text-slate-100">Add stop</h2>
      <select
        required
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
        value={routeId}
        onChange={(e) => setRouteId(e.target.value)}
      >
        <option value="">Route</option>
        {routes.map((r) => (
          <option key={r._id} value={r._id}>
            {r.name}
          </option>
        ))}
      </select>
      <input
        required
        placeholder="Stop name"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Order"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <input
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
        />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 hover:bg-brand-700">
        Create stop
      </button>
    </form>
  );
}

type UserRoleTab = "admins" | "drivers" | "students" | "parents";

const userTabLabels: { id: UserRoleTab; label: string }[] = [
  { id: "admins", label: "Admins" },
  { id: "drivers", label: "Drivers" },
  { id: "students", label: "Students" },
  { id: "parents", label: "Parents" },
];

function roleForTab(tab: UserRoleTab): "admin" | "driver" | "student" | "parent" {
  switch (tab) {
    case "admins":
      return "admin";
    case "drivers":
      return "driver";
    case "students":
      return "student";
    case "parents":
      return "parent";
  }
}

function usersForTab(tab: UserRoleTab, lists: {
  admins: UserRow[];
  drivers: UserRow[];
  students: UserRow[];
  parents: UserRow[];
}): UserRow[] {
  switch (tab) {
    case "admins":
      return lists.admins;
    case "drivers":
      return lists.drivers;
    case "students":
      return lists.students;
    case "parents":
      return lists.parents;
  }
}

function UsersPanel({
  admins,
  drivers,
  students,
  parents,
  buses,
  onRefresh,
}: {
  admins: UserRow[];
  drivers: UserRow[];
  students: UserRow[];
  parents: UserRow[];
  buses: BusRow[];
  onRefresh: () => Promise<void>;
}): React.ReactElement {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [userSubTab, setUserSubTab] = useState<UserRoleTab>("admins");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [parentLinkStudentId, setParentLinkStudentId] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const lists = { admins, drivers, students, parents };
  const rows = usersForTab(userSubTab, lists);
  const createRole = roleForTab(userSubTab);

  async function createUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFieldErr({});
    setFormErr(null);
    try {
      const { data } = await api.post<{ data: { _id: string } }>("/api/admin/users", {
        email,
        password,
        confirmPassword,
        name,
        role: createRole,
      });
      if (createRole === "parent" && parentLinkStudentId) {
        await api.patch(`/api/admin/users/${data.data._id}`, {
          linkedStudentId: parentLinkStudentId,
        });
      }
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setParentLinkStudentId("");
      await onRefresh();
      toast.success("User created.");
    } catch (err) {
      const fe = fieldErrorsFromAxios(err);
      if (Object.keys(fe).length) setFieldErr(fe);
      else setFormErr(formErrorFromAxios(err) ?? "Could not create user.");
    }
  }

  async function assignBus(studentId: string, busId: string): Promise<void> {
    await api.patch(`/api/admin/students/${studentId}/assign-bus`, { busId: busId || null });
    await onRefresh();
  }

  async function toggleActive(u: UserRow, next: boolean): Promise<void> {
    try {
      await api.patch(`/api/admin/users/${u._id}`, { isActive: next });
      await onRefresh();
    } catch (err) {
      toast.error(formErrorFromAxios(err) ?? "Could not update status.");
    }
  }

  async function removeUser(u: UserRow): Promise<void> {
    const ok = await confirm({
      title: "Delete user",
      message: `Delete ${u.name} (${u.email})? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/api/admin/users/${u._id}`);
      await onRefresh();
      toast.success("User deleted.");
    } catch (err) {
      toast.error(formErrorFromAxios(err) ?? "Could not delete user.");
    }
  }

  const createTitle =
    userSubTab === "admins"
      ? "Add admin"
      : userSubTab === "drivers"
        ? "Add driver"
        : userSubTab === "students"
          ? "Add student"
          : "Add parent";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {userTabLabels.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm ${
              userSubTab === id
                ? "bg-slate-700 dark:bg-slate-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            onClick={() => {
              setUserSubTab(id);
              setFieldErr({});
              setFormErr(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => void createUser(e)}
        className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-3 max-w-md"
      >
        <h2 className="font-medium text-slate-800 dark:text-slate-100">{createTitle}</h2>
        {formErr && <p className="text-sm text-red-600 dark:text-red-400">{formErr}</p>}
        <input
          required
          placeholder="Name"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldErr.name && <p className="text-sm text-red-600">{fieldErr.name}</p>}
        <input
          required
          type="email"
          placeholder="Email"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {fieldErr.email && <p className="text-sm text-red-600">{fieldErr.email}</p>}
        <input
          required
          type="password"
          placeholder="Password (min 8 characters)"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldErr.password && <p className="text-sm text-red-600">{fieldErr.password}</p>}
        <input
          required
          type="password"
          placeholder="Confirm password"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {fieldErr.confirmPassword && <p className="text-sm text-red-600">{fieldErr.confirmPassword}</p>}
        {userSubTab === "parents" && (
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Link to student (optional)
            </label>
            <select
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              value={parentLinkStudentId}
              onChange={(e) => setParentLinkStudentId(e.target.value)}
            >
              <option value="">None</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 hover:bg-brand-700">
          Create
        </button>
      </form>

      <div className="overflow-x-auto bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 text-left text-slate-700 dark:text-slate-200">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              {userSubTab === "students" && <th className="p-2">Assigned bus</th>}
              {userSubTab === "parents" && <th className="p-2">Linked student</th>}
              <th className="p-2">Active</th>
              <th className="p-2 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={userSubTab === "students" || userSubTab === "parents" ? 5 : 4}
                  className="p-4 text-slate-500 dark:text-slate-400"
                >
                  No users in this category.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u._id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="p-2 font-medium text-slate-800 dark:text-slate-100">{u.name}</td>
                <td className="p-2 text-slate-700 dark:text-slate-300">{u.email}</td>
                {userSubTab === "students" && (
                  <td className="p-2">
                    <select
                      className="max-w-[220px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                      defaultValue={u.assignedBus?._id ?? ""}
                      onChange={(e) => void assignBus(u._id, e.target.value)}
                    >
                      <option value="">None</option>
                      {buses.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {userSubTab === "parents" && (
                  <td className="p-2 text-slate-600 dark:text-slate-300">
                    {u.linkedStudent ? (
                      <span>
                        {u.linkedStudent.name}
                        <span className="block text-xs text-slate-500">{u.linkedStudent.email}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                )}
                <td className="p-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 dark:border-slate-600"
                      checked={u.isActive !== false}
                      onChange={(e) => void toggleActive(u, e.target.checked)}
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      {u.isActive !== false ? "Yes" : "No"}
                    </span>
                  </label>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-brand-600 dark:text-brand-400 text-sm font-medium hover:underline"
                      onClick={() => setEditUser(u)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 dark:text-red-400 text-sm font-medium hover:underline"
                      onClick={() => void removeUser(u)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <UserEditModal
          user={editUser}
          students={students}
          onClose={() => setEditUser(null)}
          onSaved={async () => {
            setEditUser(null);
            await onRefresh();
          }}
        />
      )}
    </div>
  );
}

function UserEditModal({
  user,
  students,
  onClose,
  onSaved,
}: {
  user: UserRow;
  students: UserRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}): React.ReactElement {
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user.isActive !== false);
  const [linkedStudentId, setLinkedStudentId] = useState(user.linkedStudent?._id ?? "");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFieldErr({});
    setFormErr(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        isActive,
      };
      if (password.trim()) body.password = password.trim();
      if (user.role === "parent") {
        body.linkedStudentId = linkedStudentId || null;
      }
      await api.patch(`/api/admin/users/${user._id}`, body);
      toast.success("User updated.");
      await onSaved();
    } catch (err) {
      const fe = fieldErrorsFromAxios(err);
      if (Object.keys(fe).length) setFieldErr(fe);
      else setFormErr(formErrorFromAxios(err) ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-start gap-2">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Edit user</h2>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">Role: {user.role}</p>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          {formErr && <p className="text-sm text-red-600">{formErr}</p>}
          <input
            required
            placeholder="Name"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fieldErr.name && <p className="text-sm text-red-600">{fieldErr.name}</p>}
          <input
            required
            type="email"
            placeholder="Email"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErr.email && <p className="text-sm text-red-600">{fieldErr.email}</p>}
          <input
            type="password"
            placeholder="New password (optional)"
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErr.password && <p className="text-sm text-red-600">{fieldErr.password}</p>}
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
          </label>
          {user.role === "parent" && (
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Linked student
              </label>
              <select
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
                value={linkedStudentId}
                onChange={(e) => setLinkedStudentId(e.target.value)}
              >
                <option value="">None</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
