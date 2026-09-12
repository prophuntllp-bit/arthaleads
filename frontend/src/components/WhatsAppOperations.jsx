import { useEffect, useRef, useState } from "react";
import {
  Clock, Users, Bell, ShieldCheck, Building2 as ProfileIcon, Loader2, Check, Lock, Camera,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import CustomSelect from "./CustomSelect";

const SELECT_STYLE = { width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 };

// Longer side capped to 640px — sharp enough for a profile photo (displayed
// as a small circular avatar in WhatsApp) without pushing a phone photo's
// several-MB original anywhere near the 4MB the backend accepts.
function compressImage(dataUri, maxPx = 640) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, matching org.whatsapp.businessHours.schedule's day: 0=Sun..6=Sat
const DAY_LABEL = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
const DEFAULT_SCHEDULE = DAY_ORDER.map((day) => ({
  day, closed: day === 0 || day === 6, open: "09:00", close: "18:00",
}));

function Card({ icon: Icon, title, description, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
        <h3 className="text-base font-bold text-app">{title}</h3>
      </div>
      {description && <p className="text-sm text-app-soft">{description}</p>}
      {children}
    </div>
  );
}

// ── Business hours & away message ─────────────────────────────────────────────
function BusinessHoursCard({ wa, patch }) {
  const [enabled, setEnabled]         = useState(wa.businessHours?.enabled || false);
  const [timezone, setTimezone]       = useState(wa.businessHours?.timezone || "Asia/Kolkata");
  const [awayMessage, setAwayMessage] = useState(wa.businessHours?.awayMessage || "");
  const [schedule, setSchedule]       = useState(() => {
    const existing = wa.businessHours?.schedule || [];
    return DAY_ORDER.map((day) => existing.find((d) => d.day === day) || DEFAULT_SCHEDULE.find((d) => d.day === day));
  });
  const [saving, setSaving] = useState(false);

  const updateDay = (day, patchDay) => setSchedule((cur) => cur.map((d) => (d.day === day ? { ...d, ...patchDay } : d)));

  const save = async () => {
    setSaving(true);
    try {
      await patch({ businessHours: { enabled, timezone, awayMessage, schedule } });
      toast.success("Business hours saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <Card icon={Clock} title="Business hours"
      description="Outside these hours the assistant stops replying and sends an away message instead. Leave off to keep replying around the clock.">
      <label className="flex items-center gap-2.5 text-sm font-semibold text-app cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Restrict to business hours
      </label>

      {enabled && (
        <div className="space-y-3 pl-1">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Timezone</label>
            <input className="input w-full max-w-xs" value={timezone} onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata" />
          </div>
          <div className="rounded-xl overflow-hidden divide-y" style={{ border: "1px solid var(--app-border)" }}>
            {schedule.map((d) => (
              <div key={d.day} className="flex items-center gap-3 px-3 py-2 flex-wrap">
                <span className="text-sm font-semibold text-app w-10 shrink-0">{DAY_LABEL[d.day]}</span>
                <label className="flex items-center gap-1.5 text-xs text-app-soft shrink-0">
                  <input type="checkbox" checked={d.closed} onChange={(e) => updateDay(d.day, { closed: e.target.checked })} />
                  Closed
                </label>
                {!d.closed && (
                  <div className="flex items-center gap-2 text-xs">
                    <input type="time" className="input py-1 px-2 text-xs" value={d.open}
                      onChange={(e) => updateDay(d.day, { open: e.target.value })} />
                    <span className="text-app-soft">to</span>
                    <input type="time" className="input py-1 px-2 text-xs" value={d.close}
                      onChange={(e) => updateDay(d.day, { close: e.target.value })} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Away message</label>
            <textarea className="input w-full resize-none" rows={2}
              placeholder="Thanks for reaching out! We're closed right now — back at 9am, and we'll reply first thing."
              value={awayMessage} onChange={(e) => setAwayMessage(e.target.value)} />
            <p className="text-xs text-app-soft mt-1">Sent at most once a day per conversation, not on every message.</p>
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        {saving ? "Saving…" : "Save business hours"}
      </button>
    </Card>
  );
}

// ── Conversation auto-assignment ──────────────────────────────────────────────
function AutoAssignCard({ wa, patch }) {
  const [enabled, setEnabled] = useState(wa.autoAssignConversations || false);
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await patch({ autoAssignConversations: enabled });
      toast.success("Saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <Card icon={Users} title="Conversation auto-assignment"
      description="When the assistant hands off to a human (or starts a conversation with the bot off), round-robin it to an agent automatically — same as new Leads already do.">
      <label className="flex items-center gap-2.5 text-sm font-semibold text-app cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Auto-assign handed-off conversations
      </label>
      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        {saving ? "Saving…" : "Save"}
      </button>
    </Card>
  );
}

// ── Notification recipients ───────────────────────────────────────────────────
function RecipientPicker({ label, agents, selected, onToggle }) {
  return (
    <div>
      <p className="text-xs font-semibold text-app-soft mb-1.5">{label}</p>
      {agents.length === 0 ? (
        <p className="text-xs text-app-soft italic">No team members yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => (
            <button key={a._id} type="button" onClick={() => onToggle(a._id)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full transition"
              style={selected.includes(a._id)
                ? { background: "var(--app-primary)", color: "#fff" }
                : { background: "var(--app-border)", color: "var(--app-text-soft)" }}>
              {a.name}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-app-soft mt-1">
        {selected.length ? `${selected.length} selected — only they get pinged.` : "Nobody selected — everyone (or the assigned agent) gets pinged, same as today."}
      </p>
    </div>
  );
}

function NotificationsCard({ wa, patch, agents }) {
  const [newConversation, setNewConversation] = useState((wa.notifyOn?.newConversation || []).map(String));
  const [lowCredits, setLowCredits]           = useState((wa.notifyOn?.lowCredits || []).map(String));
  const [qualityDrop, setQualityDrop]         = useState((wa.notifyOn?.qualityDrop || []).map(String));
  const [saving, setSaving] = useState(false);

  const toggle = (setter) => (id) => setter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    setSaving(true);
    try {
      await patch({ notifyOn: { newConversation, lowCredits, qualityDrop } });
      toast.success("Saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <Card icon={Bell} title="Notification recipients"
      description="Choose who gets pinged for each event. Leave a category empty to keep the current default.">
      <div className="space-y-4">
        <RecipientPicker label="New WhatsApp conversation" agents={agents} selected={newConversation} onToggle={toggle(setNewConversation)} />
        <RecipientPicker label="Low WhatsApp credits (admins only)" agents={agents.filter((a) => a.role === "admin")} selected={lowCredits} onToggle={toggle(setLowCredits)} />
        <RecipientPicker label="Quality rating drop" agents={agents} selected={qualityDrop} onToggle={toggle(setQualityDrop)} />
      </div>
      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        {saving ? "Saving…" : "Save notification settings"}
      </button>
    </Card>
  );
}

// ── Consent & compliance snapshot ─────────────────────────────────────────────
function ConsentSnapshotCard() {
  const [counts, setCounts]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/whatsapp/consent-summary")
      .then((r) => setCounts(r.data.counts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = counts ? counts.granted + counts.denied + counts.unknown : 0;
  const stat = (label, n, color) => (
    <div className="flex-1 min-w-[100px] rounded-xl p-3" style={{ background: "var(--app-surface-low)" }}>
      <p className="text-xl font-bold" style={{ color }}>{n}</p>
      <p className="text-xs text-app-soft">{label}</p>
    </div>
  );

  return (
    <Card icon={ShieldCheck} title="Consent & compliance"
      description="WhatsApp marketing consent recorded across your leads. Campaigns only ever send to Granted.">
      {loading ? (
        <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      ) : counts ? (
        <div className="flex gap-3 flex-wrap">
          {stat("Granted", counts.granted, "#15803d")}
          {stat("Denied", counts.denied, "#b91c1c")}
          {stat("Unrecorded", counts.unknown, "var(--app-text-soft)")}
        </div>
      ) : (
        <p className="text-xs text-app-soft italic">Could not load consent counts.</p>
      )}
      {!loading && counts && total > 0 && (
        <p className="text-xs text-app-soft">{Math.round((counts.granted / total) * 100)}% of leads have given consent.</p>
      )}
    </Card>
  );
}

// ── WhatsApp Business Profile (Meta only) ─────────────────────────────────────
function BusinessProfileCard() {
  const [applicable, setApplicable] = useState(true);
  const [loading, setLoading]       = useState(true);
  const [loadMessage, setLoadMessage] = useState("");
  const [verticals, setVerticals]   = useState([]);
  const [about, setAbout]           = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress]       = useState("");
  const [email, setEmail]           = useState("");
  const [website1, setWebsite1]     = useState("");
  const [website2, setWebsite2]     = useState("");
  const [vertical, setVertical]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [pin, setPin]               = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [photoUrl, setPhotoUrl]     = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/whatsapp/business-profile").then((r) => {
      if (!r.data.applicable) { setApplicable(false); return; }
      if (!r.data.ok) { setLoadMessage(r.data.message || "Could not load."); return; }
      const p = r.data.profile || {};
      setAbout(p.about || "");
      setDescription(p.description || "");
      setAddress(p.address || "");
      setEmail(p.email || "");
      setWebsite1(p.websites?.[0] || "");
      setWebsite2(p.websites?.[1] || "");
      setVertical(p.vertical || "");
      setPhotoUrl(p.profile_picture_url || "");
      setVerticals(r.data.verticals || []);
    }).catch(() => setLoadMessage("Could not load your Business Profile.")
    ).finally(() => setLoading(false));
  }, []);

  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Only image files are supported"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB"); return; }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const compressed = await compressImage(ev.target.result);
        await api.post("/whatsapp/business-profile/photo", { photo: compressed });
        setPhotoUrl(compressed);
        toast.success("Profile photo updated — may take a minute to appear on WhatsApp");
      } catch (err) {
        toast.error(err.response?.data?.message || "Upload failed");
      } finally { setUploadingPhoto(false); }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/whatsapp/business-profile", {
        about, description, address, email, vertical,
        websites: [website1, website2].filter(Boolean),
      });
      toast.success("Business Profile saved");
    } catch (e) { toast.error(e.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const setTwoStepPin = async () => {
    if (!/^\d{6}$/.test(pin)) { toast.error("PIN must be exactly 6 digits"); return; }
    setSettingPin(true);
    try {
      await api.post("/whatsapp/business-profile/pin", { pin });
      toast.success("2-step verification PIN set");
      setPin("");
    } catch (e) { toast.error(e.response?.data?.message || "Failed to set PIN"); }
    finally { setSettingPin(false); }
  };

  if (loading) {
    return (
      <Card icon={ProfileIcon} title="Business Profile">
        <div className="h-24 rounded-xl animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </Card>
    );
  }
  if (!applicable) {
    return (
      <Card icon={ProfileIcon} title="Business Profile"
        description="Only available for the Meta Cloud API provider — manage your profile in your BSP's own dashboard." />
    );
  }

  return (
    <Card icon={ProfileIcon} title="Business Profile"
      description="What customers see about your business on WhatsApp — no need to open Meta's WhatsApp Manager for these.">
      {loadMessage && <p className="text-xs" style={{ color: "#b45309" }}>{loadMessage}</p>}

      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: "var(--app-surface-low)", border: "1px solid var(--app-border)" }}>
          {photoUrl
            ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            : <ProfileIcon className="w-6 h-6 text-app-soft" />}
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
            className="btn-secondary rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
            {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {uploadingPhoto ? "Uploading…" : "Change photo"}
          </button>
          <p className="text-xs text-app-soft mt-1">Square images work best. Up to 8MB — resized automatically.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1 block">About</label>
          <input className="input w-full" placeholder="A short one-liner shown near your name" maxLength={139}
            value={about} onChange={(e) => setAbout(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1 block">Description</label>
          <textarea className="input w-full resize-none" rows={2} maxLength={256}
            placeholder="What your business does" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1 block">Address</label>
          <input className="input w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1 block">Email</label>
          <input className="input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Website</label>
            <input className="input w-full" type="url" placeholder="https://…" value={website1} onChange={(e) => setWebsite1(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-app-soft mb-1 block">Website (2nd, optional)</label>
            <input className="input w-full" type="url" placeholder="https://…" value={website2} onChange={(e) => setWebsite2(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-app-soft mb-1 block">Category</label>
          <CustomSelect value={vertical} onChange={setVertical} placeholder="Select a category"
            options={verticals.map((v) => ({ value: v, label: v.replace(/_/g, " ") }))} style={SELECT_STYLE} />
        </div>
        <button onClick={saveProfile} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition disabled:opacity-40 btn-secondary">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>

      <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--app-border)" }}>
        <label className="text-xs font-semibold text-app-soft flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Two-step verification PIN
        </label>
        <p className="text-xs text-app-soft">Meta asks for this if the number is ever re-registered. Setting a new PIN replaces the old one — there's nothing to display here for security.</p>
        <div className="flex items-center gap-2">
          <input className="input w-32 font-mono" inputMode="numeric" maxLength={6} placeholder="6 digits"
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button onClick={setTwoStepPin} disabled={settingPin || pin.length !== 6}
            className="btn-secondary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5">
            {settingPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Set PIN
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Top level ──────────────────────────────────────────────────────────────────
export default function WhatsAppOperations() {
  const [wa, setWa]         = useState(null);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/whatsapp/settings"),
      api.get("/auth/agents"),
    ]).then(([settingsRes, agentsRes]) => {
      setWa(settingsRes.data.whatsapp || {});
      setAgents(agentsRes.data.agents || []);
    }).catch(() => toast.error("Could not load operational settings"));
  }, []);

  const patch = async (fields) => {
    const { data } = await api.patch("/whatsapp/settings", fields);
    setWa(data.whatsapp || {});
  };

  if (!wa) {
    return (
      <div className="space-y-5">
        <div className="card p-5 h-32 animate-pulse" style={{ background: "var(--app-surface-low)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BusinessHoursCard wa={wa} patch={patch} />
      <AutoAssignCard wa={wa} patch={patch} />
      <NotificationsCard wa={wa} patch={patch} agents={agents} />
      <ConsentSnapshotCard />
      <BusinessProfileCard />
    </div>
  );
}
