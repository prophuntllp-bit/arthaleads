import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function FbCallback() {
  const [params] = useSearchParams();

  useEffect(() => {
    const session = params.get("session");

    const send = (payload) => {
      // postMessage is reliable (synchronous delivery before close)
      if (window.opener) {
        window.opener.postMessage(payload, window.location.origin);
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

    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    // Cookie (httpOnly) is sent automatically via credentials: 'include'
    fetch(`${base}/automations/facebook/result?session=${session}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        console.log("[fb-callback] result from server:", data.type, "pages:", data.pages?.length, "freshToken:", !!data.freshToken);
        if (data.type === "success") {
          send({ type: "facebook_oauth_success", pages: data.pages, freshToken: data.freshToken });
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
