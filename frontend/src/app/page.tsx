"use client";

import { useEffect, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, CircleHelp, Database, Download, Flag,
  Gauge, Layers3, Map, Menu, Search, ShieldCheck, Timer, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const API = "";
type Summary = { races: number; drivers: number; constructors: number; race_results: number; average_finish: number | null };
type SeasonSummary = { season: number; races: number; results: number; lap_records: number; pit_stops: number };
type SessionUser = { display_name: string; roles: string[]; csrf_token: string };
type SeasonChampion = { season: number; driver_name: string; driver_points: number; constructor_name: string; constructor_points: number };
type RacePodium = { race_id: number; race_name: string; race_date: string; circuit: string; first_driver: string | null; first_constructor: string | null; second_driver: string | null; second_constructor: string | null; third_driver: string | null; third_constructor: string | null };

const nav = [
  { label: "Overview", href: "/", icon: Gauge }, { label: "Drivers", href: "/drivers", icon: Users },
  { label: "Constructors", href: "/constructors", icon: Layers3 }, { label: "Race events", href: "/races", icon: Flag },
  { label: "Track layouts", href: "/track-layouts", icon: Map },
  { label: "Race analysis", href: "/analysis", icon: Timer }, { label: "Try a strategy", href: "/strategy", icon: Activity },
  { label: "Search reports", href: "/search", icon: BrainCircuit },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [championSeasons, setChampionSeasons] = useState<SeasonChampion[]>([]);
  const [podiumSeason, setPodiumSeason] = useState(2025);
  const [racePodiums, setRacePodiums] = useState<RacePodium[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API}/api/dashboard/summary`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error("API unavailable"); return r.json(); }),
      fetch(`${API}/api/analytics/season-summary`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error("API unavailable"); return r.json(); }),
    ]).then(([s, seasonRows]) => { if (active) { setSummary(s); setSeasons(seasonRows); if (seasonRows.length) setPodiumSeason(seasonRows[seasonRows.length - 1].season); } })
      .catch(() => { if (active) setError("Could not load race data. Start the API and MySQL service, then retry."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/analytics/season-champions`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(rows => { if (active) setChampionSeasons(rows); })
      .catch(() => { if (active) setChampionSeasons([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!podiumSeason) return;
    setRacePodiums([]);
    fetch(`${API}/api/analytics/race-podiums?season=${podiumSeason}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(rows => { if (active) setRacePodiums(rows); })
      .catch(() => { if (active) setRacePodiums([]); });
    return () => { active = false; };
  }, [podiumSeason]);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/auth/me`, { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(value => { if (active) setUser(value); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  async function signOut() {
    if (!user) { window.location.assign("/login"); return; }
    setAuthBusy(true); setAuthError("");
    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST", credentials: "include", headers: { "X-CSRF-Token": user.csrf_token },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "Sign-out failed. Please retry.");
      }
      setUser(null);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Could not reach the sign-out service.");
    } finally { setAuthBusy(false); }
  }

  const metrics = [
    { label: "RACES IN THE DATA", value: summary?.races ?? "—", sub: "Completed Grand Prix events", icon: Flag, trend: "Race calendar" },
    { label: "DRIVERS IN THE DATA", value: summary?.drivers ?? "—", sub: "Across seasons shown below", icon: Users, trend: "Driver directory" },
    { label: "TEAMS (CONSTRUCTORS)", value: summary?.constructors ?? "—", sub: "Teams with recorded results", icon: Layers3, trend: "Team directory" },
    { label: "RACE RESULT RECORDS", value: summary?.race_results ?? "—", sub: "Driver finishing records across imported races", icon: Activity, trend: "Classification data" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#f4f5f7]" style={{backgroundImage:"radial-gradient(ellipse at 78% 0%, rgba(225,6,24,.11), transparent 32%), radial-gradient(ellipse at 9% 48%, rgba(48,66,84,.12), transparent 34%), linear-gradient(180deg,#0b0e12 0%,#090b0e 100%)"}}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] border-r border-[#252b34] bg-[#0d1015] lg:block">
        <div className="flex h-[78px] items-center gap-3 border-b border-[#252b34] px-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e10618] text-xs font-black tracking-tight">RI</div>
          <div><div className="text-[13px] font-bold tracking-[.14em]">RACE INTEL</div><div className="mt-0.5 text-[10px] tracking-[.18em] text-[#858d99]">STRATEGY LAB</div></div>
        </div>
        <div className="px-4 pt-7">
          <div className="mb-3 px-3 text-[10px] font-semibold tracking-[.16em] text-[#65707d]">WORKSPACE</div>
          <nav className="space-y-1" aria-label="Primary navigation">
            {nav.map(({ label, href, icon: Icon }, i) => <a key={label} href={href} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] ${i === 0 ? "border border-[#452127] bg-[#211317] text-white" : "text-[#9aa2ad] hover:bg-[#171c23] hover:text-white"}`}><Icon size={16} strokeWidth={1.8}/>{label}{i === 0 && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e10618]"/>}</a>)}
          </nav>
          {user?.roles.includes("ADMIN") && <div className="mt-8 border-t border-[#252b34] pt-5"><div className="mb-3 px-3 text-[10px] font-semibold tracking-[.16em] text-[#ff6672]">ADMIN CONSOLE · ADMIN ONLY</div><nav aria-label="Administrator tools" className="space-y-1"><a href="/admin/data" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-[#cbd0d7] hover:bg-[#171c23] hover:text-white"><Database size={16}/>Manual race data</a><a href="/admin/sessions" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-[#cbd0d7] hover:bg-[#171c23] hover:text-white"><Flag size={16}/>Manage sessions</a><a href="/admin/imports" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-[#cbd0d7] hover:bg-[#171c23] hover:text-white"><Download size={16}/>Import F1 data</a><a href="/admin/users" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-[#cbd0d7] hover:bg-[#171c23] hover:text-white"><ShieldCheck size={16}/>Users and roles</a></nav><p className="mt-3 px-3 text-[10px] leading-4 text-[#68727e]">Admins manage records, imports, accounts and audit history. Analysts can explore data and run strategy analysis.</p></div>}
          <div className="mb-3 mt-9 px-3 text-[10px] font-semibold tracking-[.16em] text-[#65707d]">ANALYSIS</div>
          <a href="/reports" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-[#9aa2ad] hover:bg-[#171c23]"><Search size={16}/>Strategy reports</a>
          <a href="/search" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-[#9aa2ad] hover:bg-[#171c23]"><BrainCircuit size={16}/>Semantic report search</a>
        </div>
        <div className="absolute bottom-0 w-full border-t border-[#252b34] p-4">
          <div className="flex items-center gap-3 rounded-lg bg-[#151a21] p-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#3a2025] text-xs font-bold text-[#ff6672]">{user ? user.display_name.slice(0, 2).toUpperCase() : "?"}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{user?.display_name ?? "Signed out"}</div><div className="mt-1 text-[10px] text-[#858d99]">{user?.roles.includes("ADMIN") ? "ADMIN · manages data" : user ? "ANALYST · explores data" : "Public view · sign in for an account"}</div></div></div>
        </div>
      </aside>

      <main className="lg:pl-[248px]">
        <header className="sticky top-0 z-10 flex h-[78px] items-center justify-between border-b border-[#252b34] bg-[#0a0c10]/90 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3"><button aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)} className="lg:hidden"><Menu size={19}/></button><div className="text-xs text-[#858d99]">Workspace <span className="mx-2 text-[#454d58]">/</span><span className="text-white">Overview</span></div></div>
          <div className="flex items-center gap-3"><a href="/drivers" className="hidden items-center gap-2 rounded-md border border-[#252b34] px-3 py-2 text-xs text-[#9aa2ad] sm:flex"><Search size={14}/> Browse data</a>{user && <span className={`hidden rounded-md border px-2.5 py-2 text-[10px] font-semibold tracking-wide sm:inline-flex ${user.roles.includes("ADMIN") ? "border-[#6a343d] bg-[#28171b] text-[#ff9ca5]" : "border-[#344151] bg-[#17202a] text-[#b9cbe0]"}`}>{user.roles.includes("ADMIN") ? "ADMIN · MANAGE DATA" : "ANALYST · ANALYZE"}</span>}{user ? <button onClick={signOut} disabled={authBusy} className="rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777] disabled:opacity-50">{authBusy ? "Signing out…" : "Sign out"}</button> : <><a href="/login" className="rounded-md px-2 py-2 text-xs text-[#b5bdc7] hover:text-white">Sign in</a><a href="/register" className="rounded-md bg-[#e10618] px-3 py-2 text-xs font-semibold text-white hover:bg-[#c90012]">Create account</a></>}<a aria-label="Help" href="http://localhost:8001/docs" target="_blank" rel="noreferrer" className="rounded-md p-2 text-[#9aa2ad] hover:bg-[#171c23]"><CircleHelp size={17}/></a><div className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-[#4c3338] bg-[#28171b] text-[10px] font-bold text-[#ff8791]">{user ? user.display_name.slice(0, 2).toUpperCase() : "?"}</div></div>
        </header>
        {mobileNavOpen && <nav aria-label="Mobile navigation" className="border-b border-[#252b34] bg-[#0d1015] px-5 py-3 lg:hidden">{nav.map(({ label, href, icon: Icon }) => <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-[#cbd0d7] hover:bg-[#171c23]"><Icon size={16}/>{label}</a>)}{user?.roles.includes("ADMIN") && <><div className="px-3 pb-1 pt-4 text-[10px] font-semibold tracking-[.16em] text-[#ff6672]">ADMIN CONSOLE · ADMIN ONLY</div><a href="/admin/data" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-[#cbd0d7]"><Database size={16}/>Manual race data</a><a href="/admin/sessions" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-[#cbd0d7]"><Flag size={16}/>Manage sessions</a><a href="/admin/imports" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-[#cbd0d7]"><Download size={16}/>Import F1 data</a><a href="/admin/users" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-[#cbd0d7]"><ShieldCheck size={16}/>Users and roles</a></>}</nav>}

        <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 md:px-9 md:pt-10">
          <div className="relative isolate mb-8 overflow-hidden rounded-xl border border-[#292e36] bg-[#101419]/90 px-5 py-6 md:px-7">
            <svg aria-hidden="true" className="pointer-events-none absolute -right-4 -top-5 h-[150%] w-[62%] opacity-[.16] md:opacity-[.22]" viewBox="0 0 620 260" fill="none" preserveAspectRatio="xMidYMid slice"><path d="M54 197c-18-29 2-76 35-79l101-8c20-2 28-18 21-34l-12-26c-8-17 4-34 24-35l82-3c20-1 30 12 28 28l-4 33c-2 16 10 27 29 25l102-11c22-2 40 12 40 34v22c0 19 13 29 33 24l46-11c24-6 43 8 42 31l-1 17c-1 19-17 31-38 27l-91-18c-18-4-32 7-32 25v22c0 20-16 31-36 25l-96-29c-18-6-31 5-30 24l2 26c1 21-17 32-36 24l-71-30c-19-8-36 1-40 20l-3 13" stroke="#e10618" strokeWidth="2.2" strokeLinecap="round"/><path d="M54 197c-18-29 2-76 35-79l101-8c20-2 28-18 21-34l-12-26c-8-17 4-34 24-35l82-3c20-1 30 12 28 28l-4 33c-2 16 10 27 29 25l102-11c22-2 40 12 40 34v22c0 19 13 29 33 24l46-11c24-6 43 8 42 31l-1 17c-1 19-17 31-38 27l-91-18c-18-4-32 7-32 25v22" stroke="#8f99a5" strokeWidth=".7" strokeDasharray="3 8" strokeLinecap="round"/></svg>
            <div className="relative z-[1] flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[.2em] text-[#ff5461]"><span className="h-1.5 w-1.5 rounded-full bg-[#e10618]"/> PERFORMANCE CONTROL ROOM</div><h1 className="text-3xl font-semibold tracking-[-.04em] md:text-[34px]">Race intelligence</h1><p className="mt-2 max-w-xl text-sm text-[#a0a8b2]">A clear view of the data behind every strategic decision.</p></div>
              <div className="w-fit rounded-md border border-[#414752]/80 bg-[#11151b]/80 px-3.5 py-2.5 text-xs font-medium text-[#d7dbe0] backdrop-blur">{seasons.length ? `${seasons.length} seasons available · ${seasons[0].season}–${seasons[seasons.length - 1].season}` : "Checking imported seasons…"}</div>
            </div>
          </div>

          {(error || authError) && <div role="alert" className="mb-5 flex items-center justify-between rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]"><span>{authError || error}</span>{error && !authError && <button onClick={() => location.reload()} className="ml-3 underline">Retry</button>}</div>}

          <section aria-label="Database metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({label,value,sub,icon:Icon,trend},i) => <article key={label} className="rounded-lg border border-[#252b34] bg-[#11151b] p-4 md:p-[18px]">
              <div className="flex items-center justify-between"><span className="text-[10px] font-semibold tracking-[.13em] text-[#8d96a2]">{label}</span><Icon size={16} className={i === 3 ? "text-[#f2b354]" : "text-[#858d99]"}/></div>
              <div className="mt-5 flex items-end justify-between"><div className="text-[31px] font-semibold leading-none tracking-[-.04em]">{loading ? "…" : value}</div><span className="rounded bg-[#1b2028] px-2 py-1 text-[10px] text-[#a0a8b2]">{trend}</span></div>
              <div className="mt-3 text-[11px] text-[#78818d]">{sub}</div>
            </article>)}
          </section>

          <section className="mt-4 rounded-lg border border-[#353c47] bg-[#11151b] p-5 md:p-6">
            <div className="max-w-3xl"><div className="text-sm font-semibold">New here? Start with a question.</div><p className="mt-1 text-xs leading-5 text-[#9aa2ad]">This site turns recorded race data into answers. Choose a starting point below; every result comes from the database, and missing source data is shown as unavailable.</p></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                {step:"01",title:"Who raced?",desc:"Browse events, finishing order and points.",href:"/races",icon:Flag},
                {step:"02",title:"Who performed better?",desc:"Compare drivers and constructors.",href:"/drivers",icon:Users},
                {step:"03",title:"Where was time gained?",desc:"Review lap pace and pit stops when recorded.",href:"/analysis",icon:Timer},
                {step:"04",title:"What if the plan changed?",desc:"Test a hypothetical pit strategy with visible assumptions.",href:"/strategy",icon:Activity},
                {step:"05",title:"Where is the race held?",desc:"Browse circuit outlines and track lengths.",href:"/track-layouts",icon:Map},
              ].map(({step,title,desc,href,icon:Icon})=><a key={step} href={href} className="group rounded-md border border-[#252b34] bg-[#151a21] p-4 hover:border-[#626d7a]"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold tracking-widest text-[#ff6672]">{step}</span><Icon size={16} className="text-[#9aa2ad] group-hover:text-white"/></div><div className="mt-3 text-sm font-semibold">{title}</div><p className="mt-1 text-xs leading-5 text-[#858d99]">{desc}</p></a>)}
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <article className="rounded-lg border border-[#252b34] bg-[#11151b] p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-sm font-semibold">Champions by season</div><div className="mt-1 text-xs text-[#858d99]">Points scored by each year’s driver and constructor champion</div></div><div className="flex flex-wrap gap-4 text-[10px] text-[#a0a8b2]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#e10618]"/>Driver champion</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#7c8795]"/>Constructor champion</span></div></div>
              <div className="mt-5 h-[260px]">{championSeasons.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={championSeasons} margin={{top:8,right:10,left:-16,bottom:0}}><CartesianGrid stroke="#242a32" vertical={false}/><XAxis dataKey="season" stroke="#717b87" tickLine={false} axisLine={false} tick={{fontSize:11}}/><YAxis stroke="#717b87" tickLine={false} axisLine={false} tick={{fontSize:10}}/><Tooltip formatter={(value,name)=>[`${Number(value).toFixed(0)} points`,name]} labelFormatter={label=>`${label} season`} contentStyle={{background:"#171c23",border:"1px solid #303741",borderRadius:8,fontSize:12}}/><Bar dataKey="driver_points" name="Driver champion" fill="#e10618" radius={[3,3,0,0]}/><Bar dataKey="constructor_points" name="Constructor champion" fill="#7c8795" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-xs text-[#78818d]">Champion records unavailable</div>}</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{championSeasons.map(row=><article key={row.season} className="rounded-md border border-[#292f38] bg-[#151a21] p-3"><div className="text-[10px] font-semibold tracking-wider text-[#ff7b84]">{row.season} season</div><div className="mt-2 text-[10px] text-[#798390]">Driver champion</div><div className="text-xs font-semibold">{row.driver_name}</div><div className="mt-2 text-[10px] text-[#798390]">Constructor champion</div><div className="text-xs font-semibold">{row.constructor_name}</div></article>)}</div>
              <div className="mt-3 border-t border-[#252b34] pt-3 text-[10px] leading-5 text-[#737d89]">Champion points and names are calculated from imported race results. Overtake counts remain available on the race list where the source has coverage.</div>
              {seasons.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{seasons.map(item=><div key={item.season} className="rounded-md border border-[#252b34] bg-[#151a21] p-3"><div className="text-xs font-semibold">{item.season} season</div><div className="mt-1 text-[10px] text-[#78818d]">{item.races} races · {item.results} results · {item.lap_records.toLocaleString()} lap times · {item.pit_stops.toLocaleString()} pit stops</div></div>)}</div>}
            </article>

            <article id="strategy" className="rounded-lg border border-[#252b34] bg-[#11151b] p-5 md:p-6">
              <div className="flex items-start justify-between"><div><div className="text-sm font-semibold">Explore the data</div><div className="mt-1 text-xs text-[#858d99]">Open a section for detailed records</div></div><ShieldCheck size={16} className="text-[#f2b354]"/></div>
              <div className="mt-6 space-y-3">
                {[{title:"Compare drivers",desc:"See finishes, points and pace side by side",icon:Users,href:"/compare"},{title:"Review pit stops",desc:"See when stops happened and recorded times",icon:ArrowDownRight,href:"/analysis"},{title:"Test a race plan",desc:"Compare a hypothetical one-stop or two-stop plan",icon:Activity,href:"/strategy"}].map(({title,desc,icon:Icon,href})=><a key={title} href={href} className="group flex items-center gap-3 rounded-md border border-[#252b34] bg-[#141920] p-3 transition hover:border-[#454d58]"><div className="grid h-8 w-8 place-items-center rounded-md bg-[#20262f] text-[#d0d5dc]"><Icon size={15}/></div><div className="min-w-0 flex-1"><div className="text-xs font-medium">{title}</div><div className="mt-1 text-[10px] text-[#858d99]">{desc}</div></div><ArrowUpRight size={14} className="text-[#78818d] transition group-hover:text-white"/></a>)}
              </div>
              <div className="mt-4 rounded-md border border-[#4b3035] bg-[#211519] p-3"><div className="text-[10px] font-semibold tracking-[.12em] text-[#ff7781]">ABOUT THESE NUMBERS</div><p className="mt-1.5 text-[11px] leading-relaxed text-[#d2b9bd]">These are imported public records for {seasons.map(item => item.season).join(", ") || "no seasons yet"}. Synthetic classroom examples are excluded. The season cards show which record types each year actually contains. Weather, tyre compounds and detailed car telemetry are not in this dataset, so those analyses may be empty.</p></div>
            </article>
          </section>

          <section id="race-podiums" className="mt-4 rounded-lg border border-[#252b34] bg-[#11151b] p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-sm font-semibold">Race podiums by circuit</div><div className="mt-1 text-xs text-[#858d99]">Top three classified finishers for every race in the selected season</div></div><label className="text-[10px] text-[#9aa2ad]">Season<select aria-label="Podium season" value={podiumSeason} onChange={e=>setPodiumSeason(Number(e.target.value))} className="ml-2 rounded-md border border-[#303741] bg-[#151a21] px-2.5 py-2 text-xs text-white">{seasons.map(s=><option key={s.season} value={s.season}>{s.season}</option>)}</select></label></div>
            <details className="mt-4 rounded-md border border-[#252b34] bg-[#0d1015]"><summary className="cursor-pointer px-4 py-3 text-xs font-medium text-[#d2d7de] hover:text-white">Expand race podiums</summary><div className="overflow-x-auto px-4 pb-3"><table className="w-full min-w-[820px] text-left text-xs"><thead className="text-[10px] tracking-wider text-[#77818d]"><tr><th className="pb-2 pr-4">ROUND / CIRCUIT</th><th className="pb-2 px-3">1ST</th><th className="pb-2 px-3">2ND</th><th className="pb-2 px-3">3RD</th></tr></thead><tbody>{racePodiums.map(row=><tr key={row.race_id} className="border-t border-[#252b34]"><td className="py-3 pr-4"><div className="font-medium">{row.race_name}</div><div className="mt-1 text-[10px] text-[#78818d]">{row.circuit} · {String(row.race_date).slice(0,10)}</div></td>{[[row.first_driver,row.first_constructor],[row.second_driver,row.second_constructor],[row.third_driver,row.third_constructor]].map(([driver,constructor],index)=><td key={index} className="px-3 py-3"><div className="font-semibold">{driver ?? "Unavailable"}</div><div className="mt-1 text-[10px] text-[#78818d]">{constructor ?? "No classified finisher"}</div></td>)}</tr>)}</tbody></table>{!racePodiums.length && <div className="py-6 text-center text-xs text-[#78818d]">No imported race podiums found for {podiumSeason || "this season"}.</div>}</div></details>
            <div className="mt-3 text-[10px] text-[#68727e]">Source: imported race classification records in the project database. Unavailable places are shown when a source result is missing.</div>
          </section>

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-[#20252d] pt-4 text-[10px] text-[#626c78] md:flex-row"><span>F1 RACE STRATEGY & PERFORMANCE INTELLIGENCE</span><span>Academic DBMS project · Local environment</span></footer>
        </div>
      </main>
    </div>
  );
}
