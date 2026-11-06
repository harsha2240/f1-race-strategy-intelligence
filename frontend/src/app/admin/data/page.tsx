"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type Auth = { csrf_token: string; roles: string[] };
type Race = { race_id: number; race_name: string; season: number; circuit: string };
type Entrant = { driver_team_id: number; driver_name: string; constructor_name: string; car_number: number; result_id: number | null; existing_source: string | null };
type RaceResult = { result_id: number; race_id: number; driver_team_id: number; race_name: string; season: number; driver_name: string; constructor_name: string; position: number | null; points: number; status: string; classified_laps: number | null; record_source: string; lap_rows: number; pit_stops: number; stint_rows: number };
const input = "h-9 rounded border border-[#303741] bg-[#0d1015] px-2 text-xs text-white";

export default function AdminDataPage() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [raceId, setRaceId] = useState("");
  const [entrantId, setEntrantId] = useState("");
  const [position, setPosition] = useState("");
  const [points, setPoints] = useState("0");
  const [status, setStatus] = useState("Finished");
  const [laps, setLaps] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editPosition, setEditPosition] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLaps, setEditLaps] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!me.ok) throw new Error("Sign in as an administrator to manage race data.");
    const user = await me.json() as Auth;
    if (!user.roles.includes("ADMIN")) throw new Error("Only Admins can manage race records.");
    setAuth(user);
    const [raceResponse, resultResponse] = await Promise.all([
      fetch("/api/races?limit=200", { cache: "no-store" }),
      fetch("/api/admin/race-results", { credentials: "include", cache: "no-store" }),
    ]);
    if (!raceResponse.ok || !resultResponse.ok) throw new Error("Could not load race data for administration.");
    setRaces(await raceResponse.json());
    setResults(await resultResponse.json());
  }
  useEffect(() => { load().catch(reason => setError(reason instanceof Error ? reason.message : "Could not reach the API.")); }, []);

  useEffect(() => {
    setEntrants([]); setEntrantId("");
    if (!raceId) return;
    fetch(`/api/admin/races/${raceId}/entrants`, { credentials: "include", cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((rows: Entrant[]) => setEntrants(rows))
      .catch(() => setError("Could not load the driver and constructor list for this season."));
  }, [raceId]);

  async function request(path: string, method: string, body?: unknown) {
    if (!auth) return;
    const response = await fetch(path, { method, credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": auth.csrf_token }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.detail ?? `Request failed (${response.status}).`); }
    return response.status === 204 ? undefined : response.json();
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request("/api/admin/race-results", "POST", { race_id: Number(raceId), driver_team_id: Number(entrantId), position: position ? Number(position) : null, points: Number(points), status, classified_laps: laps ? Number(laps) : null });
      setEntrantId(""); setPosition(""); setPoints("0"); setStatus("Finished"); setLaps(""); await load();
      const available = entrants.find(item => String(item.driver_team_id) === entrantId);
      if (available) setEntrants(current => current.map(item => item.driver_team_id === available.driver_team_id ? { ...item, result_id: -1, existing_source: "manual" } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add the result."); }
    finally { setBusy(false); }
  }
  function beginEdit(row: RaceResult) {
    setEditing(row.result_id); setEditPosition(row.position == null ? "" : String(row.position)); setEditPoints(String(row.points)); setEditStatus(row.status); setEditLaps(row.classified_laps == null ? "" : String(row.classified_laps));
  }
  async function saveEdit(row: RaceResult) {
    setBusy(true); setError("");
    try {
      await request(`/api/admin/race-results/${row.result_id}`, "PUT", { position: editPosition ? Number(editPosition) : null, points: Number(editPoints), status: editStatus, classified_laps: editLaps ? Number(editLaps) : null });
      setEditing(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the result."); }
    finally { setBusy(false); }
  }
  async function remove(row: RaceResult) {
    const effects = [row.lap_rows && `${row.lap_rows} lap rows`, row.pit_stops && `${row.pit_stops} pit stops`, row.stint_rows && `${row.stint_rows} tyre stints`].filter(Boolean).join(", ");
    const cascade = effects ? ` This also deletes ${effects}.` : "";
    if (!window.confirm(`Delete ${row.driver_name}'s P${row.position ?? "—"} result for ${row.race_name} (${row.season})?${cascade} The action is written to the audit log.`)) return;
    setBusy(true); setError("");
    try { await request(`/api/admin/race-results/${row.result_id}`, "DELETE"); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the result."); }
    finally { setBusy(false); }
  }
  const availableEntrants = entrants.filter(row => !row.result_id);
  const visibleResults = results.filter(row => `${row.season} ${row.race_name} ${row.driver_name} ${row.constructor_name} ${row.record_source} ${row.status}`.toLowerCase().includes(resultQuery.trim().toLowerCase()));

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">ADMIN CONSOLE · ADMIN ONLY</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Manual race data</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#858d99]">Add a missing driver classification and maintain race result records. Entries created here are marked Manual; edits and deletions are recorded in the audit log.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/sessions" className="rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">Manage sessions</Link><Link href="/admin/imports" className="rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">Import other seasons</Link></div></div>
    <div className="mt-5 rounded-md border border-[#41404a] bg-[#16171c] px-4 py-3 text-xs leading-5 text-[#b8bec8]">Manual entries are visibly labeled and remain distinct from imported results. Editing an imported result is audited, but reimporting that season can restore the source value.</div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <form onSubmit={create} className="mt-5 rounded-lg border border-[#252b34] bg-[#11151b] p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus size={15} className="text-[#e10618]"/> Add a missing race classification</div><div className="grid gap-4 md:grid-cols-3"><label className="text-xs text-[#9aa2ad]">Race<select required value={raceId} onChange={e=>setRaceId(e.target.value)} className={`${input} mt-2 block w-full`}><option value="">Choose a race…</option>{races.map(r=><option key={r.race_id} value={r.race_id}>{r.season} · {r.race_name}</option>)}</select></label><label className="text-xs text-[#9aa2ad]">Driver and constructor<select required disabled={!raceId} value={entrantId} onChange={e=>setEntrantId(e.target.value)} className={`${input} mt-2 block w-full`}><option value="">Choose an unrecorded entrant…</option>{availableEntrants.map(r=><option key={r.driver_team_id} value={r.driver_team_id}>{r.driver_name} · {r.constructor_name} #{r.car_number}</option>)}</select>{raceId && availableEntrants.length===0 && <span className="mt-1 block text-[10px] text-[#78818d]">Every listed entrant already has a result for this event.</span>}</label><div className="grid grid-cols-2 gap-3"><label className="text-xs text-[#9aa2ad]">Finish position<input type="number" min="1" max="999" value={position} onChange={e=>setPosition(e.target.value)} placeholder="Optional" className={`${input} mt-2 block w-full`}/></label><label className="text-xs text-[#9aa2ad]">Points<input type="number" min="0" max="999.99" step="0.01" required value={points} onChange={e=>setPoints(e.target.value)} className={`${input} mt-2 block w-full`}/></label><label className="text-xs text-[#9aa2ad]">Status<input required maxLength={48} value={status} onChange={e=>setStatus(e.target.value)} className={`${input} mt-2 block w-full`}/></label><label className="text-xs text-[#9aa2ad]">Classified laps<input type="number" min="0" max="999" value={laps} onChange={e=>setLaps(e.target.value)} placeholder="Optional" className={`${input} mt-2 block w-full`}/></label></div></div><button disabled={busy || !auth?.roles.includes("ADMIN") || !entrantId} className="mt-4 flex h-10 items-center gap-2 rounded-md bg-[#e10618] px-4 text-xs font-semibold disabled:opacity-50"><Plus size={14}/> Add manual result</button></form>
    <section className="mt-6 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="text-sm font-semibold">Race result records</div><div className="flex items-center gap-3"><label className="sr-only" htmlFor="result-search">Filter result records</label><input id="result-search" type="search" value={resultQuery} onChange={e=>setResultQuery(e.target.value)} placeholder="Search driver, race, team, season…" className={`${input} w-64`}/><span className="text-[10px] text-[#78818d]">{visibleResults.length} of {results.length} rows</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-wider text-[#858d99]"><tr>{["SEASON / RACE", "DRIVER / TEAM", "POSITION", "POINTS", "STATUS", "LAPS", "SOURCE", "ACTIONS"].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{visibleResults.map(row=>{const isEditing=editing===row.result_id;return <tr key={row.result_id}><td className="px-3 py-3">{row.season} · {row.race_name}<div className="mt-1 text-[10px] text-[#737d89]">Result #{row.result_id}</div></td><td className="px-3 py-3">{row.driver_name}<div className="mt-1 text-[10px] text-[#929aa5]">{row.constructor_name}</div></td><td className="px-3 py-3">{isEditing ? <input aria-label="Position" type="number" min="1" max="999" value={editPosition} onChange={e=>setEditPosition(e.target.value)} className={`${input} w-20`}/> : row.position ?? "—"}</td><td className="px-3 py-3">{isEditing ? <input aria-label="Points" type="number" min="0" step="0.01" value={editPoints} onChange={e=>setEditPoints(e.target.value)} className={`${input} w-24`}/> : row.points}</td><td className="px-3 py-3">{isEditing ? <input aria-label="Status" value={editStatus} onChange={e=>setEditStatus(e.target.value)} className={`${input} w-32`}/> : row.status}</td><td className="px-3 py-3">{isEditing ? <input aria-label="Classified laps" type="number" min="0" value={editLaps} onChange={e=>setEditLaps(e.target.value)} className={`${input} w-20`}/> : row.classified_laps ?? "—"}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[10px] ${row.record_source==="manual"?"bg-[#202d24] text-[#a8d8b4]":"bg-[#202630] text-[#b5bfce]"}`}>{row.record_source}</span></td><td className="px-3 py-3">{isEditing?<div className="flex gap-3"><button disabled={busy} onClick={()=>saveEdit(row)} aria-label="Save result" className="text-[#a8d8b4]"><Save size={15}/></button><button onClick={()=>setEditing(null)} aria-label="Cancel editing" className="text-[#929aa5]"><X size={15}/></button></div>:<div className="flex gap-3"><button disabled={busy} onClick={()=>beginEdit(row)} aria-label={`Edit ${row.driver_name} result`} className="text-[#cbd0d7] hover:text-white"><Pencil size={15}/></button><button disabled={busy} onClick={()=>remove(row)} aria-label={`Delete ${row.driver_name} result`} className="text-[#ff8a94]"><Trash2 size={15}/></button></div>}</td></tr>;})}{visibleResults.length===0&&<tr><td colSpan={8} className="px-5 py-10 text-center text-[#858d99]">No matching race results found.</td></tr>}</tbody></table></div></section>
  </div></main>;
}
