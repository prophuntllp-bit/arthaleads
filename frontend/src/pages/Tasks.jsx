import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import toast from "react-hot-toast";
import { useSEO } from "../utils/useSEO";
import {
  Plus, Pencil, Trash2, CheckCircle2, Calendar, User,
  FolderKanban, Users, Clock, AlertCircle, X,
} from "lucide-react";
import { Modal, Spinner, EmptyState } from "../components/UI";
import CustomSelect from "../components/CustomSelect";
import DateTimePicker from "../components/DateTimePicker";

// Debounced lead search-select — resolves to a real Lead _id (not just a label)
// so tasks stay genuinely linked to the lead they're about. Remounts fresh each
// time the parent Modal opens (see Modal: `if (!open) return null`), so the
// uncontrolled `query` state always starts from the right label.
function LeadPicker({ initialLabel, onSelect, onClear }) {
  const [query, setQuery]     = useState(initialLabel || "");
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef     = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/leads?search=${encodeURIComponent(q.trim())}&limit=8`);
        setResults(data.leads || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        className="input w-full pr-8"
        placeholder="Search lead by name or phone…"
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          onClear();
          search(v);
        }}
        onFocus={() => { if (results.length) setOpen(true); }}
      />
      {query && (
        <button type="button" onClick={() => { setQuery(""); setResults([]); setOpen(false); onClear(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-soft hover:text-app">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full rounded-2xl border overflow-hidden shadow-xl"
          style={{ background: "var(--app-surface)", borderColor: "var(--app-border)", maxHeight: 220, overflowY: "auto" }}>
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-app-soft">Searching…</div>
          ) : results.map((l) => (
            <button key={l._id} type="button"
              className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => { onSelect(l); setQuery(l.name); setOpen(false); }}>
              <span className="text-sm font-semibold text-app">{l.name}</span>
              {l.phone && <span className="text-xs text-app-soft">{l.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PRIORITY_META = {
  critical: { label: "Critical", bg: "bg-red-100 dark:bg-red-500/20",    text: "text-red-600 dark:text-red-400",    dot: "bg-red-500" },
  high:     { label: "High",     bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  medium:   { label: "Medium",   bg: "bg-yellow-100 dark:bg-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  low:      { label: "Low",      bg: "bg-green-100 dark:bg-green-500/20",  text: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
};

const EMPTY_FORM = {
  title: "", description: "", priority: "medium", dueDate: "",
  assignedTo: "", assignedToName: "",
  lead: "", leadName: "", project: "", projectName: "",
};

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function SummaryCard({ label, count, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[120px] rounded-2xl p-4 text-left transition-all ${active ? "ring-2 ring-orange-500 shadow-md" : "hover:opacity-80"}`}
      style={{ background: color }}
    >
      <p className="text-2xl font-black text-white">{count}</p>
      <p className="text-xs font-semibold text-white/80 mt-0.5">{label}</p>
    </button>
  );
}

