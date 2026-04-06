import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "";

let accessToken: string | null = null;
let refreshing: Promise<void> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof sessionStorage !== "undefined") {
    if (token) sessionStorage.setItem("accessToken", token);
    else sessionStorage.removeItem("accessToken");
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    const url = original?.url ?? "";
    if (
      error.response?.status !== 401 ||
      original?._retry ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/login")
    ) {
      return Promise.reject(error);
    }
    original._retry = true;
    if (!refreshing) {
      refreshing = api
        .post<{ data: { accessToken: string } }>("/api/auth/refresh")
        .then((r) => {
          const t = r.data?.data?.accessToken;
          if (t) setAccessToken(t);
        })
        .catch(() => {
          setAccessToken(null);
        })
        .finally(() => {
          refreshing = null;
        });
    }
    await refreshing;
    if (!getAccessToken()) {
      return Promise.reject(error);
    }
    return api(original);
  }
);
