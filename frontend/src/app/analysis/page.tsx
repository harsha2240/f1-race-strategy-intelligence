"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, Flag, Timer } from "lucide-react";

const API = "";
type Race = { race_id: number; race_name: string; season: number; country: string; result_count: number; lap_record_count: number; pit_stop_count: number; timed_pit_stop_count: number };
type AnalysisRow = Record<string, string | number | boolean | null>;

const panels = [
  { key: "results", label: "Race results", endpoint: (id: number) => `/api/races/${id}/results`, fields: [["position", "Finish"], ["full_name", "Driver"], ["constructor", "Team"], ["points", "Points"], ["status", "Result"]] },
  { key: "laps", label: "Lap times", endpoint: (id: number) => `/api/analytics/laps?race_id=${id}`, fields: [["full_name", "Driver"], ["lap_number", "Lap number"], ["lap_time_ms", "Lap time"], ["lap_rank", "Rank for that lap"], ["delta_to_lap_mean_ms", "Difference from field average"]] },
  { key: "pit-stops", label: "Pit-stop activity", endpoint: (id: number) => `/api/analytics/pit-stops?race_id=${id}`, fields: [["full_name", "Driver"], ["stop_number", "Stop number"], ["lap_number", "Pit-in lap"], ["duration_ms", "Reported stop duration"], ["stop_reason", "Reason"]] },
] as const;

export default function AnalysisPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [seasonScope, setSeasonScope] = useState("");
  const [raceId, setRaceId] = useState("");
  const [active, setActive] = useState<(typeof panels)[number]["key"]>("laps");
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/races?limit=200`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const data: Race[] = await response.json();
      setRaces(data);
      if (data.length) { const lapRace = data.find(race => race.lap_record_count > 0); const initial = lapRace ?? data[0]; setSeasonScope(String(initial.season)); setRaceId(String(initial.race_id)); }
    }).catch(() => setError("Race data is unavailable. Start the API and database to explore recorded sessions."))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (!raceId) return;
    let activeRequest = true;
    const panel = panels.find(item => item.key === active)!;
    setBusy(true); setError("");
    fetch(`${API}${panel.endpoint(Number(raceId))}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data: AnalysisRow[]) => { if (activeRequest) setRows(data); })
      .catch(() => { if (activeRequest) { setRows([]); setError("Could not load this analysis from the database."); } })
      .finally(() => { if (activeRequest) setBusy(false); });
    return () => { activeRequest = false; };
  }, [raceId, active]);

  const panel = panels.find(item => item.key === active)!;
  const seasons = [...new Set(races.map(race => race.season))].sort((a,b)=>b-a);
  const visibleRaces = races.filter(race => !seasonScope || String(race.season) === seasonScope);
  function formatCell(key: string, value: string | number | boolean | null) {
    if (value == null) return "Not recorded";
    if (key === "lap_time_ms") {
      const ms = Number(value); const minutes = Math.floor(ms / 60000); const seconds = (ms % 60000) / 1000;
      return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
    }
    if (key === "duration_ms") return `${(Number(value) / 1000).toFixed(3)} seconds`;
    if (key === "delta_to_lap_mean_ms") {
      const seconds = Number(value) / 1000;
      return `${seconds > 0 ? "+" : ""}${seconds.toFixed(3)} s`;
    }
    return String(value);
  }
  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-7xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]"><Activity size={13}/> RACE ANALYSIS</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Understand the race details</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#a2aab5]">Review official classifications for every imported event and lap-by-lap pace where available. Pit-stop durations appear only when the source provides them.</p></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[#c2c8d1]">1. Choose a season<select aria-label="Analysis season" value={seasonScope} onChange={event=>{const value=event.target.value;setSeasonScope(value);const available=races.filter(race=>String(race.season)===value);const preferred=available.find(race=>race.lap_record_count>0)??available[0];if(preferred)setRaceId(String(preferred.race_id));}} className="mt-2 block w-full rounded-md border border-[#303741] bg-[#151a21] px-3 py-2.5 text-sm text-white">{seasons.map(year=><option key={year} value={String(year)}>{year}</option>)}</select></label><label className="text-xs text-[#c2c8d1]">2. Choose a race<select value={raceId} onChange={event => setRaceId(event.target.value)} className="mt-2 block min-w-64 rounded-md border border-[#303741] bg-[#151a21] px-3 py-2.5 text-sm text-white"><option value="">Select a recorded event</option>{visibleRaces.map(race => <option key={race.race_id} value={race.race_id}>{race.race_name} · {race.lap_record_count ? `${Number(race.lap_record_count).toLocaleString()} lap records` : "no lap records"} · {Number(race.pit_stop_count).toLocaleString()} pit stops · {race.country}</option>)}</select></label></div>
    </div>
    <div className="mt-6"><div className="mb-2 text-xs font-medium text-[#c2c8d1]">2. Choose what to inspect</div><div className="flex flex-wrap gap-2" role="tablist" aria-label="Analysis view">{panels.map(item => <button key={item.key} role="tab" aria-selected={active === item.key} onClick={() => setActive(item.key)} className={`rounded-md px-4 py-2.5 text-xs ${active === item.key ? "bg-[#e10618] text-white" : "border border-[#303741] text-[#9aa2ad] hover:text-white"}`}>{item.label}</button>)}</div></div>
    <div className="mt-4 rounded-md border border-[#303741] bg-[#11151b] px-4 py-3 text-xs leading-5 text-[#aeb6c1]">{active === "laps" ? "Each row is one driver’s lap. Rank compares drivers on the same lap number; the difference compares that time with the field average." : active === "pit-stops" ? "Each row marks a recorded pit stop and its lap. Reported stop duration is included where available; the source does not provide a reason for every stop." : "Official imported race classification: finishing position, constructor, points and classification status."}</div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    {!error && !busy && raceId && rows.length === 0 && <div className="mt-5 rounded-md border border-dashed border-[#303741] p-8 text-center text-sm text-[#929aa5]">This event has no {panel.label.toLowerCase()} records yet. The view uses imported records only; no sample measurements are generated.</div>}
    {!error && !raceId && !busy && races.length === 0 && <div className="mt-5 rounded-md border border-dashed border-[#303741] p-8 text-center text-sm text-[#929aa5]">No race records are available in the database yet.</div>}
    {raceId && <section className="mt-5 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><Flag size={15} className="text-[#e10618]"/>{panel.label}</div><span className="text-[10px] text-[#78818d]">{busy ? "Loading…" : `${rows.length} records`}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-[.04em] text-[#aab2bd]"><tr>{panel.fields.map(([key, label]) => <th key={key} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{rows.map((row, index) => <tr key={index} className="hover:bg-[#151a21]">{panel.fields.map(([key]) => <td key={key} className="px-4 py-3 text-[#cbd0d7]">{formatCell(key, row[key])}</td>)}</tr>)}{busy && <tr><td colSpan={panel.fields.length} className="px-4 py-10 text-center text-[#858d99]"><Timer className="mx-auto mb-2" size={16}/>Loading race records…</td></tr>}</tbody></table></div></section>}
    <p className="mt-4 text-[11px] text-[#78818d]">Source: imported race results. Unavailable values are left blank. Lap and pit time displays are converted from milliseconds to seconds for readability.</p>
  </div></main>;
}
