"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";

const API = "";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch(`${API}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name, email, password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail ?? "Could not create account.");
      window.location.assign("/login?created=1");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reach the API."); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen bg-[#0a0c10] lg:grid-cols-[1.1fr_.9fr]">
    <section className="hidden border-r border-[#252b34] bg-[#10141a] p-12 lg:flex lg:flex-col lg:justify-between xl:p-20"><Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e10618] text-xs font-black">RI</div><span className="text-xs font-bold tracking-[.18em]">RACE INTELLIGENCE</span></Link><div className="max-w-xl"><div className="mb-4 text-[10px] font-bold tracking-[.22em] text-[#ff6873]">RACE DATA WORKSPACE</div><h1 className="text-5xl font-semibold leading-[1.05] tracking-[-.05em]">Explore the race<br/>from the data.</h1><p className="mt-5 max-w-md text-sm leading-6 text-[#9099a5]">Create a free analyst account to save hypothetical strategy estimates and use the analysis tools.</p></div><div className="text-[10px] tracking-[.12em] text-[#737d89]">LOCAL ANALYTICS WORKSPACE</div></section>
    <section className="flex items-center justify-center px-6 py-12"><form onSubmit={submit} className="w-full max-w-[380px]"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#ff6873]"><UserPlus size={14}/> CREATE ACCOUNT</div><h2 className="text-3xl font-semibold tracking-[-.04em]">Join the workspace</h2><p className="mt-2 text-sm text-[#858d99]">New accounts receive the Analyst role.</p>
      <label className="mt-7 block text-xs font-medium text-[#c6cbd2]" htmlFor="name">Your name</label><input id="name" autoComplete="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#303741] bg-[#11151b] px-3 text-sm outline-none focus:border-[#a53b45]" placeholder="Sreeharsha"/>
      <label className="mt-5 block text-xs font-medium text-[#c6cbd2]" htmlFor="email">Email address</label><input id="email" autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#303741] bg-[#11151b] px-3 text-sm outline-none focus:border-[#a53b45]" placeholder="you@example.com"/>
      <label className="mt-5 block text-xs font-medium text-[#c6cbd2]" htmlFor="password">Password</label><input id="password" autoComplete="new-password" type="password" required minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#303741] bg-[#11151b] px-3 text-sm outline-none focus:border-[#a53b45]" placeholder="At least 12 characters"/>
      {error && <p role="alert" className="mt-4 rounded-md border border-[#694048] bg-[#261519] px-3 py-2 text-xs text-[#ffadb4]">{error}</p>}
      <button type="submit" disabled={busy} className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#e10618] text-sm font-semibold text-white transition hover:bg-[#c90012] disabled:opacity-60">{busy ? "Creating account…" : "Create analyst account"}<ArrowRight size={15}/></button>
      <p className="mt-5 text-center text-xs text-[#737d89]">Already have an account? <Link href="/login" className="font-semibold text-[#ff7b84] hover:underline">Sign in</Link></p>
    </form></section>
  </main>;
}
