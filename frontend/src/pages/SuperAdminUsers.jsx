import { useEffect } from "react";
import { UsersPanel } from "./SuperAdmin";

export default function SuperAdminUsers() {
  useEffect(() => { document.title = "Users · Arthaleads Admin"; }, []);
  return (
    <div className="stitch-page">
      <div className="mb-5">
        <h1 className="text-xl font-black text-app">All Users</h1>
        <p className="text-xs text-app-soft mt-0.5">Every user across all organisations</p>
      </div>
      <UsersPanel />
    </div>
  );
}
