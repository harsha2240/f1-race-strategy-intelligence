"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Download } from "lucide-react";

const API = "";
type Session = { csrf_token: string; roles: string[] };
type Run = { import_run_id: number; source: string; season_year: number; event_name: string; session_type: string; status: string; started_at: string; rows_written: number; error_summary: string | null };
type Result = { import_run_id: number; race_id: number; drivers: number; lap_rows: number; stint_rows: number; pit_stop_rows: number; weather_rows: number };

export default function ImportAdminPage() {
  const [auth, setAuth] = useState<Session | null>(null); const [season, setSeason] = useState(2024); const [event, setEvent] = useState("");
  const [jolpicaSeason, setJolpicaSeason] = useState(2018); const [includeLaps, setIncludeLaps] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]); const [result, setResult] = useState<Result | null>(null); const [activeRunId, setActiveRunId] = useState<number | null>(null); const [importMessage, setImportMessage] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch(`${API}/api/auth/me`, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Sign in as an administrator to manage imports.");
    const current = await response.json(); setAuth(current);
    const history = await fetch(`${API}/api/ingestion/history`, { credentials: "include", cache: "no-store" });
    if (!history.ok) throw new Error(history.status === 403 ? "Your role cannot import data." : "Could not load import history.");
    const historyRuns = await history.json() as Run[];
    setRuns(historyRuns);
    const runningRun = historyRuns.find(run => run.status === "running");
    if (runningRun) {
      setActiveRunId(runningRun.import_run_id);
      setImportMessage(`${runningRun.season_year} import is still running. Public data requests are rate-limited, so a full season can take several minutes. This status will keep updating if you leave and return to this page.`);
    }
  }
  useEffect(() => { load().catch(reason => setError(reason instanceof Error ? reason.message : "Could not reach the API.")); }, []);
  useEffect(() => {
    if (activeRunId === null) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`${API}/api/ingestion/history?limit=50`, { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error();
        const history = await response.json() as Run[];
        if (!active) return;
        setRuns(history);
        const current = history.find(run => run.import_run_id === activeRunId);
        if (current?.status === "succeeded") { setImportMessage(`Season ${current.season_year} import completed: ${current.rows_written} source rows written.`); setActiveRunId(null); return; }
        if (current?.status === "failed") { setError(current.error_summary ?? `Season ${current.season_year} import failed.`); setActiveRunId(null); return; }
      } catch { if (active) setError("Could not refresh import status. The server can keep importing; retry to check its history."); }
      if (active) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 2000);
    return () => { active = false; clearTimeout(timer); };
  }, [activeRunId]);
  async function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault(); if (!auth || !auth.roles.includes("ADMIN")) return;
    setBusy(true); setError(""); setResult(null); setImportMessage("");
    try {
      const response = await fetch(`${API}/api/ingestion/fastf1/race`, { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": auth.csrf_token }, body: JSON.stringify({ season, event }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? "FastF1 import failed.");
      setResult(body); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Import failed."); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }
  async function submitSeason(form: FormEvent<HTMLFormElement>) {
    form.preventDefault(); if (!auth || !auth.roles.includes("ADMIN")) return;
    setBusy(true); setError(""); setResult(null); setImportMessage("");
    try {
      const response = await fetch(`${API}/api/ingestion/jolpica/season`, { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": auth.csrf_token }, body: JSON.stringify({ season: jolpicaSeason, include_laps: includeLaps }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? "Season import failed.");
      setActiveRunId(body.import_run_id); setImportMessage(`Season ${body.season} import is running. You can leave this page; the run status will remain in import history.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Season import failed."); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><Link href="/admin/users" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Users and roles</Link><Link href="/admin/sessions" className="text-xs text-[#d7dbe0] hover:text-white">Manage sessions</Link></div>
    <div className="mt-8"><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">ADMINISTRATION · DATA SOURCE</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Race data imports</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#858d99]">Import public historical race data from Jolpica without an F1TV account. It includes race classifications, qualifying positions and pit stops; lap times are optional. The FastF1 importer below is an optional source for detailed session timing and requires an F1TV Access, Pro or Premium account authenticated on this computer. Failed imports are logged and do not leave partial race data.</p></div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <form onSubmit={submitSeason} className="mt-6 grid gap-4 rounded-lg border border-[#4a3336] bg-[#171316] p-5 sm:grid-cols-[180px_1fr_auto] sm:items-end"><div className="sm:col-span-3"><div className="text-sm font-semibold">Import a historical season</div><p className="mt-1 max-w-3xl text-xs leading-5 text-[#929aa5]">Choose any year from 1950 through the current season. Jolpica imports real race classifications, qualifying positions and pit stops; lap times are optional and can make the import slower. Public API rate limits mean a full season may take several minutes. Repeating a season updates its source rows safely. Data is fetched from the public API and logged here.</p></div><label className="text-xs text-[#9aa2ad]">Season<input type="number" required min={1950} max={new Date().getFullYear()} value={jolpicaSeason} onChange={e => setJolpicaSeason(Number(e.target.value))} className="mt-2 block h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm text-white"/></label><label className="flex items-center gap-2 pb-2 text-xs text-[#cbd0d7]"><input type="checkbox" checked={includeLaps} onChange={e=>setIncludeLaps(e.target.checked)} className="accent-[#e10618]"/> Include lap times (slower)</label><button disabled={busy || !auth?.roles.includes("ADMIN")} className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#e10618] px-4 text-xs font-semibold disabled:opacity-50"><Download size={14}/>{busy ? "Importing season…" : "Import season"}</button></form>
    <form onSubmit={submit} className="mt-4 grid gap-4 rounded-lg border border-[#252b34] bg-[#11151b] p-5 sm:grid-cols-[180px_1fr_auto] sm:items-end"><div className="sm:col-span-3"><div className="text-sm font-semibold">Optional: FastF1 session timing (F1TV account required)</div><p className="mt-1 text-xs text-[#858d99]">FastF1 provides detailed timing, stints and weather when available, but protected session data requires F1TV Access, Pro or Premium. If you do not have F1TV, use the public Jolpica season import above.</p></div><label className="text-xs text-[#9aa2ad]">Season<input type="number" required min={1950} max={2100} value={season} onChange={e => setSeason(Number(e.target.value))} className="mt-2 block h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm text-white"/></label><label className="text-xs text-[#9aa2ad]">FastF1 event name or round<input required maxLength={120} value={event} onChange={e => setEvent(e.target.value)} placeholder="For example: Bahrain Grand Prix" className="mt-2 block h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm text-white"/></label><button disabled={busy || !auth?.roles.includes("ADMIN")} className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#5a4144] px-4 text-xs font-semibold disabled:opacity-50"><Download size={14}/>{busy ? "Importing…" : "Import FastF1 race"}</button></form>
    {result && <div className="mt-5 rounded-md border border-[#31513c] bg-[#111a14] p-4 text-sm text-[#a8d8b4]">Imported race #{result.race_id}: {result.drivers} drivers, {result.lap_rows} lap rows, {result.stint_rows} tyre stints, {result.pit_stop_rows} pit-in observations, {result.weather_rows} weather observations. Pit durations remain missing unless FastF1 provides them. Import run #{result.import_run_id}.</div>}
    {importMessage && <div role="status" className="mt-5 rounded-md border border-[#31513c] bg-[#111a14] p-4 text-sm text-[#a8d8b4]">{importMessage}</div>}
    <section className="mt-6 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><Database size={15} className="text-[#e10618]"/> Import history</div><span className="text-[10px] text-[#78818d]">{runs.length} recent runs</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-wider text-[#858d99]"><tr>{["RUN", "SOURCE", "SEASON", "EVENT", "SESSION", "STATUS", "ROWS", "ERROR"].map(value => <th key={value} className="px-4 py-3">{value}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{runs.map(run => <tr key={run.import_run_id}><td className="px-4 py-3">{run.import_run_id}</td><td className="px-4 py-3">{run.source}</td><td className="px-4 py-3">{run.season_year}</td><td className="px-4 py-3">{run.event_name}</td><td className="px-4 py-3">{run.session_type}</td><td className="px-4 py-3">{run.status}</td><td className="px-4 py-3">{run.rows_written}</td><td className="max-w-[260px] truncate px-4 py-3 text-[#929aa5]">{run.error_summary ?? "—"}</td></tr>)}{runs.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[#858d99]">No import history found.</td></tr>}</tbody></table></div></section>
    <p className="mt-4 text-[10px] leading-5 text-[#68727e]">Import data is marked as imported and linked to FastF1 event keys. The current season-contract model cannot safely represent a driver moving teams mid-season; such an import is rejected instead of rewriting earlier race facts. Always review the result source and import history.</p>
  </div></main>;
}
