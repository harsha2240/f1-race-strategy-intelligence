"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

const API = "";
type Driver = { driver_id: number; full_name: string };
type Stat = { driver_id: number; full_name: string; starts: number; points: number; average_finish: number | null; wins: number; poles: number | null };
type Season = { season: number };

export default function ComparePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]); const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<Stat[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [seasons, setSeasons] = useState<number[]>([]); const [season, setSeason] = useState("");
  useEffect(() => { Promise.all([fetch(`${API}/api/drivers`, { cache: "no-store" }), fetch(`${API}/api/analytics/season-summary`, { cache: "no-store" })]).then(async ([driversResponse, seasonsResponse]) => { if (!driversResponse.ok || !seasonsResponse.ok) throw new Error(); const [driverRows, seasonRows]: [Driver[], Season[]] = await Promise.all([driversResponse.json(), seasonsResponse.json()]); setDrivers(driverRows); setSeasons(seasonRows.map(row => row.season).sort((a,b)=>b-a)); }).catch(() => setError("Driver records could not be loaded. Start the API and database.")); }, []);
  async function compare() {
    setError(""); setBusy(true);
    try {
      if (selected.length < 2) throw new Error("Select at least two drivers.");
      const params = new URLSearchParams(); selected.forEach(id => params.append("driver_ids", id));
      if (season) params.set("season", season);
      const response = await fetch(`${API}/api/analytics/driver-comparison?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? "Comparison query failed.");
      setRows(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load driver comparison."); }
    finally { setBusy(false); }
  }
  function toggle(id: string) { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 4 ? [...current, id] : current); }
  const columns: [string, string, (row: Stat) => string][] = [
    ["starts", "STARTS", row => String(row.starts)], ["points", "POINTS", row => Number(row.points).toFixed(1)],
    ["average_finish", "AVG FINISH", row => row.average_finish == null ? "—" : Number(row.average_finish).toFixed(2)],
    ["wins", "RACE WINS", row => String(row.wins)],
    ["poles", "POLE POSITIONS", row => row.poles == null ? "Not recorded" : String(row.poles)],
  ];
  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/drivers" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Driver directory</Link>
    <div className="mt-8"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]"><Users size={13}/> COMPARISON</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Compare drivers</h1><p className="mt-2 text-sm text-[#858d99]">Compare race results, wins, and qualifying pole positions for one season or all imported seasons.</p></div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <section className="mt-6 rounded-lg border border-[#252b34] bg-[#11151b] p-5"><label className="mb-4 block max-w-xs text-xs text-[#c2c8d1]">Season scope<select aria-label="Comparison season" value={season} onChange={event=>setSeason(event.target.value)} className="mt-2 block w-full rounded-md border border-[#303741] bg-[#151a21] px-3 py-2.5 text-sm text-white"><option value="">All imported seasons</option>{seasons.map(year=><option key={year} value={year}>{year}</option>)}</select></label><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{drivers.map(driver => <label key={driver.driver_id} className={`flex items-center gap-3 rounded-md border p-3 text-sm ${selected.includes(String(driver.driver_id)) ? "border-[#77323a] bg-[#211317]" : "border-[#303741] bg-[#141920]"}`}><input type="checkbox" checked={selected.includes(String(driver.driver_id))} disabled={!selected.includes(String(driver.driver_id)) && selected.length >= 4} onChange={() => toggle(String(driver.driver_id))}/>{driver.full_name}</label>)}</div><button onClick={compare} disabled={busy || selected.length < 2} className="mt-5 rounded-md bg-[#e10618] px-4 py-2.5 text-xs font-semibold disabled:opacity-50">{busy ? "Querying database…" : "Compare selected drivers"}</button></section>
    {rows.length > 0 && <section className="mt-6 overflow-x-auto rounded-lg border border-[#252b34] bg-[#11151b]"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-wider text-[#858d99]"><tr><th className="px-4 py-3">DRIVER</th>{columns.map(([key, label]) => <th key={key} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{rows.map(row => <tr key={row.driver_id}><th className="px-4 py-4 font-semibold">{row.full_name}</th>{columns.map(([key, , format]) => <td key={key} className="px-4 py-4 text-[#cbd0d7]">{format(row)}</td>)}</tr>)}</tbody></table><p className="px-4 pb-4 text-[10px] text-[#68727e]">Showing {season || "all imported seasons"}. {rows.some(row => row.poles !== null) ? "Pole positions count qualifying P1 records in this scope." : "Pole positions are not recorded for this scope, so unavailable values are labeled ‘Not recorded’."}</p></section>}
  </div></main>;
}
