import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff, ImagePlus, Plus, Pencil, Shield, Trash2, UserCog, UserMinus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { ConfirmDialog, EmptyState, Modal, PageLoader } from "../components/UI";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyMember);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/auth/users");
      setUsers(response.data.users || []);
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
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: reader.result }));
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
        payload.password = form.password;
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
            <button className="btn-primary rounded-xl" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Team Member
            </button>
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
                      <span className="badge bg-orange-500/10 text-orange-400 capitalize">{member.role}</span>
                      <span className={`badge ${member.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.1rem] p-4 stitch-surface-muted space-y-2">
                <p className="text-xs text-app-soft">Phone</p>
                <p className="text-sm text-app">{member.phone || "Not added yet"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary rounded-xl" onClick={() => toggleUser(member)} disabled={!isAdmin} title={!isAdmin ? "Only admins can activate or deactivate users" : undefined}>
                  <UserMinus className="h-4 w-4" /> {member.isActive ? "Deactivate" : "Activate"}
                </button>
                <button className="btn-secondary rounded-xl" onClick={() => openEdit(member)} disabled={!isAdmin} title={!isAdmin ? "Only admins can edit team members" : undefined}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button className="btn-danger rounded-xl" onClick={() => setDeletingUser(member)} disabled={!isAdmin} title={!isAdmin ? "Only admins can remove team members" : undefined}>
                  <Trash2 className="h-4 w-4" /> Remove
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
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={handleChange("phone")} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="select" value={form.role} onChange={handleChange("role")}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Sales Agent</option>
            </select>
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
              <input className="input pr-10" type={showPwd ? "text" : "password"} value={form.password} onChange={handleChange("password")} required={!editingUser} />
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
