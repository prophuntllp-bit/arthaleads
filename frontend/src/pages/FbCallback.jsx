import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function FbCallback() {
  const [params] = useSearchParams();

  useEffect(() => {
    const session = params.get("session");

    const send = (payload) => {
      // postMessage is reliable (synchronous delivery before close)
      if (window.opener) {
        window.opener.postMessage(payload, "*");
      } else {
        // Fallback: popup was opened as a tab without opener reference
        localStorage.setItem("fb_oauth_result", JSON.stringify(payload));
      }
      window.close();
    };

    if (!session) {
      send({ type: "facebook_oauth_error", message: "No session provided" });
      return;
    }

    const token = localStorage.getItem("crm_token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    fetch(`${base}/automations/facebook/result?session=${session}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.type === "success") {
          send({ type: "facebook_oauth_success", pages: data.pages });
        } else {
          send({ type: "facebook_oauth_error", message: data.message || "Connection failed" });
        }
      })
      .catch((e) => {
        send({ type: "facebook_oauth_error", message: e.message });
      });
  }, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 24, textAlign: "center" }}>
      <p>Completing Facebook connection… this window will close automatically.</p>
    </div>
  );
}
