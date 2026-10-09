import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
const Where = () => { const l = useLocation(); return <div data-testid="path" style={{ position: "absolute", left: -9999 }}>{l.pathname}</div>; };
import { Toaster } from "react-hot-toast";
import VistrowVoiceSettingsPage from "../../src/pages/VistrowVoiceSettingsPage.jsx";
// The real page, mounted at its real route; "Integrations" is a stand-in for the list page.
createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={[window.location.hash === "#connection" ? "/integrations/vistrow-voice" : "/integrations/vistrow-calling"]}>
    <Toaster position="top-right" />
    <Where />
    <Routes>
      <Route path="/integrations/vistrow-calling" element={<VistrowVoiceSettingsPage tab="calling" />} />
      <Route path="/integrations/vistrow-voice" element={<VistrowVoiceSettingsPage tab="connection" />} />
      <Route path="/integrations" element={<div data-testid="integrations-list">Integrations list</div>} />
    </Routes>
  </MemoryRouter>
);
