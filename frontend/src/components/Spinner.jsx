// components/Spinner.jsx - the loading spinner, on its own so App.jsx (in the
// bundle every website visitor downloads) can use it without pulling in UI.jsx
// and everything UI.jsx imports. UI.jsx re-exports it.
import { Loader2 } from "lucide-react";

export function Spinner({ size = "md" }) {
  const sz = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return <Loader2 className={`${sz} animate-spin text-orange-500`} />;
}
