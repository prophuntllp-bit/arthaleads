import { useEffect, useRef } from "react";

// Something outside this page changed the data it shows: Artha applied or
// undid a change, or the service worker's periodic sync ran. Pages that show
// that data reload when they hear it. `resource` narrows who reloads
// ("leads", "tasks", "projects"); no resource means everything.
const EVENT = "arthaleads:refresh";

export function notifyDataChanged(resource) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: resource ? { resource } : {} }));
}

export default function useAppRefresh(reload, resources = []) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const key = resources.join(",");
  useEffect(() => {
    const wanted = key ? key.split(",") : [];
    const onRefresh = (e) => {
      const resource = e.detail?.resource;
      if (!resource || !wanted.length || wanted.includes(resource)) reloadRef.current?.();
    };
    window.addEventListener(EVENT, onRefresh);
    return () => window.removeEventListener(EVENT, onRefresh);
  }, [key]);
}
