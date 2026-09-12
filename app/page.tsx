"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Check, Clock3, LoaderCircle, Plus, Settings2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Assignment = {
  id: number;
  title: string;
  course: string;
  dueDate: string;
  estimatedMinutes: number;
  status: "open" | "complete";
};

type PlannerSettings = { availableMinutes: number; sessionMinutes: number };

const defaultSettings: PlannerSettings = { availableMinutes: 120, sessionMinutes: 35 };

function dateValue(value: string) {
  return new Date(`${value}T12:00:00`);
}

function dueLabel(value: string) {
  const due = dateValue(value);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

export default function Home() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [settings, setSettings] = useState<PlannerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [draftAvailable, setDraftAvailable] = useState("120");
  const [draftSession, setDraftSession] = useState("35");

  useEffect(() => {
    Promise.all([
      jsonRequest<{ assignments: Assignment[] }>("/api/assignments"),
      jsonRequest<{ settings: PlannerSettings }>("/api/settings"),
    ]).then(([assignmentData, settingsData]) => {
      setAssignments(assignmentData.assignments);
      setSettings(settingsData.settings);
      setDraftAvailable(String(settingsData.settings.availableMinutes));
      setDraftSession(String(settingsData.settings.sessionMinutes));
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: Record<string, unknown>, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_assignment",
      title: "Add assignment",
      description: "Add a school assignment to Study Pilot and refresh the visible plan.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" }, course: { type: "string" }, dueDate: { type: "string", description: "YYYY-MM-DD" }, estimatedMinutes: { type: "number", minimum: 10, maximum: 480 },
        },
        required: ["title", "course", "dueDate", "estimatedMinutes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        const value = input as Partial<Assignment>;
        if (!value.title?.trim() || !value.course?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate ?? "")) throw new Error("A title, class, and YYYY-MM-DD due date are required.");
        const data = await jsonRequest<{ assignment: Assignment }>("/api/assignments", { method: "POST", body: JSON.stringify(value) });
        setAssignments((current) => [...current, data.assignment].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        return { id: data.assignment.id, status: "added" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const active = useMemo(() => [...assignments].filter((item) => item.status === "open").sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [assignments]);
  const totalMinutes = active.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const todayPlan = useMemo(() => {
    let remaining = settings.availableMinutes;
    const plan: { assignment: Assignment; minutes: number }[] = [];
    for (const assignment of active) {
      if (remaining <= 0 || plan.length >= 3) break;
      const minutes = Math.min(assignment.estimatedMinutes, settings.sessionMinutes, remaining);
      plan.push({ assignment, minutes });
      remaining -= minutes;
    }
    return plan;
  }, [active, settings]);

  async function addAssignment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await jsonRequest<{ assignment: Assignment }>("/api/assignments", {
        method: "POST",
        body: JSON.stringify({ title, course, dueDate, estimatedMinutes: Number(estimatedMinutes) }),
      });
      setAssignments((current) => [...current, data.assignment]);
      setTitle(""); setCourse(""); setDueDate(""); setEstimatedMinutes("30"); setAddOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add the assignment.");
    } finally { setSaving(false); }
  }

  async function complete(id: number) {
    setError("");
    try {
      await jsonRequest(`/api/assignments/${id}`, { method: "PATCH", body: JSON.stringify({ status: "complete" }) });
      setAssignments((current) => current.map((item) => item.id === id ? { ...item, status: "complete" } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the assignment."); }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await jsonRequest<{ settings: PlannerSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ availableMinutes: Number(draftAvailable), sessionMinutes: Number(draftSession) }),
      });
      setSettings(data.settings); setSettingsOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your time."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/8 bg-[#081229]/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#ffb64d] text-[#111827] shadow-[0_8px_30px_rgba(255,182,77,.2)]"><Sparkles className="size-5" aria-hidden="true" /></div>
            <div><p className="text-lg font-semibold tracking-tight text-white">Study Pilot</p><p className="hidden text-xs text-slate-400 sm:block">Your schoolwork, under control.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild><Button variant="ghost" className="h-11 rounded-xl text-slate-300 hover:bg-white/8 hover:text-white"><Settings2 className="size-4" /><span className="hidden sm:inline">My time</span></Button></DialogTrigger>
              <DialogContent className="border-slate-700 bg-[#101c36] text-white sm:max-w-md">
                <form onSubmit={saveSettings}>
                  <DialogHeader><DialogTitle>How much time do you have today?</DialogTitle><DialogDescription className="text-slate-400">A rough answer is perfect. Change it whenever your day changes.</DialogDescription></DialogHeader>
                  <div className="my-6 grid gap-4">
                    <label className="grid gap-2 text-sm font-medium">Available today<NativeSelect value={draftAvailable} onChange={(e) => setDraftAvailable(e.target.value)} className="h-11 w-full border-slate-600 bg-[#0b1730]">
                      <NativeSelectOption value="30">30 minutes</NativeSelectOption><NativeSelectOption value="60">1 hour</NativeSelectOption><NativeSelectOption value="90">1.5 hours</NativeSelectOption><NativeSelectOption value="120">2 hours</NativeSelectOption><NativeSelectOption value="180">3 hours</NativeSelectOption><NativeSelectOption value="240">4 hours</NativeSelectOption>
                    </NativeSelect></label>
                    <label className="grid gap-2 text-sm font-medium">Work-session length<NativeSelect value={draftSession} onChange={(e) => setDraftSession(e.target.value)} className="h-11 w-full border-slate-600 bg-[#0b1730]">
                      <NativeSelectOption value="20">20 minutes</NativeSelectOption><NativeSelectOption value="25">25 minutes</NativeSelectOption><NativeSelectOption value="35">35 minutes</NativeSelectOption><NativeSelectOption value="45">45 minutes</NativeSelectOption><NativeSelectOption value="60">1 hour</NativeSelectOption>
                    </NativeSelect></label>
                  </div>
                  <DialogFooter><Button disabled={saving} type="submit" className="h-11 bg-[#ffb64d] text-[#111827] hover:bg-[#ffc66f]">{saving && <LoaderCircle className="animate-spin" />} Make my plan</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="h-11 rounded-xl bg-[#ffb64d] px-4 text-[#111827] hover:bg-[#ffc66f]"><Plus className="size-4" /><span className="hidden sm:inline">Add assignment</span><span className="sm:hidden">Add</span></Button></DialogTrigger>
              <DialogContent className="border-slate-700 bg-[#101c36] text-white sm:max-w-md">
                <form onSubmit={addAssignment}>
                  <DialogHeader><DialogTitle>Add an assignment</DialogTitle><DialogDescription className="text-slate-400">Just the basics. You can estimate the time.</DialogDescription></DialogHeader>
                  <div className="my-6 grid gap-4">
                    <label className="grid gap-2 text-sm font-medium">Assignment<Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chemistry worksheet" required className="h-11 border-slate-600 bg-[#0b1730]" /></label>
                    <label className="grid gap-2 text-sm font-medium">Class<Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Chemistry" required className="h-11 border-slate-600 bg-[#0b1730]" /></label>
                    <label className="grid gap-2 text-sm font-medium">Due date<Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="h-11 border-slate-600 bg-[#0b1730]" /></label>
                    <label className="grid gap-2 text-sm font-medium">How long might it take?<NativeSelect value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} className="h-11 w-full border-slate-600 bg-[#0b1730]">
                      <NativeSelectOption value="15">15 minutes</NativeSelectOption><NativeSelectOption value="30">30 minutes</NativeSelectOption><NativeSelectOption value="45">45 minutes</NativeSelectOption><NativeSelectOption value="60">1 hour</NativeSelectOption><NativeSelectOption value="90">1.5 hours</NativeSelectOption><NativeSelectOption value="120">2 hours</NativeSelectOption>
                    </NativeSelect></label>
                  </div>
                  <DialogFooter><Button disabled={saving} type="submit" className="h-11 bg-[#ffb64d] text-[#111827] hover:bg-[#ffc66f]">{saving && <LoaderCircle className="animate-spin" />} Add it</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        {error && <div role="alert" className="mb-6 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
          <section aria-labelledby="today-heading">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#72a7ff]">Today’s plan</p><h1 id="today-heading" className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Let’s make today manageable.</h1></div>
              <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-white"><Clock3 className="size-4" /> {settings.availableMinutes} min available</button>
            </div>

            <article className="relative min-h-60 overflow-hidden rounded-[28px] border border-[#6ea6ff]/20 bg-[linear-gradient(135deg,#172b52_0%,#101d38_58%,#0d1930_100%)] p-6 shadow-[0_28px_80px_rgba(1,7,20,.28)] sm:p-8">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#4d8dff]/10 blur-3xl" />
              <div className="relative">
                {loading ? <div className="grid min-h-44 place-items-center"><LoaderCircle className="size-7 animate-spin text-[#72a7ff]" /></div> : active[0] ? <>
                  <div className="mb-8 flex items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#a9c8ff]"><BookOpen className="size-4" /> Start here</p><h2 className="text-2xl font-semibold text-white">{active[0].title}</h2><p className="mt-2 text-slate-400">{active[0].course} · start with a {Math.min(active[0].estimatedMinutes, settings.sessionMinutes)} minute block</p></div><span className="rounded-full bg-[#ffb64d]/12 px-3 py-1.5 text-sm font-semibold text-[#ffc66f]">{dueLabel(active[0].dueDate)}</span></div>
                  <Button onClick={() => complete(active[0].id)} className="h-12 rounded-xl bg-white px-5 text-[#0b1730] hover:bg-slate-100"><Check className="size-4" /> Mark finished</Button>
                </> : <div className="flex min-h-44 flex-col items-start justify-center"><p className="mb-2 text-sm font-medium text-[#a9c8ff]">Your runway is clear</p><h2 className="text-2xl font-semibold text-white">Add what you need to get done.</h2><p className="mt-2 max-w-md text-slate-400">Don’t organize everything first. Add the next assignment you remember and we’ll build from there.</p><Button onClick={() => setAddOpen(true)} className="mt-6 h-11 bg-white text-[#0b1730] hover:bg-slate-100"><Plus /> Add the first one</Button></div>}
              </div>
            </article>

            {todayPlan.length > 0 && <div className="mt-6 grid gap-4 sm:grid-cols-3">{todayPlan.map(({ assignment, minutes }, index) => <div key={assignment.id} className="rounded-2xl border border-white/8 bg-[#101b33] p-5"><div className="mb-5 flex items-center justify-between"><span className="grid size-8 place-items-center rounded-lg bg-[#1c2d4d] text-sm font-semibold text-[#9ec0fb]">{index + 1}</span><span className="text-xs font-medium text-slate-500">{minutes} min block</span></div><p className="font-semibold text-white">{assignment.title}</p><p className="mt-1 text-sm text-slate-400">{assignment.course}</p></div>)}</div>}
          </section>

          <aside aria-labelledby="assignments-heading" className="rounded-[28px] border border-white/8 bg-[#0e1930] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-sm text-slate-400">Everything coming up</p><h2 id="assignments-heading" className="mt-1 text-xl font-semibold text-white">Assignments</h2></div><span className="rounded-full bg-[#1a2a47] px-3 py-1 text-sm font-semibold text-[#a9c8ff]">{active.length} open</span></div>
            <div className="space-y-3">
              {active.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/7 bg-[#121f39] p-4"><button onClick={() => complete(item.id)} aria-label={`Mark ${item.title} finished`} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-600 text-slate-500 transition hover:border-[#70a5ff] hover:text-[#70a5ff]"><Check className="size-4" /></button><div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{item.title}</p><p className="mt-1 text-sm text-slate-400">{item.course} · {item.estimatedMinutes} min</p></div><span className="shrink-0 text-sm font-medium text-[#ffc66f]">{dueLabel(item.dueDate)}</span></div>)}
              {!loading && active.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center"><Check className="mx-auto mb-3 size-7 text-[#72a7ff]" /><p className="font-medium text-white">Nothing waiting</p><p className="mt-1 text-sm text-slate-400">Add an assignment when you remember one.</p></div>}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#ffb64d]/8 p-4 text-sm text-[#e9d3ae]"><CalendarDays className="mt-0.5 size-4 shrink-0 text-[#ffb64d]" /><p>Your plan uses deadlines first, then fits work into the time you said you have today.</p></div>
            {totalMinutes > settings.availableMinutes && active.length > 0 && <p className="mt-4 text-sm text-slate-400">You have {totalMinutes - settings.availableMinutes} minutes of work beyond today. That’s okay—we’ll keep the urgent work first.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
