import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { Eye, EyeOff, ImagePlus, Phone, Plus, Pencil, Shield, Trash2, UserCheck, UserCog, UserMinus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { planLabel, planLevel } from "../utils/plan";
import api from "../services/api";
import { ConfirmDialog, EmptyState, Modal, PageLoader, RoleBadge } from "../components/UI";
import CustomSelect from "../components/CustomSelect";

// Compress image to JPEG ≤ 400×400 before upload - an uncompressed data URI
// can run several MB, which is unreliable to decode/render on mobile clients.
function compressImage(dataUri, maxPx = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

const emptyMember = {
  name: "",
  email: "",
  password: "",
  phone: "",
  role: "agent",
  avatar: "",
  isActive: true,
};

export default function Team() {
  useEffect(() => { document.title = "Team Management - Arthaleads CRM"; }, []);
  const { user, org } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyMember);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  // Seat ceiling comes from the server, not a copy of the numbers held here.
  // This page used to carry its own PLAN_LIMITS table, which had drifted to the
  // pre-2026 caps (starter 3, growth 20) — so it showed a limit the API did not
  // enforce and disabled the Add button while the server would still accept the
  // request. It also cannot be derived locally any more: a paid org is capped by
  // the seats it bought, which only the server knows.
  const [seatInfo, setSeatInfo] = useState(null);
  const memberLimit = user?.role === "super_admin"
    ? Infinity
    : (seatInfo?.limit ?? Infinity);
  const atLimit = seatInfo ? !seatInfo.canAdd && user?.role !== "super_admin" : false;

  const loadSeats = async () => {
    try {
      const { data } = await api.get("/org/seats");
      setSeatInfo(data.seats || null);
    } catch {
      // Non-fatal: the server enforces the cap regardless, so a failure here
      // costs the meter, not the guard rail.
      setSeatInfo(null);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/auth/users");
      setUsers(response.data.users || []);
      loadSeats();
    } catch {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const grouped = useMemo(() => ({
    admin: users.filter((member) => member.role === "admin"),
    manager: users.filter((member) => member.role === "manager"),
    agent: users.filter((member) => member.role === "agent"),
  }), [users]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyMember);
    setShowPwd(false);
    setShowModal(true);
  };

  const openEdit = (member) => {
    setEditingUser(member);
    setForm({
      name: member.name || "",
      email: member.email || "",
      password: "",
      phone: member.phone || "",
      role: member.role || "agent",
      avatar: member.avatar || "",
      isActive: member.isActive ?? true,
    });
    setShowPwd(false);
    setShowModal(true);
  };

  const handleChange = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please choose an image under 2 MB");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result);
      setForm((current) => ({ ...current, avatar: compressed }));
      toast.success("Profile image ready to save");
    };
    reader.onerror = () => toast.error("Could not read that image");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        avatar: form.avatar,
        isActive: form.isActive,
      };

      if (!editingUser || form.password) {
        const pwd = form.password;
        const pwdOk = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+{};:,<.>?/\\|[\]~`])/.test(pwd);
        if (pwd.length < 8 || !pwdOk) {
          toast.error("Password must be 8+ characters with 1 uppercase, 1 number, and 1 special character");
          setSaving(false);
          return;
        }
        payload.password = pwd;
      }

      if (editingUser) {
        const { data } = await api.patch(`/auth/users/${editingUser._id}`, payload);
        setUsers((current) => current.map((member) => (member._id === editingUser._id ? data.user : member)));
        toast.success("Team member updated");
      } else {
        const { data } = await api.post("/auth/users", payload);
        setUsers((current) => [data.user, ...current]);
        toast.success("Team member added");
      }

      setShowModal(false);
      setEditingUser(null);
      setForm(emptyMember);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save team member");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (member) => {
    try {
      const { data } = await api.patch(`/auth/users/${member._id}/toggle`);
      setUsers((current) => current.map((item) => (item._id === member._id ? data.user : item)));
      toast.success(`User ${data.user.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update user");
    }
  };

  const removeUser = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/auth/users/${deletingUser._id}`);
      setUsers((current) => current.filter((member) => member._id !== deletingUser._id));
      toast.success("Team member removed");
      setDeletingUser(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove user");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="stitch-kicker mb-2">People Ops</p>
            <h1 className="text-3xl font-black tracking-tight text-app">Team Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-soft">
              View everyone in the CRM, assign roles, and control who can access your sales workspace.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {memberLimit < Infinity && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full border"
                  style={{ background: atLimit ? "rgba(239,68,68,0.1)" : "rgba(var(--app-primary-rgb),0.08)", color: atLimit ? "#ef4444" : "var(--app-primary)", borderColor: atLimit ? "rgba(239,68,68,0.3)" : "rgba(var(--app-primary-rgb),0.2)" }}>
                  {seatInfo?.used ?? users.length}/{memberLimit} seats · {planLabel(org?.plan)}
                </span>
              )}
              {/* At the ceiling, offer the action that actually clears it.
                  Being capped by purchased seats needs more seats; being capped
                  by the plan needs a bigger plan. Pointing at an upgrade when
                  all they need is a seat sells the wrong thing. */}
              {atLimit ? (
                <Link to="/plans" className="btn-primary rounded-xl"
                  title={seatInfo?.cappedByPurchase
                    ? `All ${memberLimit} of your seats are in use.`
                    : `${planLabel(org?.plan)} plan is limited to ${memberLimit} members.`}>
                  <Plus className="h-4 w-4" />
                  {seatInfo?.cappedByPurchase ? "Add seats" : "Upgrade plan"}
                </Link>
              ) : (
                <button data-tour="invite-btn" className="btn-primary rounded-xl" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add Team Member
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Admins" value={grouped.admin.length} note="System owners" icon={Shield} />
        <SummaryCard label="Managers" value={grouped.manager.length} note="Sales floor leaders" icon={UserCog} />
        <SummaryCard label="Agents" value={grouped.agent.length} note="Lead handlers" icon={Users} />
      </section>

      {users.length === 0 ? (
        <section className="card">
          <EmptyState title="No team members found" desc="Create your first teammate to start assigning leads." action={isAdmin ? <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add Team Member</button> : null} />
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {users.map((member) => (
            <article key={member._id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="h-12 w-12 rounded-2xl object-cover border" style={{ borderColor: "var(--app-border)" }} />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-bold text-orange-500">
                      {member.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-app">{member.name}</h3>
                    <p className="truncate text-xs text-app-soft">{member.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <RoleBadge role={member.role} />
                      <span className={`badge ${member.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 shrink-0 text-app-soft" />
                {member.phone
                  ? <span className="text-app">{member.phone}</span>
                  : <span className="text-app-soft italic">No phone added</span>}
              </div>

              <div className="flex items-center gap-1 pt-3" style={{ borderTop: "1px solid var(--app-border)" }}>
                <button className="btn-secondary rounded-xl !px-3 !py-2 !text-xs" onClick={() => openEdit(member)} disabled={!isAdmin} title={!isAdmin ? "Only admins can edit team members" : undefined}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button className="btn-ghost rounded-xl !px-3 !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-50" onClick={() => toggleUser(member)} disabled={!isAdmin} title={!isAdmin ? "Only admins can activate or deactivate users" : undefined}>
                  {member.isActive
                    ? <><UserMinus className="h-3.5 w-3.5" /> Deactivate</>
                    : <><UserCheck className="h-3.5 w-3.5" /> Activate</>}
                </button>
                <button
                  className="btn-ghost ml-auto rounded-xl !px-2.5 !py-2 hover:!text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setDeletingUser(member)}
                  disabled={!isAdmin}
                  aria-label={`Remove ${member.name}`}
                  title={!isAdmin ? "Only admins can remove team members" : `Remove ${member.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingUser ? "Edit Team Member" : "Add Team Member"} size="lg">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={handleChange("name")} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={handleChange("email")} required />
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="10-digit mobile number"
              required={!editingUser}
              minLength={10}
            />
            {!editingUser && (
              <p className="mt-1 text-[11px] text-app-soft">Required - used for follow-up alerts and team contact.</p>
            )}
          </div>
          <div>
            <label className="label">Role</label>
            <CustomSelect
              value={form.role}
              onChange={(v) => handleChange("role")({ target: { value: v } })}
              options={[
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
                { value: "agent", label: "Sales Agent" },
              ]}
              style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 16 }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Profile Picture URL</label>
            <input className="input" value={form.avatar} onChange={handleChange("avatar")} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label className="label flex items-center gap-2"><ImagePlus className="h-4 w-4 text-orange-500" /> Or Upload Profile Picture</label>
            <label className="btn-secondary inline-flex cursor-pointer rounded-xl">
              <ImagePlus className="h-4 w-4" /> Choose Image
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
            </label>
            <p className="mt-2 text-xs text-app-soft">PNG, JPG, WEBP, or GIF up to 2 MB.</p>
          </div>
          {form.avatar && (
            <div className="md:col-span-2 flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
              <img src={form.avatar} alt="Avatar preview" className="h-14 w-14 rounded-2xl object-cover border" style={{ borderColor: "var(--app-border)" }} />
              <div>
                <p className="text-sm font-semibold text-app">Avatar preview</p>
                <p className="text-xs text-app-soft">This image will be saved for the selected team member.</p>
              </div>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="label">{editingUser ? "Set New Password (optional)" : "Temporary Password"}</label>
            <div className="relative">
              <input className="input pr-10" type={showPwd ? "text" : "password"} value={form.password} onChange={handleChange("password")} required={!editingUser} placeholder="8+ chars, uppercase, number, special" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-app-soft hover:text-app" onClick={() => setShowPwd((v) => !v)}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm text-app" style={{ borderColor: "var(--app-border)", background: "var(--app-surface-low)" }}>
            <input type="checkbox" checked={form.isActive} onChange={handleChange("isActive")} />
            Member can access the CRM immediately
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editingUser ? "Update Member" : "Add Member"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={removeUser}
        loading={deleteLoading}
        title="Remove Team Member"
        message={deletingUser ? `Remove ${deletingUser.name} from the CRM? This action cannot be undone.` : ""}
      />
    </div>
  );
}

function SummaryCard({ label, value, note, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="stitch-kicker mb-2">{label}</p>
          <p className="text-3xl font-black tracking-tight text-app">{value}</p>
          <p className="mt-2 text-xs text-app-soft">{note}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
