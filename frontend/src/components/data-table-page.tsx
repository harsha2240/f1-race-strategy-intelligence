"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Database } from "lucide-react";
import Link from "next/link";

const API = "";
export type Column = { key: string; label: string; format?: "decimal" | "date" | "datetime" };

function formatValue(value: unknown, format?: Column["format"]): string {
  if (value == null) return "—";
  if (format === "decimal") return Number(value).toFixed(1);
  if (format === "date") return new Date(String(value)).toLocaleDateString();
  if (format === "datetime") return new Date(String(value)).toLocaleString();
  return String(value);
}

export function DataTablePage({ title, subtitle, endpoint, columns, detailHref }: {
  title: string; subtitle: string; endpoint: string; columns: Column[]; detailHref?: { key: string; prefix: string };
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`${API}${endpoint}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load records");
      return response.json();
    }).then(data => { if (active) setRows(data); })
      .catch(() => { if (active) setError("Data is unavailable. Check that the API and database are running."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8"><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">RACE INTELLIGENCE</div><h1 className="text-3xl font-semibold tracking-[-.04em]">{title}</h1><p className="mt-2 text-sm leading-6 text-[#a2aab5]">{subtitle}</p>{detailHref && <p className="mt-2 text-xs text-[#858d99]">Select an event name to see its finishing order and points.</p>}</div>
    {error && <div role="alert" className="mt-6 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <section className="mt-7 overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><Database size={15} className="text-[#e10618]"/> Available records</div><span className="text-[10px] text-[#78818d]">{rows.length} shown</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-[.1em] text-[#858d99]"><tr>{columns.map(c=><th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>)}</tr></thead><tbody className="divide-y divide-[#252b34]">{rows.map((row,index)=><tr key={String(row[columns[0].key] ?? index)} className="hover:bg-[#151a21]">{columns.map(c=><td key={c.key} className="px-4 py-3 text-[#cbd0d7]">{detailHref && c.key === columns[0].key ? <Link className="font-medium text-white hover:text-[#ff6873]" href={`${detailHref.prefix}${row[detailHref.key]}`}>{formatValue(row[c.key],c.format)}</Link> : formatValue(row[c.key],c.format)}</td>)}</tr>)}{!loading && rows.length===0 && <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[#858d99]">No records are available for the current database.</td></tr>}{loading && <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[#858d99]">Loading records…</td></tr>}</tbody></table></div>
    </section>
  </div></main>;
}
