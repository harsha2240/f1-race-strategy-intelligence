"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Save, Trash2, X } from "lucide-react";
import { ImportProgress } from "@/components/import-progress";

type Auth = { csrf_token: string; roles: string[] };
type Session = { session_id: number; race_id: number; race_name: string; season: number; circuit: string; session_type: string; session_date: string | null; source_session_key: string | null; qualifying_entries: number };
const TYPES = ["FP1", "FP2", "FP3", "SPRINT_QUALIFYING", "SPRINT", "QUALIFYING", "RACE"];
const PAGE_SIZE = 50;
const inputClass = "h-10 rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm text-white";

function fromUtcDateTime(value: string | null): string {
  if (!value) return "";
  const utc = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(utc.getTime())) return "";
  const local = new Date(utc.getTime() - utc.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toUtcIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function AdminSessionsPage() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [rows, setRows] = useState<Session[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [importSeason, setImportSeason] = useState("");
  const [importRaceName, setImportRaceName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editType, setEditType] = useState("RACE");
  const [editDate, setEditDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importType, setImportType] = useState("RACE");
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  async function load(targetPage = 0) {
    const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!me.ok) throw new Error("Sign in as an administrator to manage sessions.");
    const user = await me.json() as Auth;
    if (!user.roles.includes("ADMIN")) throw new Error("Only Admins can manage sessions.");
    setAuth(user);
    const response = await fetch(`/api/admin/sessions?limit=${PAGE_SIZE + 1}&offset=${targetPage * PAGE_SIZE}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load sessions.");
    const sessions: Session[] = await response.json();
    setRows(sessions.slice(0, PAGE_SIZE));
    setPage(targetPage);
    setHasNext(sessions.length > PAGE_SIZE);
  }
  useEffect(() => { load().catch(reason => setError(reason instanceof Error ? reason.message : "Could not reach the API.")); }, []);

  async function request(path: string, method: string, body?: unknown) {
    if (!auth) return;
    const response = await fetch(path, { method, credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": auth.csrf_token }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.detail ?? `Request failed (${response.status}).`); }
    return response.status === 204 ? undefined : response.json();
  }
  async function importSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth?.roles.includes("ADMIN")) return;
    setImportBusy(true);
    setError("");
    setImportMessage("");
    try {
      const run = await request("/api/ingestion/jolpica/session", "POST", {
        season: Number(importSeason), race_name: importRaceName.trim(), session_type: importType,
      });
      setImportMessage(run.status === "already_present" ? run.message : `Import #${run.import_run_id} queued.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not queue the session import.");
    } finally {
      setImportBusy(false);
    }
  }
  function beginEdit(row: Session) {
    setEditing(row.session_id); setEditType(row.session_type);
    setEditDate(fromUtcDateTime(row.session_date));
  }
  async function saveEdit(id: number) {
    setBusy(true); setError("");
    const row = rows.find(item => item.session_id === id);
    try { await request(`/api/admin/sessions/${id}`, "PUT", { ...(row?.source_session_key?.startsWith("manual:") ? { session_type: editType } : {}), session_date: toUtcIso(editDate) }); setEditing(null); await load(page); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the session."); }
    finally { setBusy(false); }
  }
  async function changePage(targetPage: number) {
    setBusy(true);
    setEditing(null);
    setError("");
    try { await load(targetPage); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load sessions."); }
    finally { setBusy(false); }
  }
  async function remove(row: Session) {
    if (!window.confirm(`Delete the ${row.session_type} session for ${row.race_name} (${row.season})? This also deletes linked qualifying results and weather. Race classifications and lap records are kept.`)) return;
    setBusy(true); setError("");
    try { await request(`/api/admin/sessions/${row.session_id}`, "DELETE"); await load(rows.length === 1 && page > 0 ? page - 1 : page); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the session."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/" replace className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">ADMINISTRATION · DATABASE RECORDS</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Session management</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#858d99]">Browse, import, and delete session records. You can also update a session’s date.</p></div><Link href="/admin/imports" replace className="w-fit rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">Race data imports</Link></div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <form onSubmit={importSession} className="mt-6 grid gap-4 rounded-lg border border-[#252b34] bg-[#11151b] p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <div className="sm:col-span-4">
        <h2 className="text-sm font-semibold">Import one session</h2>
        <p className="mt-1 text-xs text-[#929aa5]">Enter the season and official Grand Prix name to import one race or qualifying session from Jolpica.</p>
      </div>
      <label className="text-xs text-[#9aa2ad]">Season
        <input type="number" required min={1950} max={2100} value={importSeason} onChange={e => setImportSeason(e.target.value)} className={`${inputClass} mt-2 block w-full`} />
      </label>
      <label className="text-xs text-[#9aa2ad]">Race name
        <input required maxLength={160} placeholder="Australian Grand Prix" value={importRaceName} onChange={e => setImportRaceName(e.target.value)} className={`${inputClass} mt-2 block w-full`} />
      </label>
      <label className="text-xs text-[#9aa2ad]">Session
        <select value={importType} onChange={e => setImportType(e.target.value)} className={`${inputClass} mt-2 block w-full`}>
          <option value="RACE">Race</option><option value="QUALIFYING">Qualifying</option>
        </select>
      </label>
      <button disabled={importBusy || !auth?.roles.includes("ADMIN")} className="h-10 rounded-md bg-[#e10618] px-4 text-xs font-semibold disabled:opacity-50">Import session</button>
    </form>
    {importMessage && <p role="status" className="mt-3 text-xs text-[#a8d8b4]">{importMessage}</p>}
    <ImportProgress enabled={!!auth?.roles.includes("ADMIN")} onCompleted={() => {
      setImportMessage("");
      void load(page).catch(reason => setError(String(reason)));
    }} />
    <section className="mt-6 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="text-sm font-semibold">Sessions</div><span className="text-[10px] text-[#78818d]">{rows.length} records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-wider text-[#858d99]"><tr>{["SEASON / RACE", "CIRCUIT", "SESSION", "DATE", "SOURCE", "QUALIFYING ENTRIES", "ACTIONS"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{rows.map(row=>{const manual=(row.source_session_key??"").startsWith("manual:"); const isEditing=editing===row.session_id; return <tr key={row.session_id}><td className="px-4 py-3"><div>{row.season} · {row.race_name}</div><div className="mt-1 text-[10px] text-[#737d89]">Session #{row.session_id}</div></td><td className="px-4 py-3 text-[#aeb5bf]">{row.circuit}</td><td className="px-4 py-3">{isEditing && manual ? <select value={editType} onChange={e=>setEditType(e.target.value)} className="rounded border border-[#303741] bg-[#0d1015] px-2 py-1">{TYPES.map(t=><option key={t}>{t}</option>)}</select> : row.session_type}</td><td className="px-4 py-3">{isEditing ? <input type="datetime-local" value={editDate} onChange={e=>setEditDate(e.target.value)} className="rounded border border-[#303741] bg-[#0d1015] px-2 py-1"/> : displayDate(row.session_date)}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] ${manual ? "bg-[#202d24] text-[#a8d8b4]" : "bg-[#202630] text-[#b5bfce]"}`}>{manual ? "Manual" : "Source record"}</span></td><td className="px-4 py-3">{row.qualifying_entries}</td><td className="px-4 py-3">{isEditing ? <div className="flex gap-2"><button disabled={busy} onClick={()=>saveEdit(row.session_id)} title="Save" className="text-[#a8d8b4]"><Save size={15}/></button><button onClick={()=>setEditing(null)} title="Cancel" className="text-[#929aa5]"><X size={15}/></button></div> : <div className="flex gap-3"><button disabled={busy} onClick={()=>beginEdit(row)} title={manual ? "Edit session" : "Edit session date"} className="text-[#cbd0d7] hover:text-white"><Pencil size={15}/></button><button disabled={busy} onClick={()=>remove(row)} title="Delete session" className="text-[#ff8a94] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={15}/></button></div>}</td></tr>;})}{rows.length===0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[#858d99]">No session records found.</td></tr>}</tbody></table></div></section>
    <nav aria-label="Session pages" className="mt-4 flex items-center gap-4 text-sm">
      <button type="button" disabled={!page || busy} onClick={() => void changePage(page - 1)} className="disabled:opacity-40">Previous</button>
      <span>Page {page + 1}</span>
      <button type="button" disabled={!hasNext || busy} onClick={() => void changePage(page + 1)} className="disabled:opacity-40">Next</button>
    </nav>
    <p className="mt-4 text-[10px] leading-5 text-[#68727e]">Deleting a session removes its metadata and any linked qualifying entries, as enforced by the database relationship. It does not delete race classification or lap records. Manual session type and date can be edited; imported session dates can be edited while their source session type stays locked. Every change is recorded in the database audit log.</p>
  </div></main>;
}
