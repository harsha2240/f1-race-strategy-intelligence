"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Search, Users } from "lucide-react";
import Link from "next/link";

const API = "";
type Driver = { driver_id: number; full_name: string; nationality: string | null; seasons: number; race_starts: number; points: number };

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams(); if (query.trim()) params.set("q", query.trim());
    fetch(`${API}/api/drivers${params.size ? `?${params}` : ""}`, { cache: "no-store" }).then(async response => { if (!response.ok) throw new Error("Driver data is unavailable"); return response.json(); })
      .then(rows => { if (active) { setDrivers(rows); setError(""); } })
      .catch(() => { if (active) setError("Could not load drivers. Check the API and database connection."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);
  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10">
    <div className="mx-auto max-w-6xl"><Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
      <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">DRIVER DIRECTORY</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Drivers</h1><p className="mt-2 text-sm text-[#a2aab5]">Totals use only seasons currently imported. Search for a driver or compare two to four drivers.</p><Link href="/compare" className="mt-4 inline-flex rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">Compare drivers</Link></div><label className="relative block w-full sm:w-[280px]"><Search size={15} className="absolute left-3 top-3 text-[#737d89]"/><input aria-label="Search drivers" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search driver name" className="h-10 w-full rounded-md border border-[#303741] bg-[#11151b] pl-9 pr-3 text-xs outline-none focus:border-[#a53b45]"/></label></div>
      {error && <div role="alert" className="mt-6 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
      <div className="mt-7 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center gap-2 border-b border-[#252b34] px-5 py-4 text-xs font-semibold"><Users size={15} className="text-[#e10618]"/> Driver totals from imported results</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-[.04em] text-[#aab2bd]"><tr><th className="px-5 py-3 font-semibold">Driver</th><th className="px-5 py-3 font-semibold">Nationality</th><th className="px-5 py-3 text-right font-semibold">Seasons in data</th><th className="px-5 py-3 text-right font-semibold">Race starts</th><th className="px-5 py-3 text-right font-semibold">Points scored</th></tr></thead><tbody className="divide-y divide-[#252b34]">{drivers.map(d=><tr key={d.driver_id} className="hover:bg-[#151a21]"><td className="px-5 py-4 font-medium">{d.full_name}</td><td className="px-5 py-4 text-[#9aa2ad]">{d.nationality ?? "Not recorded"}</td><td className="px-5 py-4 text-right tabular-nums">{d.seasons}</td><td className="px-5 py-4 text-right tabular-nums">{d.race_starts}</td><td className="px-5 py-4 text-right tabular-nums">{Number(d.points).toFixed(1)}</td></tr>)}{!loading && drivers.length===0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#858d99]">No matching driver records.</td></tr>}{loading && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#858d99]">Loading driver records…</td></tr>}</tbody></table></div>
      </div><p className="mt-4 text-[10px] text-[#66707b]">This directory includes imported records only; synthetic demo rows are excluded from performance figures.</p>
    </div>
  </main>;
}
