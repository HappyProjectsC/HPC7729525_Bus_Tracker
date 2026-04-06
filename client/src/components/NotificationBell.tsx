import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";

interface NotifItem {
  _id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell(): React.ReactElement {
  const { accessToken, user } = useAuth();
  const socket = useSocket(accessToken, !!user);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<{
      data: { items: NotifItem[]; unread: number };
    }>("/api/notifications/in-app?limit=40");
    setItems(data.data.items);
    setUnread(data.data.unread);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  useEffect(() => {
    if (!socket || !user) return;
    const onNew = (): void => {
      void load();
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [socket, user, load]);

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string): Promise<void> {
    await api.patch(`/api/notifications/in-app/${id}/read`);
    await load();
  }

  async function markAll(): Promise<void> {
    await api.post("/api/notifications/in-app/read-all");
    await load();
  }

  if (!user) return <></>;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.map((n) => (
                <li key={n._id} className="p-3 text-sm">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                  {!n.readAt && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-brand-600 dark:text-brand-400"
                      onClick={() => void markRead(n._id)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
