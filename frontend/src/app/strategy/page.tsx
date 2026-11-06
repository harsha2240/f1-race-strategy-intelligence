"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, LockKeyhole } from "lucide-react";

const API = "";
type Race = { race_id: number; race_name: string; season: number; country: string; race_laps: number | null };
type Driver = { driver_id: number; full_name: string };
type User = { csrf_token: string; roles: string[] };
type Scenario = { name: "one_stop" | "two_stop"; pit_stops: number; plan_id: number; estimate: Record<string, number | string | unknown[]> };
type Result = { race: string; season: number; race_laps: number; baseline_source: string; baseline_lap_ms: number; scenarios: Scenario[]; two_stop_minus_one_stop_ms: number; faster_estimate: string; assumption_note: string };

function seconds(value: unknown) { return `${(Number(value) / 1000).toFixed(1)} s`; }

export default function StrategyPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [raceId, setRaceId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [pitLossSeconds, setPitLossSeconds] = useState(22);
  const [baselineSeconds, setBaselineSeconds] = useState<number | "">("");
  const [user, setUser] = useState<User | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API}/api/races?limit=200`, { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject()),
      fetch(`${API}/api/auth/me`, { credentials: "include", cache: "no-store" }).then(response => response.ok ? response.json() : null),
    ]).then(([raceRows, currentUser]) => {
      if (!active) return;
      setRaces(raceRows); setUser(currentUser);
      if (raceRows.length) setRaceId(String(raceRows[0].race_id));
    }).catch(() => { if (active) setError("Could not load race events. Check that the API and database are running."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!raceId) return;
    let active = true;
    setDrivers([]); setDriverId(""); setResult(null); setLoadingDrivers(true); setError("");
    fetch(`${API}/api/races/${raceId}/drivers`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((rows: Driver[]) => { if (active) { setDrivers(rows); if (rows.length) setDriverId(String(rows[0].driver_id)); } })
      .catch(() => { if (active) setError("Could not load the drivers who entered this race."); })
      .finally(() => { if (active) setLoadingDrivers(false); });
    return () => { active = false; };
  }, [raceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setResult(null); setBusy(true);
    try {
      if (!user) throw new Error("Sign in to calculate and save a comparison.");
      const response = await fetch(`${API}/api/strategy-plans/compare`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": user.csrf_token },
        body: JSON.stringify({ race_id: Number(raceId), driver_id: Number(driverId),
          pit_loss_ms: Math.round(pitLossSeconds * 1000),
          baseline_lap_ms: baselineSeconds === "" ? null : Math.round(baselineSeconds * 1000) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail ?? "Could not calculate this comparison.");
      setResult(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reach the API."); }
    finally { setBusy(false); }
  }

  const differenceSeconds = result ? Math.abs(result.two_stop_minus_one_stop_ms / 1000).toFixed(1) : "";
  const selectedRace = races.find(race => String(race.race_id) === raceId);
  const fasterLabel = result?.faster_estimate === "tie" ? "The estimates are equal" : `${result?.faster_estimate === "two_stop" ? "Two-stop" : "One-stop"} estimate is ${differenceSeconds} seconds quicker`;

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-5xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]"><Calculator size={13}/> STRATEGY COMPARISON</div><h1 className="text-3xl font-semibold tracking-[-.04em]">What if the plan changed?</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#a2aab5]">Compare a one-stop plan with a two-stop plan for a real race and entrant. We calculate both estimates using the same race pace and assumptions, then show the time difference here.</p></div>

    {!user && <div className="mt-5 flex flex-wrap items-center gap-2 rounded-md border border-[#604b2e] bg-[#201b13] px-4 py-3 text-sm text-[#f4d49d]"><LockKeyhole size={16}/> Sign in to run and save the comparison.<Link className="ml-1 underline" href="/login">Sign in</Link><span className="text-[#a88f65]">or</span><Link className="underline" href="/register">Create an account</Link></div>}
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}

    <section className="mt-6 rounded-lg border border-[#252b34] bg-[#11151b] p-5 md:p-7">
      <h2 className="text-sm font-semibold">Set up your comparison</h2>
      <p className="mt-1 text-xs leading-5 text-[#858d99]">Pick a race and one of its entrants. We use the race distance and split the laps evenly between stops.</p>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-xs text-[#c2c8d1]">Race<select required value={raceId} onChange={event=>setRaceId(event.target.value)} disabled={loading || !races.length} className="mt-2 block h-11 w-full rounded-md border border-[#303741] bg-[#151a21] px-3 text-sm text-white"><option value="">{loading ? "Loading races…" : "Choose a race"}</option>{races.map(race=><option key={race.race_id} value={race.race_id}>{race.season} · {race.race_name}</option>)}</select><span className="mt-1 block text-[10px] text-[#78818d]">Recorded distance: {selectedRace?.race_laps ? `${selectedRace.race_laps} laps` : "unavailable for this race"}.</span></label>
        <label className="text-xs text-[#c2c8d1]">Driver<select required value={driverId} onChange={event=>setDriverId(event.target.value)} disabled={loadingDrivers || !drivers.length} className="mt-2 block h-11 w-full rounded-md border border-[#303741] bg-[#151a21] px-3 text-sm text-white"><option value="">{loadingDrivers ? "Loading race entrants…" : "Choose a driver"}</option>{drivers.map(driver=><option key={driver.driver_id} value={driver.driver_id}>{driver.full_name}</option>)}</select></label>
        <label className="text-xs text-[#c2c8d1]">Time lost at each pit stop <span className="text-[#78818d]">(seconds)</span><input type="number" required min={0} max={120} step={0.5} value={pitLossSeconds} onChange={event=>setPitLossSeconds(Number(event.target.value))} className="mt-2 block h-11 w-full rounded-md border border-[#303741] bg-[#151a21] px-3 text-sm text-white"/><span className="mt-1 block text-[10px] text-[#78818d]">Default assumption: 22 seconds per stop.</span></label>
        <details className="rounded-md border border-[#303741] bg-[#151a21] p-3 text-xs text-[#c2c8d1]"><summary className="cursor-pointer font-medium">Advanced: enter a lap-time baseline</summary><label className="mt-3 block">Average lap time <span className="text-[#78818d]">(seconds, optional)</span><input type="number" min={30} max={300} step={0.001} value={baselineSeconds} onChange={event=>setBaselineSeconds(event.target.value === "" ? "" : Number(event.target.value))} placeholder="Leave blank to use available race data" className="mt-2 block h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm text-white"/><span className="mt-1 block text-[10px] text-[#78818d]">If this event has no detailed lap timing, the result will label its generic 90-second fallback.</span></label></details>
        <button disabled={busy || !raceId || !driverId || !selectedRace?.race_laps || !user} className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#e10618] px-4 text-sm font-semibold disabled:opacity-50 md:col-span-2">{busy ? "Comparing two plans…" : "Compare one-stop vs two-stop"}</button>
      </form>
      <div className="mt-5 grid gap-3 md:grid-cols-2"><article className="rounded-md border border-[#303741] bg-[#151a21] p-4"><div className="text-[10px] font-semibold tracking-wider text-[#ff7b84]">ONE-STOP PLAN</div><p className="mt-2 text-xs leading-5 text-[#a2aab5]">One pit stop splits the race into two evenly sized parts.</p></article><article className="rounded-md border border-[#303741] bg-[#151a21] p-4"><div className="text-[10px] font-semibold tracking-wider text-[#c2c9d1]">TWO-STOP PLAN</div><p className="mt-2 text-xs leading-5 text-[#a2aab5]">Two pit stops split the same race into three evenly sized parts.</p></article></div>
      <p className="mt-4 text-[10px] leading-5 text-[#78818d]">This is a teaching model, not a race prediction. It adds 0.08 seconds for each lap of tyre age, plus your pit-loss assumption. Actual tyre compounds, weather, traffic, safety cars and telemetry are not available or modeled.</p>
    </section>

    {result && <section aria-live="polite" className="mt-6 rounded-lg border border-[#31513c] bg-[#111a14] p-5 md:p-7"><div className="text-[10px] font-bold tracking-[.16em] text-[#86d49b]">COMPARISON RESULT · HYPOTHETICAL ONLY</div><h2 className="mt-2 text-xl font-semibold">{result.race} · {result.season}</h2><p className="mt-1 text-xs text-[#9eb1a2]">{result.race_laps} race laps · baseline: {result.baseline_source}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{result.scenarios.map(scenario=><article key={scenario.name} className="rounded-md border border-[#26362a] bg-[#141e17] p-4"><div className="text-[10px] font-semibold tracking-wider text-[#92a69a]">{scenario.pit_stops}-STOP PLAN</div><div className="mt-2 text-2xl font-semibold">{seconds(scenario.estimate.estimated_total_ms)}</div><div className="mt-1 text-[10px] text-[#92a69a]">estimated total · saved comparison #{scenario.plan_id}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><div className="text-[10px] text-[#788d7d]">Driving time</div>{seconds(scenario.estimate.base_time_ms)}</div><div><div className="text-[10px] text-[#788d7d]">Extra time from tyre wear</div>{seconds(scenario.estimate.degradation_time_ms)}</div><div><div className="text-[10px] text-[#788d7d]">Pit-stop time</div>{seconds(scenario.estimate.pit_time_ms)}</div><div><div className="text-[10px] text-[#788d7d]">Stops</div>{scenario.pit_stops}</div></div></article>)}</div>
      <div className="mt-4 rounded-md border border-[#35553d] bg-[#15221a] p-4"><div className="text-[10px] font-semibold tracking-wider text-[#92c99e]">MODEL RESULT</div><div className="mt-1 text-base font-semibold">{fasterLabel}</div><p className="mt-1 text-[10px] leading-5 text-[#9eb1a2]">{result.assumption_note}</p></div>
    </section>}
  </div></main>;
}
