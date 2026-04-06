import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

/** In dev, follow the page host so phone → `http://192.168.x.x:5173` uses `:5000` on the same PC (not phone localhost). */
function resolveSocketUrl(): string {
  const envUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    if (!envUrl || /localhost|127\.0\.0\.1/.test(envUrl)) {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
  }
  return envUrl ?? "http://localhost:5000";
}

export function useSocket(accessToken: string | null, enabled: boolean): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken) {
      if (ref.current) {
        ref.current.disconnect();
        ref.current = null;
        setSocket(null);
      }
      return;
    }
    const s = io(resolveSocketUrl(), {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    ref.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      ref.current = null;
      setSocket(null);
    };
  }, [enabled, accessToken]);

  return socket;
}
