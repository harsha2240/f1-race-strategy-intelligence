"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Result = {
  result_id: number;
  race_name: string;
  season: number;
  driver_name: string;
  constructor_name: string;
  status: string;
  incident_id: number | null;
  incident_category: string | null;
  incident_note: string | null;
};

export default function AdminDataPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [csrf, setCsrf] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Result | null>(null);
  const [category, setCategory] = useState("Penalty");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const input = "rounded border border-[#303741] bg-[#0d1015] px-3 py-2 text-sm text-white";

  useEffect(() => {
    async function load() {
      const auth = await fetch("/api/auth/me", { cache: "no-store" });
      if (!auth.ok) throw new Error("Sign in as an administrator.");
      const user = await auth.json();
      if (!user.roles.includes("ADMIN")) throw new Error("Only admins can record incidents.");
      const response = await fetch("/api/admin/race-results", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load race results.");
      setResults(await response.json());
      setCsrf(user.csrf_token);
    }
    void load().catch(reason => setError(reason.message));
  }, []);

  async function saveIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !csrf || !note.trim() || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/race-results/${selected.result_id}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ category, note: note.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Could not save the incident.");
      setResults(rows => rows.map(row => row.result_id === selected.result_id
        ? { ...row, incident_id: body.incident_id, incident_category: body.category, incident_note: body.note } : row));
      setMessage(`Incident saved for ${selected.driver_name}.`);
      setSelected(null);
      setNote("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the incident.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteIncident(row: Result) {
    if (!csrf || !row.incident_id || busy) return;
    if (!window.confirm(`Delete the recorded incident for ${row.driver_name} at ${row.race_name}?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/race-results/${row.result_id}/incidents/${row.incident_id}`, {
        method: "DELETE", headers: { "X-CSRF-Token": csrf },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "Could not delete the incident.");
      }
      setMessage(`Incident deleted for ${row.driver_name}.`);
      setResults(rows => rows.map(item => item.result_id === row.result_id
        ? { ...item, incident_id: null, incident_category: null, incident_note: null } : item));
      const refreshed = await fetch("/api/admin/race-results", { cache: "no-store" });
      if (refreshed.ok) setResults(await refreshed.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the incident.");
    } finally {
      setBusy(false);
    }
  }

  const terms = query.toLowerCase().trim().split(/\s+/);
  const matches = results.filter(row => {
    const label = `${row.season} ${row.race_name} ${row.driver_name} ${row.constructor_name}`.toLowerCase();
    return terms.every(term => label.includes(term));
  });

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10">
    <div className="mx-auto max-w-6xl">
      <Link href="/" replace className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14} /> Back to overview</Link>
      <h1 className="mt-8 text-3xl font-semibold">Manual race data</h1>
      <p className="mt-2 text-sm text-[#a2aab5]">Record penalties, component failures, or other incidents against an existing race result. The source classification stays intact.</p>
      {error && <p role="alert" className="mt-4 text-sm text-[#ffadb4]">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-[#a8d8b4]">{message}</p>}
      {selected && <form onSubmit={saveIncident} className="mt-5 grid gap-3 rounded-lg border border-[#252b34] bg-[#11151b] p-5">
        <h2 className="font-semibold">{selected.driver_name} · {selected.season} {selected.race_name}</h2>
        <label className="grid gap-1 text-sm">Incident type
          <select value={category} onChange={e => setCategory(e.target.value)} className={input}>
            <option>Penalty</option><option>Component failure</option><option>Other incident</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Details
          <textarea required maxLength={500} rows={3} value={note} onChange={e => setNote(e.target.value)} className={input} />
        </label>
        <div className="flex gap-4">
          <button disabled={busy || !note.trim()} className="rounded bg-[#e10618] px-4 py-2 text-sm font-semibold disabled:opacity-50">Save incident</button>
          <button disabled={busy} type="button" onClick={() => setSelected(null)} className="text-sm">Cancel</button>
        </div>
      </form>}
      <section className="mt-6 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]">
        <div className="p-4">
          <label className="grid gap-2 text-sm">Find a race result
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by year, race, or driver" className={input} />
          </label>
          {matches.length > 100 && <p className="mt-2 text-xs text-[#929aa5]">Showing 100 of {matches.length} matches. Narrow the search to see others.</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#151a21]"><tr>{["Race", "Driver", "Source status", "Latest incident", "Actions"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#252b34]">
              {matches.slice(0, 100).map(row => <tr key={row.result_id}>
                <td className="p-3">{row.season} · {row.race_name}</td>
                <td className="p-3">{row.driver_name}<div className="text-xs text-[#929aa5]">{row.constructor_name}</div></td>
                <td className="p-3">{row.status}</td>
                <td className="max-w-sm break-words p-3">{row.incident_category ? `${row.incident_category} · ${row.incident_note}` : "—"}</td>
                <td className="p-3"><button type="button" disabled={!csrf || busy} onClick={() => {
                  setSelected(row);
                  setCategory("Penalty");
                  setNote("");
                  setMessage("");
                  setError("");
                }} className="whitespace-nowrap text-[#ff8a94] hover:text-white">Record incident</button>
                  {row.incident_id && <button type="button" disabled={!csrf || busy} onClick={() => void deleteIncident(row)} className="mt-1 block whitespace-nowrap text-[#ff8a94] hover:text-white">Delete incident</button>}
                </td>
              </tr>)}
              {!matches.length && <tr><td colSpan={5} className="p-5 text-center text-[#929aa5]">{csrf ? "No matching results." : "No results loaded."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}
