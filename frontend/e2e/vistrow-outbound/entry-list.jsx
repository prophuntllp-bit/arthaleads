import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Automation from "../../src/pages/Automation.jsx";
const Where = () => { const l = useLocation(); return <div data-testid="path">{l.pathname}</div>; };
createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={["/integrations"]}>
    <Toaster />
    <Where />
    <Routes>
      <Route path="/integrations" element={<Automation />} />
      <Route path="/integrations/vistrow-calling" element={<div data-testid="calling-page">Auto-call new leads page</div>} />
      <Route path="/plans" element={<div data-testid="plans-page">plans</div>} />
    </Routes>
  </MemoryRouter>
);