export default function Tasks() {
  useSEO({ title: "Tasks – Arthaleads", robots: "noindex" });

  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "manager";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tasks, setTasks]         = useState([]);
  const [summary, setSummary]     = useState({ today: 0, upcoming: 0, overdue: 0, completed: 0, all: 0 });
  const [loading, setLoading]     = useState(true);
  const [activeCard, setActiveCard] = useState("all");
  const [myOnly, setMyOnly]       = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);
  const [projects, setProjects]       = useState([]);

  // Modal state
  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  // Complete modal
  const [completeTask, setCompleteTask] = useState(null);
  const [completeNote, setCompleteNote] = useState("");
  const [completing, setCompleting]     = useState(false);

  // Delete
  const [deleteTask, setDeleteTask] = useState(null);
  const [deleting, setDeleting]     = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (myOnly) params.set("myOnly", "true");
      if (priorityFilter) params.set("priority", priorityFilter);

      // Map card selection to status filter
      if (activeCard === "completed") params.set("status", "completed");
      if (activeCard === "pending")   params.set("status", "pending");

      const { data } = await api.get(`/tasks?${params}`);
      setSummary(data.summary);

      // Client-side filter for today/upcoming/overdue cards
      let filtered = data.tasks;
      if (activeCard === "today") {
        const s = new Date(); s.setHours(0,0,0,0);
        const e = new Date(); e.setHours(23,59,59,999);
        filtered = data.tasks.filter(t => t.status !== "completed" && new Date(t.dueDate) >= s && new Date(t.dueDate) <= e);
      } else if (activeCard === "upcoming") {
        const e = new Date(); e.setHours(23,59,59,999);
        filtered = data.tasks.filter(t => t.status !== "completed" && new Date(t.dueDate) > e);
      } else if (activeCard === "overdue") {
        const s = new Date(); s.setHours(0,0,0,0);
        filtered = data.tasks.filter(t => t.status !== "completed" && new Date(t.dueDate) < s);
      }

      setTasks(filtered);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [myOnly, priorityFilter, activeCard]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Auto-open Add Task modal when navigated via sidebar "Add Task" link
  useEffect(() => {
    if (canManage && searchParams.get("new") === "1") {
      setForm(EMPTY_FORM); setEditTask(null); setShowForm(true);
      navigate("/tasks", { replace: true });
    }
  }, [searchParams, canManage, navigate]);

  useEffect(() => {
    if (!canManage) return;
    api.get("/auth/agents").then(({ data }) => setTeamMembers(data.agents || [])).catch(() => toast.error("Failed to load team members"));
    api.get("/projects").then(({ data }) => setProjects(data.data || [])).catch(() => {});
  }, [canManage]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditTask(null); setShowForm(true); };
  const openEdit = (t) => {
    setEditTask(t);
    setForm({
      title:           t.title,
      description:     t.description || "",
      priority:        t.priority,
      dueDate:         t.dueDate ? new Date(t.dueDate).toISOString().slice(0,16) : "",
      assignedTo:      t.assignedTo?._id || t.assignedTo || "",
      assignedToName:  t.assignedToName || "",
      lead:            t.lead?._id || t.lead || "",
      leadName:        t.leadName || "",
      project:         t.project?._id || t.project || "",
      projectName:     t.projectName || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.assignedTo)   return toast.error("Please assign to a team member");
    if (!form.dueDate)      return toast.error("Due date is required");

    // Resolve assignedToName from teamMembers if not set
    const member = teamMembers.find(m => (m._id || m.id) === form.assignedTo);
    const payload = {
      ...form,
      assignedToName: member?.name || form.assignedToName,
    };

    setSaving(true);
    try {
      if (editTask) {
        await api.patch(`/tasks/${editTask._id}`, payload);
        toast.success("Task updated");
      } else {
        await api.post("/tasks", payload);
        toast.success("Task created");
      }
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.patch(`/tasks/${completeTask._id}/complete`, { note: completeNote });
      toast.success("Task marked as completed");
      setCompleteTask(null);
      setCompleteNote("");
      fetchTasks();
    } catch {
      toast.error("Failed to complete task");
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/tasks/${deleteTask._id}`);
      toast.success("Task deleted");
      setDeleteTask(null);
      fetchTasks();
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const dueBadge = (task) => {
    if (task.status === "completed") return null;
    const now = new Date();
    const due = new Date(task.dueDate);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    if (due < todayStart) return <span className="text-xs font-semibold text-red-500">Overdue</span>;
    if (due <= todayEnd)  return <span className="text-xs font-semibold text-orange-500">Today</span>;
    return null;
  };

  const cards = [
    { key: "all",       label: "All",       count: summary.all,       color: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
    { key: "today",     label: "Today",     count: summary.today,     color: "linear-gradient(135deg,#f59e0b,#f97316)" },
    { key: "upcoming",  label: "Upcoming",  count: summary.upcoming,  color: "linear-gradient(135deg,#10b981,#059669)" },
    { key: "overdue",   label: "Overdue",   count: summary.overdue,   color: "linear-gradient(135deg,#ef4444,#dc2626)" },
    { key: "completed", label: "Completed", count: summary.completed, color: "linear-gradient(135deg,#64748b,#475569)" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-app">Tasks</h1>
          <p className="text-sm text-app-soft mt-0.5">
            {canManage ? "Assign and track tasks for your team" : "Your assigned tasks"}
          </p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Task
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 flex-wrap">
        {cards.map(c => (
          <SummaryCard key={c.key} {...c} active={activeCard === c.key} onClick={() => setActiveCard(c.key)} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {canManage && (
          <button
            onClick={() => setMyOnly(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${myOnly ? "bg-orange-500 text-white border-orange-500" : "border-app-border text-app-soft hover:text-app"}`}
          >
            {myOnly ? "My Tasks" : "All Tasks"}
          </button>
        )}
        <CustomSelect
          value={priorityFilter}
          onChange={v => setPriorityFilter(v)}
          placeholder="All Priorities"
          options={[
            { value: "critical", label: "Critical" },
            { value: "high",     label: "High" },
            { value: "medium",   label: "Medium" },
            { value: "low",      label: "Low" },
          ]}
          style={{ minWidth: 140 }}
        />
      </div>

      {/* Task table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : tasks.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No tasks" desc={canManage ? "Create a task to assign to your team." : "No tasks assigned to you yet."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="stitch-table w-full">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Task</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                  <th>Linked To</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task._id}>
                    <td><PriorityBadge priority={task.priority} /></td>
                    <td>
                      <div className="font-semibold text-app text-sm">{task.title}</div>
                      {task.description && <div className="text-xs text-app-soft mt-0.5 truncate max-w-[220px]">{task.description}</div>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">
                          {(task.assignedToName || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-app">{task.assignedToName || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm text-app">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </div>
                      <div>{dueBadge(task)}</div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        {task.lead && (
                          <Link to={`/leads`} className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <User className="h-3 w-3" /> {task.leadName || "Lead"}
                          </Link>
                        )}
                        {task.project && (
                          <Link to={`/projects/${task.project}`} className="flex items-center gap-1 text-xs text-violet-500 hover:underline">
                            <FolderKanban className="h-3 w-3" /> {task.projectName || "Project"}
                          </Link>
                        )}
                        {!task.lead && !task.project && <span className="text-xs text-app-soft">—</span>}
                      </div>
                    </td>
                    <td>
                      {task.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {task.status !== "completed" && (
                          <button
                            onClick={() => { setCompleteTask(task); setCompleteNote(""); }}
                            className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition"
                            title="Mark complete"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg text-app-soft hover:bg-black/5 dark:hover:bg-white/10 transition" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteTask(task)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editTask ? "Edit Task" : "New Task"} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-app-soft mb-1.5">Title <span className="text-red-500">*</span></label>
            <input
              className="input w-full"
              placeholder="e.g. Follow up with client"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-soft mb-1.5">Description</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Optional details..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-app-soft mb-1.5">Assign To <span className="text-red-500">*</span></label>
              <CustomSelect
                value={form.assignedTo}
                onChange={v => {
                  const m = teamMembers.find(x => (x._id || x.id) === v);
                  setForm(f => ({ ...f, assignedTo: v, assignedToName: m?.name || "" }));
                }}
                placeholder="Select member"
                options={teamMembers.map(m => ({ value: m._id || m.id, label: m.name }))}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-app-soft mb-1.5">Priority <span className="text-red-500">*</span></label>
              <CustomSelect
                value={form.priority}
                onChange={v => setForm(f => ({ ...f, priority: v }))}
                placeholder="Select priority"
                options={[
                  { value: "critical", label: "Critical" },
                  { value: "high",     label: "High" },
                  { value: "medium",   label: "Medium" },
                  { value: "low",      label: "Low" },
                ]}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-soft mb-1.5">Due Date & Time <span className="text-red-500">*</span></label>
            <DateTimePicker
              value={form.dueDate}
              onChange={v => setForm(f => ({ ...f, dueDate: v }))}
              triggerClassName="w-full"
              triggerStyle={{ padding: "12px 16px", borderRadius: "1rem", fontSize: 14, minWidth: 0 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-app-soft mb-1.5">
                <FolderKanban className="inline h-3 w-3 mr-1" />Link to Project (optional)
              </label>
              <CustomSelect
                value={form.project}
                onChange={v => {
                  const p = projects.find(x => x._id === v);
                  setForm(f => ({ ...f, project: v, projectName: p?.name || "" }));
                }}
                placeholder="Select project"
                options={projects.map(p => ({ value: p._id, label: p.name }))}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "1rem", fontSize: 14 }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-soft mb-1.5">
                <User className="inline h-3 w-3 mr-1" />Link to Lead (optional)
              </label>
              <LeadPicker
                initialLabel={form.leadName}
                onSelect={(l) => setForm(f => ({ ...f, lead: l._id, leadName: l.name }))}
                onClear={() => setForm(f => ({ ...f, lead: "", leadName: "" }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Spinner size="sm" />}
              {editTask ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal open={!!completeTask} onClose={() => setCompleteTask(null)} title="Mark as Completed" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-app">
            Marking <strong>"{completeTask?.title}"</strong> as completed.
          </p>
          <div>
            <label className="block text-xs font-semibold text-app-soft mb-1.5">Completion Note (optional)</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Add a note about how this was completed..."
              value={completeNote}
              onChange={e => setCompleteNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCompleteTask(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleComplete} disabled={completing} className="btn-primary flex items-center gap-2">
              {completing && <Spinner size="sm" />}
              <CheckCircle2 className="h-4 w-4" /> Mark Complete
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTask} onClose={() => setDeleteTask(null)} title="Delete Task" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-app">
            Are you sure you want to delete <strong>"{deleteTask?.title}"</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTask(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger flex items-center gap-2">
              {deleting && <Spinner size="sm" />}
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
