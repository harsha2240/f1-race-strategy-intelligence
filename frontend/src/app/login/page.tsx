"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, RadioTower } from "lucide-react";

const API = "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "Sign-in failed. Check your credentials.");
      }
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reach the API.");
    } finally { setBusy(false); }
  }

  return <main className="grid min-h-screen bg-[#0a0c10] lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden border-r border-[#252b34] bg-[#10141a] p-12 lg:flex lg:flex-col lg:justify-between xl:p-20">
      <div className="absolute -right-36 -top-24 h-[600px] w-[600px] rounded-full border border-[#34303a] opacity-40"/><div className="absolute -right-12 -top-0 h-[440px] w-[440px] rounded-full border border-[#3b252c] opacity-60"/>
      <div className="relative flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e10618] text-xs font-black text-white">RI</div><div className="text-xs font-bold tracking-[.18em]">RACE INTELLIGENCE</div></div>
      <div className="relative max-w-xl"><div className="mb-4 text-[10px] font-bold tracking-[.22em] text-[#ff6873]">STRATEGY & PERFORMANCE</div><h1 className="text-5xl font-semibold leading-[1.05] tracking-[-.05em]">Find the edge<br/>in every lap.</h1><p className="mt-5 max-w-md text-sm leading-6 text-[#9099a5]">Analyze race pace, pit windows and tyre decisions through a data-first lens.</p></div>
      <div className="relative flex items-center gap-2 text-[10px] tracking-[.12em] text-[#737d89]"><RadioTower size={14} className="text-[#e10618]"/> LOCAL ANALYTICS WORKSPACE</div>
    </section>
    <section className="flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e10618] text-xs font-black">RI</div><span className="text-xs font-bold tracking-[.17em]">RACE INTELLIGENCE</span></div>
        <div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff6873]">WELCOME BACK</div><h2 className="text-3xl font-semibold tracking-[-.04em]">Sign in to workspace</h2><p className="mt-2 text-sm text-[#858d99]">Use your project account to continue.</p>
        <label className="mt-8 block text-xs font-medium text-[#c6cbd2]" htmlFor="email">Email address</label><input id="email" autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#303741] bg-[#11151b] px-3 text-sm outline-none focus:border-[#a53b45]" placeholder="you@example.com"/>
        <label className="mt-5 block text-xs font-medium text-[#c6cbd2]" htmlFor="password">Password</label><div className="relative mt-2"><LockKeyhole size={15} className="absolute left-3 top-3.5 text-[#737d89]"/><input id="password" autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="h-11 w-full rounded-md border border-[#303741] bg-[#11151b] pl-9 pr-3 text-sm outline-none focus:border-[#a53b45]" placeholder="Your password"/></div>
        {error && <p role="alert" className="mt-4 rounded-md border border-[#694048] bg-[#261519] px-3 py-2 text-xs text-[#ffadb4]">{error}</p>}
        <button type="submit" disabled={busy} className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#e10618] text-sm font-semibold text-white transition hover:bg-[#c90012] disabled:cursor-wait disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}<ArrowRight size={15}/></button>
        <p className="mt-5 text-center text-[11px] text-[#a0a8b2]">New to Race Intelligence? <Link href="/register" className="font-semibold text-[#ff7b84] hover:underline">Create an analyst account</Link></p>
        <p className="mt-3 text-center text-[10px] leading-5 text-[#737d89]">Your password is securely hashed by the API and never stored in the browser.</p>
      </form>
    </section>
  </main>;
}
