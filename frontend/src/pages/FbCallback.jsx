import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function FbCallback() {
  const [params] = useSearchParams();

  useEffect(() => {
    const session = params.get("session");
    if (!session) {
      localStorage.setItem("fb_oauth_result", JSON.stringify({ type: "error", message: "No session provided" }));
      window.close();
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
          localStorage.setItem("fb_oauth_result", JSON.stringify({ type: "facebook_oauth_success", pages: data.pages }));
        } else {
          localStorage.setItem("fb_oauth_result", JSON.stringify({ type: "facebook_oauth_error", message: data.message || "Connection failed" }));
        }
        window.close();
      })
      .catch((e) => {
        localStorage.setItem("fb_oauth_result", JSON.stringify({ type: "facebook_oauth_error", message: e.message }));
        window.close();
      });
  }, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
      <p>Completing Facebook connection... you can close this tab if it doesn&apos;t close automatically.</p>
    </div>
  );
}
