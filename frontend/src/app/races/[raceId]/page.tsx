"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const API = "";
type Result = { result_id: number; full_name: string; constructor: string; position: number | null; points: number; status: string; classified_laps: number | null; record_source: string };

export default function RaceResultsPage() {
  const params = useParams<{raceId:string}>(); const [rows,setRows]=useState<Result[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{let active=true;fetch(`${API}/api/races/${params.raceId}/results`,{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(v=>{if(active)setRows(v)}).catch(()=>{if(active)setError("Could not load race results.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[params.raceId]);
  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-5xl"><Link href="/races" className="inline-flex items-center gap-2 text-xs text-[#929aa5]"><ArrowLeft size={14}/> Race events</Link><h1 className="mt-8 text-3xl font-semibold">Race results</h1><p className="mt-2 text-sm text-[#858d99]">Classified positions and points currently stored for this event.</p>{error&&<div role="alert" className="mt-5 rounded border border-[#694048] bg-[#261519] p-3 text-sm text-[#ffadb4]">{error}</div>}<div className="mt-7 overflow-x-auto rounded-lg border border-[#252b34] bg-[#11151b]"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-wider text-[#858d99]"><tr>{["POS","DRIVER","CONSTRUCTOR","POINTS","STATUS","SOURCE"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{rows.map(r=><tr key={r.result_id}><td className="px-4 py-3">{r.position??"NC"}</td><td className="px-4 py-3 font-medium">{r.full_name}</td><td className="px-4 py-3">{r.constructor}</td><td className="px-4 py-3">{Number(r.points).toFixed(1)}</td><td className="px-4 py-3">{r.status}</td><td className="px-4 py-3 text-[#858d99]">{r.record_source}</td></tr>)}{!loading&&rows.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-[#858d99]">No results stored for this event.</td></tr>}{loading&&<tr><td colSpan={6} className="px-4 py-12 text-center text-[#858d99]">Loading results…</td></tr>}</tbody></table></div></div></main>;
}
