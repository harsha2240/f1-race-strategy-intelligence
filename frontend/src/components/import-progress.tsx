"use client";

import { useEffect, useRef, useState } from "react";

export type ImportRun = {
  import_run_id: number;
  event_name: string;
  season_year: number;
  session_type: string;
  source: string;
  status: string;
  rows_written: number;
  error_summary: string | null;
  progress?: string;
};

export function ImportProgress({ enabled, onCompleted, onHistory }: {
  enabled: boolean;
  onCompleted?: () => void;
  onHistory?: (runs: ImportRun[]) => void;
}) {
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const completed = useRef(onCompleted);
  const updateHistory = useRef(onHistory);
  useEffect(() => { completed.current = onCompleted; }, [onCompleted]);
  useEffect(() => { updateHistory.current = onHistory; }, [onHistory]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous: ImportRun[] | undefined;
    async function poll() {
      try {
        const response = await fetch("/api/ingestion/history", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const history: ImportRun[] = await response.json();
        if (stopped) return;
        if (previous && history.some(run => run.status === "succeeded" &&
          !previous?.some(old => old.import_run_id === run.import_run_id && old.status === "succeeded"))) {
          completed.current?.();
        }
        previous = history;
        updateHistory.current?.(history);
        setRuns(history);
        setUnavailable(false);
      } catch {
        if (!stopped) setUnavailable(true);
      } finally {
        if (!stopped) timer = setTimeout(poll, 3000);
      }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [enabled]);

  if (!enabled || (!runs.length && !unavailable)) return null;
  const active = runs.filter(run => run.status === "running");
  const visible = runs[0] && !active.includes(runs[0]) ? [runs[0], ...active] : active;
  return <section aria-label="Import progress" className="mt-5 space-y-3 rounded-lg border border-[#252b34] bg-[#11151b] p-4 text-sm" role="status">
    {unavailable && <p>Could not refresh import status. Retrying…</p>}
    {visible.map(run => <div key={run.import_run_id}>
      <p className="font-medium">#{run.import_run_id} · {run.season_year} · {run.event_name} · {run.session_type} · {run.status}</p>
      {run.status === "running" && <>
        <p className="mt-1 text-[#b8bec8]">{run.progress ?? "Import in progress. Source requests may take several minutes."}</p>
        <progress aria-label={`Import #${run.import_run_id} in progress`} className="mt-2 h-2 w-full accent-[#e10618]" />
      </>}
      {run.status === "succeeded" && <p className="mt-1 text-[#a8d8b4]">{run.error_summary ?? `${run.rows_written} rows written.`}</p>}
      {run.status === "failed" && <p className="mt-1 text-[#ffadb4]">{run.error_summary ?? "Import failed."}</p>}
    </div>)}
  </section>;
}
