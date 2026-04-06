import type { AxiosError } from "axios";

type FlattenDetails = {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};

/** Map Zod flatten fieldErrors to single string per field (first message). */
export function fieldErrorsFromAxios(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const ax = err as AxiosError<{ details?: FlattenDetails; error?: string }>;
  const details = ax.response?.data?.details;
  if (!details?.fieldErrors) return out;
  for (const [k, v] of Object.entries(details.fieldErrors)) {
    const first = v?.[0];
    if (first) out[k] = first;
  }
  return out;
}

export function formErrorFromAxios(err: unknown): string | null {
  const ax = err as AxiosError<{ error?: string }>;
  const msg = ax.response?.data?.error;
  if (typeof msg === "string" && msg) return msg;
  return null;
}
