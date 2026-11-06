"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPinned, Search } from "lucide-react";

const API = "";
const LAYOUTS_URL = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson";
type Circuit = { circuit_id: number; source_circuit_key: string | null; name: string; location: string | null; country: string | null; length_km: number | null; race_count: number; first_season: number; last_season: number; seasons: string };
type TrackFeature = { type: "Feature"; properties: { Name?: string; Location?: string; length?: number }; geometry: { type: string; coordinates: number[][] | number[][][] } };
type TrackGeoJson = { type: "FeatureCollection"; features: TrackFeature[] };

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/grand prix/g, "").replace(/autodromo|autodrome|circuit|international|street/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function featureForCircuit(circuit: Circuit, features: TrackFeature[]) {
  const keys = [circuit.name, circuit.location].filter((value): value is string => Boolean(value)).map(normalized);
  return features.find(feature => {
    const featureKeys = [feature.properties.Name, feature.properties.Location].filter((value): value is string => Boolean(value)).map(normalized);
    return featureKeys.some(key => keys.includes(key) || (key.length > 5 && keys.some(candidate => candidate.length > 5 && (key.includes(candidate) || candidate.includes(key)))));
  });
}

function geometryPath(feature: TrackFeature) {
  const raw = feature.geometry.type === "LineString" ? feature.geometry.coordinates as number[][] :
    feature.geometry.type === "MultiLineString" ? (feature.geometry.coordinates as number[][][])[0] : [];
  if (raw.length < 2) return null;
  const meanLatitude = raw.reduce((total, point) => total + point[1], 0) / raw.length;
  const latitudeScale = Math.cos(meanLatitude * Math.PI / 180);
  const points = raw.map(([longitude, latitude]) => [longitude * latitudeScale, -latitude]);
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX || 1, height = maxY - minY || 1;
  const scale = Math.min(620 / width, 310 / height);
  const offsetX = (700 - width * scale) / 2, offsetY = (380 - height * scale) / 2;
  const projected = points.map(([x, y]) => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale]);
  const path = projected.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { path, start: projected[0], next: projected[1] };
}

