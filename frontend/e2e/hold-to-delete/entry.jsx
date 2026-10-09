import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmDialog } from "../../src/components/UI.jsx";
function App() {
  const [open, setOpen] = useState(true);
  const [n, setN] = useState(0);
  return (<div><div data-testid="count">{n}</div><button data-testid="reopen" onClick={() => setOpen(true)}>reopen</button>
    <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => { setN((x) => x + 1); setOpen(false); }} holdToConfirm title="Delete Project" message={'Delete "SP Khopoli"?'} /></div>);
}
createRoot(document.getElementById("root")).render(<App />);
