import { useEffect, useState } from "react";
import { api } from "../../api/client";

const STORAGE_KEY = "bus-tracker-push-enabled";

export function PushNotifyButton(): React.ReactElement {
  const [status, setStatus] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setSubscribed(!!sub || localStorage.getItem(STORAGE_KEY) === "1");
        }
      } catch {
        if (!cancelled) setSubscribed(localStorage.getItem(STORAGE_KEY) === "1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      localStorage.setItem(STORAGE_KEY, "1");
      setSubscribed(true);
      setStatus("Notifications enabled.");
    } catch {
      setStatus("Could not enable notifications.");
    }
  }

  async function disable(): Promise<void> {
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.post("/api/notifications/unsubscribe");
      localStorage.removeItem(STORAGE_KEY);
      setSubscribed(false);
      setStatus("Push alerts disabled.");
    } catch {
      setStatus("Could not disable notifications.");
    }
  }

  if (!("Notification" in window)) return <></>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!subscribed ? (
        <button
          type="button"
          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
          onClick={() => void enable()}
        >
          Enable stop alerts (push)
        </button>
      ) : (
        <button
          type="button"
          className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-950/40 text-red-800 dark:text-red-200"
          onClick={() => void disable()}
        >
          Disable stop alerts
        </button>
      )}
      {status && <span className="text-sm text-slate-600 dark:text-slate-400">{status}</span>}
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
