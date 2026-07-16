import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function GoogleCallback() {
  const [params] = useSearchParams();

  useEffect(() => {
    const session = params.get("session");

    const send = (payload) => {
      // postMessage is reliable (synchronous delivery before close)
      if (window.opener) {
        window.opener.postMessage(payload, window.location.origin);
      } else {
        // Fallback: popup was opened as a tab without opener reference
        localStorage.setItem("google_oauth_result", JSON.stringify(payload));
      }
      window.close();
    };

    if (!session) {
      send({ type: "google_oauth_error", message: "No session provided" });
      return;
    }

    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    // Cookie (httpOnly) is sent automatically via credentials: 'include'
    fetch(`${base}/automations/google/oauth-result?session=${session}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.type === "success") {
          send({ type: "google_oauth_success", customers: data.customers, accessToken: data.accessToken, refreshToken: data.refreshToken });
        } else {
          send({ type: "google_oauth_error", message: data.message || "Connection failed" });
        }
      })
      .catch((e) => {
        send({ type: "google_oauth_error", message: e.message });
      });
  }, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 24, textAlign: "center" }}>
      <p>Completing Google connection… this window will close automatically.</p>
    </div>
  );
}
