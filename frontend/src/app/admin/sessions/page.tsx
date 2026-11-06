"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type Auth = { csrf_token: string; roles: string[] };
type Race = { race_id: number; race_name: string; season: number; circuit: string };
type Session = { session_id: number; race_id: number; race_name: string; season: number; circuit: string; session_type: string; session_date: string | null; source_session_key: string | null; qualifying_entries: number };
const TYPES = ["FP1", "FP2", "FP3", "SPRINT_QUALIFYING", "SPRINT", "QUALIFYING", "RACE"];
const inputClass = "h-10 rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm text-white";

export default function AdminSessionsPage() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [rows, setRows] = useState<Session[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [raceId, setRaceId] = useState("");
  const [type, setType] = useState("RACE");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editType, setEditType] = useState("RACE");
  const [editDate, setEditDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!me.ok) throw new Error("Sign in as an administrator to manage sessions.");
    const user = await me.json() as Auth;
    if (!user.roles.includes("ADMIN")) throw new Error("Only Admins can manage sessions.");
    setAuth(user);
    const [sessionResponse, raceResponse] = await Promise.all([
      fetch("/api/admin/sessions?limit=1000", { credentials: "include", cache: "no-store" }),
      fetch("/api/races?limit=200", { credentials: "include", cache: "no-store" }),
    ]);
    if (!sessionResponse.ok) throw new Error((await sessionResponse.json()).detail ?? "Could not load sessions.");
    if (!raceResponse.ok) throw new Error("Could not load races for the session form.");
    setRows(await sessionResponse.json());
    setRaces(await raceResponse.json());
  }
  useEffect(() => { load().catch(reason => setError(reason instanceof Error ? reason.message : "Could not reach the API.")); }, []);

  async function request(path: string, method: string, body?: unknown) {
    if (!auth) return;
    const response = await fetch(path, { method, credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": auth.csrf_token }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.detail ?? `Request failed (${response.status}).`); }
    return response.status === 204 ? undefined : response.json();
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await request("/api/admin/sessions", "POST", { race_id: Number(raceId), session_type: type, session_date: date ? new Date(date).toISOString() : null }); setRaceId(""); setDate(""); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add the session."); }
    finally { setBusy(false); }
  }
  function beginEdit(row: Session) {
    setEditing(row.session_id); setEditType(row.session_type);
    setEditDate(row.session_date ? new Date(row.session_date).toISOString().slice(0, 16) : "");
  }
  async function saveEdit(id: number) {
    setBusy(true); setError("");
    const row = rows.find(item => item.session_id === id);
    try { await request(`/api/admin/sessions/${id}`, "PUT", { ...(row?.source_session_key?.startsWith("manual:") ? { session_type: editType } : {}), session_date: editDate ? new Date(editDate).toISOString() : null }); setEditing(null); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the session."); }
    finally { setBusy(false); }
  }
  async function remove(row: Session) {
    const linked = row.qualifying_entries ? ` This will also delete ${row.qualifying_entries} linked qualifying entr${row.qualifying_entries === 1 ? "y" : "ies"}.` : "";
    if (!window.confirm(`Delete the ${row.session_type} session for ${row.race_name} (${row.season})? This removes session metadata only.${linked} Race classification and lap records are not deleted.`)) return;
    setBusy(true); setError("");
    try { await request(`/api/admin/sessions/${row.session_id}`, "DELETE"); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the session."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/admin/users" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Administration</Link>
    <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">ADMINISTRATION · DATABASE RECORDS</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Session management</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#858d99]">Add, edit, and delete session records attached to existing races. Imported session types remain locked to preserve source identity; their dates can be edited.</p></div><Link href="/admin/imports" className="w-fit rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">FastF1 imports</Link></div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <form onSubmit={create} className="mt-6 rounded-lg border border-[#252b34] bg-[#11151b] p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus size={15} className="text-[#e10618]"/> Add a manual session</div><div className="grid gap-4 sm:grid-cols-[minmax(240px,1fr)_190px_220px_auto] sm:items-end"><label className="text-xs text-[#9aa2ad]">Race<select required value={raceId} onChange={e=>setRaceId(e.target.value)} className={`${inputClass} mt-2 block w-full`}><option value="">Choose a race…</option>{races.map(r=><option key={r.race_id} value={r.race_id}>{r.season} · {r.race_name} · {r.circuit}</option>)}</select></label><label className="text-xs text-[#9aa2ad]">Session type<select value={type} onChange={e=>setType(e.target.value)} className={`${inputClass} mt-2 block w-full`}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label className="text-xs text-[#9aa2ad]">Date and time (optional)<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className={`${inputClass} mt-2 block w-full`} /></label><button disabled={busy || !auth?.roles.includes("ADMIN")} className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#e10618] px-4 text-xs font-semibold disabled:opacity-50"><Plus size={14}/> Add session</button></div></form>
    <section className="mt-6 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="text-sm font-semibold">Sessions</div><span className="text-[10px] text-[#78818d]">{rows.length} records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-wider text-[#858d99]"><tr>{["SEASON / RACE", "CIRCUIT", "SESSION", "DATE", "SOURCE", "QUALIFYING ENTRIES", "ACTIONS"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{rows.map(row=>{const manual=(row.source_session_key??"").startsWith("manual:"); const isEditing=editing===row.session_id; return <tr key={row.session_id}><td className="px-4 py-3"><div>{row.season} · {row.race_name}</div><div className="mt-1 text-[10px] text-[#737d89]">Session #{row.session_id}</div></td><td className="px-4 py-3 text-[#aeb5bf]">{row.circuit}</td><td className="px-4 py-3">{isEditing && manual ? <select value={editType} onChange={e=>setEditType(e.target.value)} className="rounded border border-[#303741] bg-[#0d1015] px-2 py-1">{TYPES.map(t=><option key={t}>{t}</option>)}</select> : row.session_type}</td><td className="px-4 py-3">{isEditing ? <input type="datetime-local" value={editDate} onChange={e=>setEditDate(e.target.value)} className="rounded border border-[#303741] bg-[#0d1015] px-2 py-1"/> : row.session_date ? new Date(row.session_date).toLocaleString() : "—"}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] ${manual ? "bg-[#202d24] text-[#a8d8b4]" : "bg-[#202630] text-[#b5bfce]"}`}>{manual ? "Manual" : "Source record"}</span></td><td className="px-4 py-3">{row.qualifying_entries}</td><td className="px-4 py-3">{isEditing ? <div className="flex gap-2"><button disabled={busy} onClick={()=>saveEdit(row.session_id)} title="Save" className="text-[#a8d8b4]"><Save size={15}/></button><button onClick={()=>setEditing(null)} title="Cancel" className="text-[#929aa5]"><X size={15}/></button></div> : <div className="flex gap-3"><button disabled={busy} onClick={()=>beginEdit(row)} title={manual ? "Edit session" : "Edit session date"} className="text-[#cbd0d7] hover:text-white"><Pencil size={15}/></button><button disabled={busy} onClick={()=>remove(row)} title="Delete session" className="text-[#ff8a94] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={15}/></button></div>}</td></tr>;})}{rows.length===0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[#858d99]">No session records found.</td></tr>}</tbody></table></div></section>
    <p className="mt-4 text-[10px] leading-5 text-[#68727e]">Deleting a session removes its metadata and any linked qualifying entries, as enforced by the database relationship. It does not delete race classification or lap records. Manual session type and date can be edited; imported session dates can be edited while their source session type stays locked. Every change is recorded in the database audit log.</p>
  </div></main>;
}
