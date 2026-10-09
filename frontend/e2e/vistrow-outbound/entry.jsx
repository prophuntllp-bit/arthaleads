import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import VistrowOutboundSection from "../../src/components/VistrowOutboundSection.jsx";
createRoot(document.getElementById("root")).render(<div className="stitch-page"><Toaster position="top-right" /><VistrowOutboundSection /></div>);
