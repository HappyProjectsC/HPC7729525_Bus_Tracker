import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { fieldErrorsFromAxios, formErrorFromAxios } from "../lib/apiErrors";
import { Skeleton } from "../components/Skeleton";

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  driver: "Driver",
  student: "Student",
  parent: "Parent",
};

const roleBadgeClass: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  driver: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  student: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  parent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ProfilePage(): React.ReactElement {
  const { user, changePassword } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFieldErr({});
    setFormErr(null);
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword, confirmNewPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Password updated.");
    } catch (err) {
      const fe = fieldErrorsFromAxios(err);
      if (Object.keys(fe).length) setFieldErr(fe);
      else setFormErr(formErrorFromAxios(err) ?? "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const badgeClass = roleBadgeClass[user.role] ?? "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your account details</p>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold text-white"
            aria-hidden
          >
            {initials(user.name)}
          </div>
          <div>
            <p className="font-medium text-lg text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2">
              {user.name}
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                {roleLabels[user.role] ?? user.role}
              </span>
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{user.email}</p>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</p>
            <p className="font-medium text-slate-800 dark:text-slate-100">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 shadow-sm">
        <h2 className="font-medium text-slate-800 dark:text-slate-100 mb-4">Change password</h2>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {formErr && <p className="text-sm text-red-600 dark:text-red-400">{formErr}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Current password
            </label>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            {fieldErr.currentPassword && (
              <p className="text-sm text-red-600 mt-1">{fieldErr.currentPassword}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              New password
            </label>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {fieldErr.newPassword && <p className="text-sm text-red-600 mt-1">{fieldErr.newPassword}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirm new password
            </label>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
            {fieldErr.confirmNewPassword && (
              <p className="text-sm text-red-600 mt-1">{fieldErr.confirmNewPassword}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 font-medium hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Update password"}
            </button>
            <button
              type="button"
              className="text-sm text-slate-600 dark:text-slate-400 hover:underline"
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
