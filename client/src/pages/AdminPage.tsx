import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { MapRecenter } from "../components/MapRecenter";

type Tab = "fleet" | "buses" | "routes" | "stops" | "users";

interface BusRow {
  _id: string;
  label: string;
  plate?: string;
  assignedDriver?: { _id: string; name: string; email: string } | null;
  route?: { _id: string; name: string } | null;
  lastLocation?: { coordinates?: [number, number] };
}

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  assignedBus?: { _id: string; label: string } | null;
}

export function AdminPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("fleet");
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [routes, setRoutes] = useState<{ _id: string; name: string }[]>([]);
  const [drivers, setDrivers] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshBuses = useCallback(async () => {
    const { data } = await api.get<{ data: { items: BusRow[] } }>("/api/admin/buses?limit=100");
    setBuses(data.data.items);
  }, []);

  const adminSocket = useSocket(accessToken, tab === "fleet");

  useEffect(() => {
    if (!adminSocket || tab !== "fleet") return;
    adminSocket.emit("subscribe:admin", {}, () => {});
    const onLoc = (): void => {
      void refreshBuses();
    };
    adminSocket.on("bus:location", onLoc);
    return () => {
      adminSocket.off("bus:location", onLoc);
    };
  }, [adminSocket, tab, refreshBuses]);

  const refreshRoutes = useCallback(async () => {
    const { data } = await api.get<{ data: { items: { _id: string; name: string }[] } }>(
      "/api/admin/routes?limit=100"
    );
    setRoutes(data.data.items);
  }, []);

  const refreshUsers = useCallback(async () => {
    const [d, s] = await Promise.all([
      api.get<{ data: { items: UserRow[] } }>("/api/admin/users?role=driver&limit=100"),
      api.get<{ data: { items: UserRow[] } }>("/api/admin/users?role=student&limit=100"),
    ]);
    setDrivers(d.data.data.items);
    setStudents(s.data.data.items);
  }, []);

  useEffect(() => {
    void refreshBuses();
    void refreshRoutes();
    void refreshUsers();
  }, [refreshBuses, refreshRoutes, refreshUsers]);

  useEffect(() => {
    if (tab !== "fleet") return;
    const id = setInterval(() => void refreshBuses(), 10000);
    return () => clearInterval(id);
  }, [tab, refreshBuses]);

  const fleetCenter = useMemo((): [number, number] => {
    const withLoc = buses.find((b) => b.lastLocation?.coordinates);
    if (withLoc?.lastLocation?.coordinates) {
      const [lng, lat] = withLoc.lastLocation.coordinates;
      return [lat, lng];
    }
    return [12.9716, 77.5946];
  }, [buses]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Admin</h1>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ["fleet", "Live map"],
            ["buses", "Buses"],
            ["routes", "Routes"],
            ["stops", "Stops"],
            ["users", "Users"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm ${
              tab === id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      {tab === "fleet" && (
        <div className="h-[480px] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <MapContainer center={fleetCenter} zoom={13} className="h-full w-full">
            <MapRecenter center={fleetCenter} />
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {buses.map((b) => {
              const c = b.lastLocation?.coordinates;
              if (!c) return null;
              const [lng, lat] = c;
              return (
                <Marker key={b._id} position={[lat, lng]}>
                  <Popup>
                    {b.label}
                    <br />
                    {b.assignedDriver?.name ?? "No driver"}
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
            setMsg("Saved.");
          }}
        />
      )}

      {tab === "routes" && <RoutesPanel routes={routes} onRefresh={refreshRoutes} setMsg={setMsg} />}

      {tab === "stops" && <StopsPanel routes={routes} onRefresh={refreshRoutes} setMsg={setMsg} />}

      {tab === "users" && (
        <UsersPanel
          students={students}
          buses={buses}
          onRefresh={async () => {
            await refreshUsers();
            await refreshBuses();
            setMsg("Saved.");
          }}
        />
      )}
    </div>
  );
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
  const [label, setLabel] = useState("");
  const [plate, setPlate] = useState("");

  async function createBus(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await api.post("/api/admin/buses", { label, plate });
    setLabel("");
    setPlate("");
    await onRefresh();
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
      <form onSubmit={createBus} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 max-w-md">
        <h2 className="font-medium">Add bus</h2>
        <input
          required
          placeholder="Label"
          className="w-full border rounded-lg px-3 py-2"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          placeholder="Plate"
          className="w-full border rounded-lg px-3 py-2"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
        <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2">
          Create
        </button>
      </form>
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">Label</th>
              <th className="p-2">Driver</th>
              <th className="p-2">Route</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((b) => (
              <tr key={b._id} className="border-t border-slate-100">
                <td className="p-2 font-medium">{b.label}</td>
                <td className="p-2">
                  <select
                    className="border rounded px-2 py-1 max-w-[200px]"
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
                    className="border rounded px-2 py-1 max-w-[200px]"
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoutesPanel({
  routes,
  onRefresh,
  setMsg,
}: {
  routes: { _id: string; name: string }[];
  onRefresh: () => Promise<void>;
  setMsg: (s: string | null) => void;
}): React.ReactElement {
  const [name, setName] = useState("");
  const [avg, setAvg] = useState("25");
  const [poly, setPoly] = useState("[[77.59,12.97],[77.60,12.98]]");

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    let polyline: [number, number][] = [];
    try {
      polyline = JSON.parse(poly) as [number, number][];
    } catch {
      setMsg("Invalid polyline JSON");
      return;
    }
    await api.post("/api/admin/routes", {
      name,
      avgSpeedKmh: Number(avg) || 25,
      polyline,
    });
    setName("");
    await onRefresh();
    setMsg("Route created");
  }

  return (
    <form onSubmit={create} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 max-w-lg">
      <h2 className="font-medium">Add route</h2>
      <input
        required
        placeholder="Name"
        className="w-full border rounded-lg px-3 py-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Avg speed km/h"
        className="w-full border rounded-lg px-3 py-2"
        value={avg}
        onChange={(e) => setAvg(e.target.value)}
      />
      <textarea
        className="w-full border rounded-lg px-3 py-2 font-mono text-xs h-28"
        value={poly}
        onChange={(e) => setPoly(e.target.value)}
      />
      <p className="text-xs text-slate-500">Polyline JSON: array of [lng, lat] pairs.</p>
      <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2">
        Create route
      </button>
      <ul className="text-sm text-slate-600 list-disc pl-5">
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
  setMsg,
}: {
  routes: { _id: string; name: string }[];
  onRefresh: () => Promise<void>;
  setMsg: (s: string | null) => void;
}): React.ReactElement {
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!routeId) {
      setMsg("Select a route");
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
    setMsg("Stop created");
  }

  return (
    <form onSubmit={create} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 max-w-md">
      <h2 className="font-medium">Add stop</h2>
      <select
        required
        className="w-full border rounded-lg px-3 py-2"
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
        className="w-full border rounded-lg px-3 py-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Order"
        className="w-full border rounded-lg px-3 py-2"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded-lg px-3 py-2" value={lat} onChange={(e) => setLat(e.target.value)} />
        <input className="border rounded-lg px-3 py-2" value={lng} onChange={(e) => setLng(e.target.value)} />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2">
        Create stop
      </button>
    </form>
  );
}

function UsersPanel({
  students,
  buses,
  onRefresh,
}: {
  students: UserRow[];
  buses: BusRow[];
  onRefresh: () => Promise<void>;
}): React.ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"driver" | "admin">("driver");

  async function createUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await api.post("/api/admin/users", { email, password, name, role });
    setEmail("");
    setPassword("");
    setName("");
    await onRefresh();
  }

  async function assignBus(studentId: string, busId: string): Promise<void> {
    await api.patch(`/api/admin/students/${studentId}/assign-bus`, { busId: busId || null });
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createUser} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 max-w-md">
        <h2 className="font-medium">Create staff user</h2>
        <input
          required
          placeholder="Name"
          className="w-full border rounded-lg px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          required
          type="email"
          placeholder="Email"
          className="w-full border rounded-lg px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required
          type="password"
          placeholder="Password"
          className="w-full border rounded-lg px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value as "driver" | "admin")}
        >
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2">
          Create user
        </button>
      </form>

      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">Student</th>
              <th className="p-2">Assigned bus</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s._id} className="border-t border-slate-100">
                <td className="p-2">
                  {s.name}
                  <div className="text-xs text-slate-500">{s.email}</div>
                </td>
                <td className="p-2">
                  <select
                    className="border rounded px-2 py-1 max-w-[200px]"
                    defaultValue={s.assignedBus?._id ?? ""}
                    onChange={(e) => void assignBus(s._id, e.target.value)}
                  >
                    <option value="">None</option>
                    {buses.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
