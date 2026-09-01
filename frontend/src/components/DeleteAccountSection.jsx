import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { Spinner } from "./UI";
import api from "../services/api";

// "Delete my account", in the Settings profile tab.
//
// Two outcomes, and which one you get is not obvious from where you are
// standing, so the component asks the server first and says plainly which
// applies before anything is confirmed:
//
//   * Most people are removed straight away. Their organisation carries on
//     without them.
//   * The last admin of an organisation is closing the whole thing down, so
//     that is scheduled 30 days out and has to be typed out to confirm.
//
// The typed confirmation is deliberately only on the destructive branch.
// Making everyone type their organisation name to leave a company they no
// longer work for is friction for its own sake; making someone type it before
// destroying a company's CRM is the point.
export default function DeleteAccountSection() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/account/deletion")
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ willCloseOrganisation: false }));
  }, []);

  if (!status) return null;

  const closesOrg = !!status.willCloseOrganisation;
  const orgName = status.orgName || "";
  const confirmed = !closesOrg || typed.trim() === orgName.trim();

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/account/deletion");
      if (data.outcome === "scheduled") {
        toast.success("Deletion scheduled");
        // The org is frozen from here, so there is nothing left to stay on.
        window.location.reload();
        return;
      }
      toast.success("Your account has been deleted");
      window.location.href = "/login";
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete the account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <section className="stitch-card p-6" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "rgba(239,68,68,0.12)" }}>
          <AlertTriangle className="h-5 w-5" style={{ color: "#ef4444" }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-app">Delete my account</h2>

          {closesOrg ? (
            <p className="mt-1 text-sm text-app-soft">
              You are the only admin of <strong className="text-app">{orgName}</strong>, so deleting your
              account closes the workspace. Every lead, project, booking and invoice in it is deleted
              permanently after {status.graceDays} days. Signing in before then cancels it.
            </p>
          ) : (
            <p className="mt-1 text-sm text-app-soft">
              Your account and personal data are deleted right away. Your organisation and its records
              stay with your colleagues, and your name is removed from them.
            </p>
          )}

          {!open ? (
            <button type="button" onClick={() => setOpen(true)}
              className="mt-4 rounded-2xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              {closesOrg ? "Delete workspace and account" : "Delete my account"}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              {closesOrg && (
                <div>
                  <label className="label">
                    Type <strong className="text-app">{orgName}</strong> to confirm
                  </label>
                  <input className="input" value={typed} autoFocus
                    onChange={(e) => setTyped(e.target.value)} placeholder={orgName} />
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={submit} disabled={!confirmed || busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#ef4444" }}>
                  {busy ? <><Spinner size="sm" /> Deleting…</> : closesOrg ? "Yes, delete everything" : "Yes, delete my account"}
                </button>
                <button type="button" onClick={() => { setOpen(false); setTyped(""); setError(""); }}
                  className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-app-soft transition hover:text-app">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
