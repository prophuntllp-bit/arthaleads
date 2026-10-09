import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import VistrowCalling from "../../src/pages/VistrowCalling.jsx";
// The real page, mounted at its real route; "Integrations" is a stand-in for the list page.
createRoot(document.getElementById("root")).render(
  <MemoryRouter initialEntries={["/integrations/vistrow-calling"]}>
    <Toaster position="top-right" />
    <Routes>
      <Route path="/integrations/vistrow-calling" element={<VistrowCalling />} />
      <Route path="/integrations" element={<div data-testid="integrations-list">Integrations list</div>} />
    </Routes>
  </MemoryRouter>
);
