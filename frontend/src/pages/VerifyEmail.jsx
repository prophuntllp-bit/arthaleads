import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, AlertCircle } from "lucide-react";
import { Spinner } from "../components/UI";
import { stashVerified } from "../utils/signupHandoff";
import api from "../services/api";

// The landing page for the emailed verification link.
//
// The token is confirmed with a POST from here, never by the GET that loaded
// this page. Mail security suites — Defender Safe Links, Proofpoint, Mimecast —
// fetch every URL in a message before the recipient sees it, so a GET that
// verified would be spent by the scanner and the real person would arrive at
// "already used". Scanners issue GETs and do not run JavaScript.
//
// No button to press: the POST fires on mount. That is the whole point of the
// link over a code.
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("t") || "";
  const [state, setState] = useState("working"); // working | done | failed
  const [message, setMessage] = useState("");
  // StrictMode mounts effects twice in development. Without this the second
  // run posts the same single-use token and gets a genuine "no longer valid".
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (!token) {
      setState("failed");
      setMessage("This link is missing its verification code. Please use the link from your email.");
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/signup/confirm-link", { token });
        stashVerified(data.signupToken, data.email);
        setState("done");
      } catch (err) {
        setState("failed");
        setMessage(err.response?.data?.message || "We couldn't verify this link. Please request a new one.");
      }
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-app bg-app-card p-8 text-center">
        {state === "working" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
              <Spinner />
            </div>
            <h1 className="mb-2 text-lg font-bold text-app">Verifying your email…</h1>
            <p className="text-sm text-app-soft">This only takes a moment.</p>
          </>
        )}

        {state === "done" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "rgba(var(--app-primary-rgb),0.12)" }}>
              <MailCheck className="h-6 w-6" style={{ color: "var(--app-primary)" }} />
            </div>
            <h1 className="mb-2 text-lg font-bold text-app">Email verified</h1>
            <p className="mb-6 text-sm text-app-soft">
              Started signing up on another device? That tab will carry on by itself — you can
              close this one.
            </p>
            <button onClick={() => navigate("/signup")}
              className="btn-primary w-full justify-center py-3">
              Continue signing up here
            </button>
          </>
        )}

        {state === "failed" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="mb-2 text-lg font-bold text-app">Link didn't work</h1>
            <p className="mb-6 text-sm text-app-soft">{message}</p>
            <Link to="/signup" className="btn-primary inline-flex w-full justify-center py-3">
              Start again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
