import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Camera, ImagePlus, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function Settings() {
  const { user, updateUserState, refreshUser } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    avatar: "",
    role: "agent",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      avatar: user?.avatar || "",
      role: user?.role || "agent",
      currentPassword: "",
      newPassword: "",
    });
  }, [user]);

  const profilePreview = useMemo(() => form.avatar || user?.avatar || "", [form.avatar, user?.avatar]);

  const setValue = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
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
        phone: form.phone,
        avatar: form.avatar,
        role: form.role,
      };

      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const { data } = await api.put("/auth/me", payload);
      updateUserState(data.user);
      await refreshUser();
      setForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      toast.success("Settings updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stitch-page space-y-6">
      <section className="card p-6">
        <p className="stitch-kicker mb-2">Profile Control</p>
        <h1 className="text-3xl font-black tracking-tight text-app">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-app-soft">
          Update your profile, refresh your password, and manage the permissions tied to your CRM identity.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.5fr]">
        <section className="card p-6 space-y-5">
          <div className="flex items-center gap-4">
            {profilePreview ? (
              <img src={profilePreview} alt={form.name} className="h-20 w-20 rounded-[1.5rem] object-cover border" style={{ borderColor: "var(--app-border)" }} />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-orange-500/10 text-2xl font-bold text-orange-500">
                {form.name?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-app">{form.name || user?.name}</p>
              <p className="text-sm text-app-soft">{user?.email}</p>
              <span className="badge mt-3 bg-orange-500/10 text-orange-400 capitalize">{form.role}</span>
            </div>
          </div>

          <div className="rounded-[1.25rem] p-4 stitch-surface-muted space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-app"><ShieldCheck className="h-4 w-4 text-orange-500" /> Role Access</div>
            <p className="text-sm text-app-soft">This role controls what you can see across team, analytics, and lead assignment workflows.</p>
            <div>
              <label className="label">Role</label>
              <select className="select" value={form.role} onChange={setValue("role")}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="agent">Sales Agent</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={form.name} onChange={setValue("name")} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={setValue("phone")} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Email</label>
                <input className="input text-app-soft" style={{ background: "var(--app-surface-low)" }} value={user?.email || ""} disabled />
              </div>
              <div className="md:col-span-2">
                <label className="label flex items-center gap-2"><Camera className="h-4 w-4 text-orange-500" /> Profile Picture URL</label>
                <input className="input" value={form.avatar} onChange={setValue("avatar")} placeholder="https://example.com/avatar.jpg" />
              </div>
              <div className="md:col-span-2">
                <label className="label flex items-center gap-2"><ImagePlus className="h-4 w-4 text-orange-500" /> Or Upload Profile Picture</label>
                <label className="btn-secondary inline-flex cursor-pointer rounded-xl">
                  <ImagePlus className="h-4 w-4" /> Choose Image
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
                </label>
                <p className="mt-2 text-xs text-app-soft">PNG, JPG, WEBP, or GIF up to 2 MB. The image is stored directly in your CRM profile.</p>
              </div>
            </div>

            <div className="rounded-[1.25rem] p-5 stitch-surface-muted space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-app"><KeyRound className="h-4 w-4 text-orange-500" /> Change Password</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Current Password</label>
                  <input className="input" type="password" value={form.currentPassword} onChange={setValue("currentPassword")} placeholder="Required to set a new password" />
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input className="input" type="password" value={form.newPassword} onChange={setValue("newPassword")} placeholder="Minimum 6 characters" />
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] p-5 stitch-surface-muted space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-app"><UserRound className="h-4 w-4 text-orange-500" /> Permission Notes</div>
              <p className="text-sm text-app-soft">Admins can change roles directly. Managers and agents can click the role field, but the backend will still protect restricted updates.</p>
            </div>

            <div className="flex justify-end">
              <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
