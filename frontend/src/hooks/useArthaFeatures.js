import { useEffect, useState } from "react";
import api from "../services/api";

// Which Artha extras this company has (brief, drafts, suggestions). Asked once
// per page load and shared by every screen that needs it.
let cached = null;
let pending = null;

export default function useArthaFeatures() {
  const [features, setFeatures] = useState(cached || {});
  useEffect(() => {
    if (cached) return;
    if (!pending) pending = api.get("/copilot/features").then(({ data }) => (cached = data.features || {})).catch(() => ({}));
    let live = true;
    pending.then((f) => { if (live) setFeatures(f); });
    return () => { live = false; };
  }, []);
  return features;
}
