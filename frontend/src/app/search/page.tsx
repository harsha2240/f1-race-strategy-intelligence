"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, Search } from "lucide-react";

const API = "";
type Match = { document: string; metadata: { report_id: number; race_id: number; driver_id: number; race_name: string; driver_name: string; strategy_type: string }; cosine_distance: number };
type User = { csrf_token: string; roles: string[] };

export default function StrategySearchPage() {
  const [user, setUser] = useState<User | null>(null); const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`${API}/api/auth/me`, { credentials: "include", cache: "no-store" }).then(response => response.ok ? response.json() : null).then(setUser).catch(() => setUser(null)); }, []);
  async function indexReports() {
    if (!user) return; setError(""); setBusy(true);
    try {
      const response = await fetch(`${API}/api/vector/index`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": user.csrf_token } });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? "Could not build the local report index.");
      setError(`Indexed ${body.indexed_reports} reports with the local ${body.embedding_model} model.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not build the report index."); }
    finally { setBusy(false); }
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true); setMatches([]);
    try {
      if (!user) throw new Error("Sign in as an analyst or administrator to search strategy reports.");
      const response = await fetch(`${API}/api/vector/search?q=${encodeURIComponent(query)}`, { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? "Similarity search failed.");
      setMatches(body); if (body.length === 0) setError("No indexed strategy reports matched. Create reports, then select Build or refresh index.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not search reports."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-5xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]"><BrainCircuit size={14}/> LOCAL VECTOR SEARCH</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Find related strategy reports</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#858d99]">Search saved report text by meaning. Results are similarity matches, not verified race facts or AI predictions. Embeddings are generated locally; the first indexing action downloads the model if it is not cached.</p></div>
    {error && <div role="status" className="mt-5 rounded-md border border-[#3a414b] bg-[#141920] px-4 py-3 text-sm text-[#cbd0d7]">{error}</div>}
    <form onSubmit={search} className="mt-6 flex flex-col gap-3 sm:flex-row"><input required minLength={3} maxLength={500} value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. reports that discuss tyre degradation and early stops" className="h-12 flex-1 rounded-md border border-[#303741] bg-[#11151b] px-4 text-sm text-white outline-none focus:border-[#a53b45]"/><button disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#e10618] px-5 text-xs font-semibold disabled:opacity-50"><Search size={15}/>{busy ? "Working…" : "Search reports"}</button></form>
    {user && user.roles.some(role => ["ADMIN", "ANALYST"].includes(role)) && <button onClick={indexReports} disabled={busy} className="mt-3 rounded-md border border-[#303741] px-3 py-2 text-xs text-[#cbd0d7] hover:border-[#737d89] disabled:opacity-50">Build or refresh report index</button>}
    <section className="mt-6 space-y-3">{matches.map((match, index) => <article key={match.metadata.report_id} className="rounded-lg border border-[#252b34] bg-[#11151b] p-5"><div className="flex flex-wrap justify-between gap-3"><div className="text-[10px] font-bold tracking-wider text-[#ff7b84]">MATCH {index + 1} · REPORT #{match.metadata.report_id}</div><div className="text-[10px] text-[#89939f]">Cosine distance {Number(match.cosine_distance).toFixed(3)}</div></div><h2 className="mt-3 text-lg font-semibold">{match.metadata.race_name}</h2><p className="mt-1 text-xs text-[#929aa5]">{match.metadata.driver_name} · {match.metadata.strategy_type}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#cbd0d7]">{match.document}</p><Link href="/reports" className="mt-4 inline-block text-xs text-[#ff7b84] hover:underline">Browse saved reports</Link></article>)}</section>
    <p className="mt-5 text-[10px] leading-5 text-[#68727e]">The search uses the Chroma persistent local vector store and its default all-MiniLM-L6-v2 embedding function with cosine distance. Scores help rank text similarity; they are not confidence values.</p>
  </div></main>;
}
