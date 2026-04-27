// pages/SuperAdmin.jsx — Saurabh's platform-level dashboard
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { PageLoader, Spinner } from "../components/UI";
import api from "../services/api";
import toast from "react-hot-toast";
import { Building2, Users, BarChart3, Upload, CheckCircle2, XCircle, Image, RefreshCw } from "lucide-react";

function PlanBadge({ plan }) {
  const cls = {
    trial:      "bg-yellow-500/10 text-yellow-600 border-yellow-500/25",
    starter:    "bg-blue-500/10 text-blue-600 border-blue-500/25",
    pro:        "bg-violet-500/10 text-violet-600 border-violet-500/25",
    enterprise: "bg-orange-500/10 text-orange-600 border-orange-500/25",
  }[plan] || "bg-gray-500/10 text-gray-500 border-gray-500/25";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {plan}
    </span>
  );
}

function LogoUploader({ org, onUpdated }) {
  const inputRef  = useRef(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(org.logo || "");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Only image files are supported");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB");

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUri = ev.target.result;
      setPreview(dataUri);
      setLoading(true);
      try {
        const { data } = await api.patch(`/super-admin/orgs/${org._id}/logo`, { logo: dataUri });
        onUpdated(data.org);
        toast.success(`Logo updated for ${org.name}`);
      } catch (err) {
        toast.error(err.response?.data?.message || "Upload failed");
        setPreview(org.logo || "");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove logo for ${org.name}?`)) return;
    setLoading(true);
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}/logo`, { logo: "" });
      setPreview("");
      onUpdated(data.org);
      toast.success("Logo removed");
    } catch (err) {
      toast.error("Failed to remove logo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Logo preview / placeholder */}
      <div
        className="w-12 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer border transition hover:border-orange-400/60"
        style={{ background: "var(--app-surface-low)", borderColor: "var(--app-border)" }}
        onClick={() => inputRef.current?.click()}
        title="Click to upload logo"
      >
        {loading ? (
          <Spinner size="sm" />
        ) : preview ? (
          <img src={preview} alt="logo" className="max-w-full max-h-full object-contain p-1" />
        ) : (
          <Image className="w-5 h-5 text-app-soft" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-400 transition disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {preview ? "Change" : "Upload logo"}
        </button>
        {preview && (
          <button
            onClick={handleRemove}
            disabled={loading}
            className="text-[10px] text-app-soft hover:text-red-500 transition"
          >
            Remove
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function SuperAdmin() {
  useEffect(() => { document.title = "Super Admin — Arthaleads"; }, []);
  const { user } = useAuth();

  const [orgs, setOrgs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/super-admin/orgs");
      setOrgs(data.orgs);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOrgUpdated = (updated) => {
    setOrgs((prev) => prev.map((o) => o._id === updated._id ? { ...o, ...updated } : o));
  };

  const toggleActive = async (org) => {
    try {
      const { data } = await api.patch(`/super-admin/orgs/${org._id}`, { isActive: !org.isActive });
      handleOrgUpdated(data.org);
      toast.success(`${data.org.name} ${data.org.isActive ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Update failed");
    }
  };

  const filtered = orgs.filter((o) =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = orgs.reduce((s, o) => s + (o.userCount || 0), 0);
  const totalLeads = orgs.reduce((s, o) => s + (o.leadCount || 0), 0);
  const activeOrgs = orgs.filter((o) => o.isActive).length;

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #a04100, #ff6b00)" }}>
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app">Super Admin</h1>
            <p className="text-xs text-app-soft">Platform-level management · Logged in as <span className="font-semibold text-orange-500">{user?.name}</span></p>
          </div>
          <button onClick={load} className="ml-auto btn-secondary gap-1.5 text-xs px-3 py-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Organizations", value: total,      icon: Building2,  color: "text-orange-500" },
          { label: "Active Orgs",          value: activeOrgs, icon: CheckCircle2, color: "text-green-500" },
          { label: "Total Users",          value: totalUsers, icon: Users,      color: "text-blue-500" },
          { label: "Total Leads",          value: totalLeads, icon: BarChart3,  color: "text-violet-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <p className="stitch-kicker mb-1">{label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-3xl font-black ${color}`}>{value}</p>
              <Icon className={`w-6 h-6 opacity-30 ${color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Org table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "var(--app-border)" }}>
          <h2 className="font-bold text-app flex-1">Organizations</h2>
          <input
            className="input text-xs px-3 py-2 w-48"
            placeholder="Search org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="stitch-table min-w-[700px]">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th className="text-center">Users</th>
                <th className="text-center">Leads</th>
                <th>Logo</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-app-soft text-sm">No organizations found</td>
                </tr>
              ) : filtered.map((org) => (
                <tr key={org._id}>
                  <td>
                    <div>
                      <p className="font-semibold text-sm text-app">{org.name}</p>
                      <p className="text-[10px] text-app-soft">{org.slug}</p>
                      <p className="text-[10px] text-app-soft">{new Date(org.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </td>
                  <td><PlanBadge plan={org.plan} /></td>
                  <td className="text-center font-bold text-app">{org.userCount}</td>
                  <td className="text-center font-bold text-app">{org.leadCount}</td>
                  <td>
                    <LogoUploader org={org} onUpdated={handleOrgUpdated} />
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => toggleActive(org)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border transition ${
                        org.isActive
                          ? "bg-green-500/10 text-green-600 border-green-500/25 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/25"
                          : "bg-red-500/10 text-red-500 border-red-500/25 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/25"
                      }`}
                      title={org.isActive ? "Click to deactivate" : "Click to activate"}
                    >
                      {org.isActive
                        ? <><CheckCircle2 className="w-3 h-3" /> Active</>
                        : <><XCircle className="w-3 h-3" /> Inactive</>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
