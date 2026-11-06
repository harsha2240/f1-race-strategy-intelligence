"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, Search } from "lucide-react";

const API = "";
type Race = { race_id: number; race_name: string; race_date: string; season: number; circuit: string; country: string; result_count: number; overtake_count: number | null; record_source: string };
type Season = { season: number; races: number };

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [season, setSeason] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/analytics/season-summary`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((rows: Season[]) => setSeasons(rows))
      .catch(() => setError("Season list is unavailable. Check the API and database connection."));
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: "200" });
    if (season) params.set("season", season);
    setLoading(true); setError("");
    fetch(`${API}/api/races?${params}`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((rows: Race[]) => { if (active) setRaces(rows); })
      .catch(() => { if (active) { setRaces([]); setError("Race events are unavailable. Check the API and database connection."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [season]);

  const visible = races.filter(race => `${race.race_name} ${race.circuit} ${race.country}`.toLowerCase().includes(query.toLowerCase().trim()));
  const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8"><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">RACE INTELLIGENCE</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Find a race</h1><p className="mt-2 text-sm leading-6 text-[#a2aab5]">Choose a season or search by Grand Prix, circuit or country. Open an event to see the finishing order and points.</p></div>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <label className="text-xs text-[#c2c8d1]">Season<select aria-label="Filter races by season" value={season} onChange={event => setSeason(event.target.value)} className="mt-2 block h-10 w-full rounded-md border border-[#303741] bg-[#151a21] px-3 text-sm text-white sm:w-48"><option value="">All imported seasons</option>{seasons.map(item => <option key={item.season} value={item.season}>{item.season} · {item.races} races</option>)}</select></label>
      <label className="text-xs text-[#c2c8d1]">Search race or location<span className="relative mt-2 block sm:w-80"><Search size={15} className="absolute left-3 top-3 text-[#737d89]"/><input aria-label="Search races" value={query} onChange={event => setQuery(event.target.value)} placeholder="For example, Monaco or Italy" className="h-10 w-full rounded-md border border-[#303741] bg-[#11151b] pl-9 pr-3 text-xs outline-none focus:border-[#a53b45]"/></span></label>
    </div>
    {error && <div role="alert" className="mt-6 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <section className="mt-7 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><Flag size={15} className="text-[#e10618]"/>Race events</div><span className="text-[10px] text-[#a2aab5]">{loading ? "Loading…" : `${visible.length} races shown`}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-[#151a21] text-[11px] text-[#b8c0ca]"><tr><th className="px-4 py-3 font-semibold">Grand Prix</th><th className="px-4 py-3 font-semibold">Season</th><th className="px-4 py-3 font-semibold">Race date</th><th className="px-4 py-3 font-semibold">Circuit</th><th className="px-4 py-3 font-semibold">Country</th><th className="px-4 py-3 text-right font-semibold">Results</th><th className="px-4 py-3 text-right font-semibold">Overtakes</th></tr></thead><tbody className="divide-y divide-[#252b34]">{visible.map(race=><tr key={race.race_id} className="hover:bg-[#151a21]"><td className="px-4 py-3 font-medium"><Link className="text-white hover:text-[#ff6873]" href={`/races/${race.race_id}`}>{race.race_name}</Link></td><td className="px-4 py-3 text-[#cbd0d7]">{race.season}</td><td className="px-4 py-3 text-[#cbd0d7]">{formatDate(race.race_date)}</td><td className="px-4 py-3 text-[#cbd0d7]">{race.circuit}</td><td className="px-4 py-3 text-[#9aa2ad]">{race.country}</td><td className="px-4 py-3 text-right tabular-nums">{race.result_count}</td><td className="px-4 py-3 text-right tabular-nums">{race.overtake_count == null ? <span title="No OpenF1 historical overtake coverage for this race">Unavailable</span> : race.overtake_count}</td></tr>)}{!loading && visible.length===0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-[#858d99]">No race matches this search.</td></tr>}{loading && <tr><td colSpan={7} className="px-5 py-12 text-center text-[#858d99]">Loading race events…</td></tr>}</tbody></table></div>
    </section>
    <p className="mt-4 text-[11px] text-[#78818d]">“Overtakes” counts source-reported position exchanges, including some pit-stop and penalty changes. OpenF1 historical coverage begins in 2023; older races show unavailable, not zero.</p>
  </div></main>;
}
