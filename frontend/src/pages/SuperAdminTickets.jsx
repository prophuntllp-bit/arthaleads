import { useEffect } from "react";
import { TicketsPanel } from "./SuperAdmin";

export default function SuperAdminTickets() {
  useEffect(() => { document.title = "Tickets · Arthaleads Admin"; }, []);
  return (
    <div className="stitch-page">
      <div className="mb-5">
        <h1 className="text-xl font-black text-app">Support Tickets</h1>
        <p className="text-xs text-app-soft mt-0.5">Manage and resolve tickets raised by organisations</p>
      </div>
      <TicketsPanel />
    </div>
  );
}