export default function TrackLayoutsPage() {
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState(2025);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [features, setFeatures] = useState<TrackFeature[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [error, setError] = useState("");
  const [layoutError, setLayoutError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/analytics/season-summary`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((rows: { season: number }[]) => {
        if (!active) return;
        const years = rows.map(row => row.season);
        setSeasons(years);
        if (years.length) setSeason(years[years.length - 1]);
      }).catch(() => { if (active) setError("Could not load imported seasons. Start the API and database, then retry."); });
    fetch(LAYOUTS_URL).then(response => response.ok ? response.json() : Promise.reject())
      .then((data: TrackGeoJson) => { if (active) setFeatures(data.features ?? []); })
      .catch(() => { if (active) setLayoutError("Circuit-outline data could not be reached. Check your internet connection and reload this page."); })
      .finally(() => { if (active) setLayoutLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setSelectedId(null);
    fetch(`${API}/api/circuits?season=${season}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((rows: Circuit[]) => { if (active) { setCircuits(rows); setSelectedId(rows[0]?.circuit_id ?? null); } })
      .catch(() => { if (active) { setCircuits([]); setError("Could not load circuits for this season."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [season]);

  const visible = useMemo(() => circuits.filter(circuit => `${circuit.name} ${circuit.location ?? ""} ${circuit.country ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [circuits, query]);
  const selected = circuits.find(circuit => circuit.circuit_id === selectedId) ?? visible[0] ?? null;
  const feature = selected ? featureForCircuit(selected, features) : undefined;
  const layout = feature ? geometryPath(feature) : null;
  const sourceLengthKm = feature?.properties.length ? feature.properties.length / 1000 : null;

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-7xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]"><MapPinned size={13}/> CIRCUIT EXPLORER</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Track layouts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#a2aab5]">Browse the circuits used in your imported seasons and inspect their track outlines.</p></div><label className="text-xs text-[#c2c8d1]">Season<select aria-label="Track-layout season" value={season} onChange={event=>setSeason(Number(event.target.value))} className="ml-2 rounded-md border border-[#303741] bg-[#151a21] px-3 py-2.5 text-sm text-white">{seasons.map(year=><option key={year} value={year}>{year}</option>)}</select></label></div>
    {(error || layoutError) && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error || layoutError}</div>}
    <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="border-b border-[#252b34] p-4"><div className="text-sm font-semibold">Circuits in {season}</div><div className="mt-1 text-[10px] text-[#858d99]">{loading ? "Loading…" : `${visible.length} circuits`}</div><label className="relative mt-4 block"><Search size={14} className="absolute left-3 top-3 text-[#737d89]"/><input aria-label="Search circuits" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search circuit or country" className="h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] pl-9 pr-3 text-xs text-white outline-none focus:border-[#a53b45]"/></label></div>
        <div className="max-h-[560px] overflow-y-auto">{visible.map(circuit=><button key={circuit.circuit_id} onClick={()=>setSelectedId(circuit.circuit_id)} className={`w-full border-b border-[#20252d] px-4 py-3 text-left transition hover:bg-[#171c23] ${selected?.circuit_id === circuit.circuit_id ? "bg-[#211519]" : ""}`}><div className="text-xs font-medium">{circuit.name}</div><div className="mt-1 text-[10px] text-[#858d99]">{circuit.location ? `${circuit.location} · ` : ""}{circuit.country ?? "Country unavailable"}</div></button>)}{!loading && visible.length === 0 && <div className="p-5 text-center text-xs text-[#858d99]">No circuits match that search.</div>}</div>
      </aside>
      <section className="min-w-0 rounded-lg border border-[#252b34] bg-[#11151b] p-4 md:p-6">{selected ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-semibold tracking-[.16em] text-[#ff7b84]">{selected.country ?? "FORMULA 1 CIRCUIT"}</div><h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2><div className="mt-1 text-xs text-[#929aa5]">{selected.location ?? "Location unavailable"} · Raced in {selected.seasons}</div></div><div className="rounded-md border border-[#303741] bg-[#151a21] px-3 py-2 text-xs">{selected.length_km ? `${Number(selected.length_km).toFixed(3)} km` : sourceLengthKm ? `${sourceLengthKm.toFixed(3)} km` : "Length unavailable"}</div></div>
          <div className="mt-5 grid min-h-[380px] place-items-center overflow-hidden rounded-lg border border-[#29313a] bg-[radial-gradient(ellipse_at_center,rgba(37,49,60,.42),rgba(11,14,18,.9)_70%)] p-3">{layoutLoading ? <div className="text-xs text-[#858d99]">Loading track outline…</div> : layoutError ? <div className="max-w-sm text-center text-xs leading-5 text-[#a2aab5]">{layoutError}</div> : layout ? <svg viewBox="0 0 700 380" role="img" aria-label={`${selected.name} circuit outline`} className="h-full max-h-[500px] w-full"><defs><filter id="trackGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d={layout.path} fill="none" stroke="#7f222b" strokeWidth="13" strokeLinejoin="round" strokeLinecap="round" opacity=".42"/><path d={layout.path} fill="none" stroke="#f04753" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" filter="url(#trackGlow)"/><path d={layout.path} fill="none" stroke="#f2cfd2" strokeWidth=".8" strokeDasharray="2 7" opacity=".75"/><circle cx={layout.start[0]} cy={layout.start[1]} r="7" fill="#f5f6f7" stroke="#e10618" strokeWidth="4"/><text x={Math.min(layout.start[0]+15,560)} y={Math.max(layout.start[1]-12,18)} fill="#d8dde4" fontSize="11" letterSpacing="1.6">START / FINISH</text></svg> : <div className="max-w-sm text-center"><MapPinned size={28} className="mx-auto mb-3 text-[#707a86]"/><div className="text-sm font-medium">No track outline matched</div><p className="mt-2 text-xs leading-5 text-[#858d99]">This circuit is in the race database, but the outline source does not have a matching layout name.</p></div>}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#78818d]"><span>{selected.race_count} imported race{selected.race_count === 1 ? "" : "s"} at this circuit in {season}.</span><span>Track outline data: <a href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer" className="text-[#b8c0ca] underline underline-offset-2 hover:text-white">Tomislav Bacinger’s f1-circuits GeoJSON (MIT) ↗</a></span></div>
          <p className="mt-2 text-[10px] leading-5 text-[#646f7c]">Outlines are third-party reference geometry and may not match every historic circuit variant or current pit-lane layout. They are not telemetry traces.</p>
        </> : <div className="grid min-h-[380px] place-items-center text-sm text-[#858d99]">{loading ? "Loading circuits…" : "No imported circuits for this season."}</div>}</section>
    </div>
  </div></main>;
}
