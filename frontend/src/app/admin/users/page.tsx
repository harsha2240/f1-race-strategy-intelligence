"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, UserPlus, Users } from "lucide-react";
import Link from "next/link";

const API = "";
type User = { user_id: number; email: string; display_name: string; is_active: boolean; roles: string[] };
type Session = { csrf_token: string; roles: string[] };

export default function AdminUsersPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ANALYST");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadUsers() {
    const current = await fetch(`${API}/api/auth/me`, { credentials: "include", cache: "no-store" });
    if (!current.ok) { setError("Sign in with an administrator account to manage users."); setLoading(false); return; }
    const auth = await current.json(); setSession(auth);
    const response = await fetch(`${API}/api/admin/users`, { credentials: "include", cache: "no-store" });
    if (!response.ok) { setError(response.status === 403 ? "Your account does not have user-management permission." : "Could not load users."); setLoading(false); return; }
    setUsers(await response.json()); setError(""); setLoading(false);
  }
  useEffect(() => { loadUsers().catch(() => { setError("Could not reach the API."); setLoading(false); }); }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/api/admin/users`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ email, display_name: name, password, roles: [role] }),
      });
      if (!response.ok) { const body = await response.json(); throw new Error(body.detail ?? "User creation failed."); }
      setEmail(""); setName(""); setPassword(""); await loadUsers();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "User creation failed."); }
    finally { setBusy(false); }
  }

  async function changeRole(user: User, nextRole: string) {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/api/admin/users/${user.user_id}/roles`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrf_token },
        body: JSON.stringify({ roles: [nextRole] }),
      });
      if (!response.ok) { const body = await response.json(); throw new Error(body.detail ?? "Role update failed."); }
      await loadUsers();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Role update failed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0a0c10] px-5 py-8 text-[#f4f5f7] md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#929aa5] hover:text-white"><ArrowLeft size={14}/> Back to overview</Link>
    <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold tracking-[.2em] text-[#ff5461]">ADMINISTRATION</div><h1 className="text-3xl font-semibold tracking-[-.04em]">Users and roles</h1><p className="mt-2 text-sm text-[#858d99]">Account access is checked by the API against database-backed permissions.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/sessions" className="w-fit rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">Manage sessions</Link><Link href="/admin/imports" className="w-fit rounded-md border border-[#393f49] px-3 py-2 text-xs text-[#d7dbe0] hover:border-[#777]">FastF1 import history</Link></div></div>
    {error && <div role="alert" className="mt-5 rounded-md border border-[#694048] bg-[#261519] px-4 py-3 text-sm text-[#ffadb4]">{error}</div>}
    <section className="mt-7 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <form onSubmit={createUser} className="rounded-lg border border-[#252b34] bg-[#11151b] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><UserPlus size={16} className="text-[#e10618]"/> Create account</div>
        <label className="mt-5 block text-xs text-[#c6cbd2]" htmlFor="display-name">Display name</label><input id="display-name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm outline-none focus:border-[#a53b45]"/>
        <label className="mt-4 block text-xs text-[#c6cbd2]" htmlFor="new-email">Email</label><input id="new-email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm outline-none focus:border-[#a53b45]"/>
        <label className="mt-4 block text-xs text-[#c6cbd2]" htmlFor="new-password">Initial password</label><div className="relative mt-2"><LockKeyhole size={14} className="absolute left-3 top-3 text-[#737d89]"/><input id="new-password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] pl-9 pr-3 text-sm outline-none focus:border-[#a53b45]"/></div><div className="mt-1 text-[10px] text-[#737d89]">At least 12 characters. The API stores only an Argon2id hash.</div>
        <label className="mt-4 block text-xs text-[#c6cbd2]" htmlFor="new-role">Role</label><select id="new-role" value={role} onChange={e=>setRole(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#303741] bg-[#0d1015] px-3 text-sm"><option>ANALYST</option><option>ADMIN</option></select>
        <button disabled={busy || !session?.roles.includes("ADMIN")} className="mt-5 h-10 w-full rounded-md bg-[#e10618] text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Create user"}</button>
      </form>
      <section className="overflow-hidden rounded-lg border border-[#252b34] bg-[#11151b]"><div className="flex items-center justify-between border-b border-[#252b34] px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold"><Users size={15} className="text-[#e10618]"/> Accounts</div><span className="text-[10px] text-[#78818d]">{users.length} users</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-[#151a21] text-[10px] tracking-[.1em] text-[#858d99]"><tr><th className="px-4 py-3">USER</th><th className="px-4 py-3">STATUS</th><th className="px-4 py-3">ROLE</th></tr></thead><tbody className="divide-y divide-[#252b34]">{users.map(u=><tr key={u.user_id}><td className="px-4 py-3"><div className="font-medium">{u.display_name}</div><div className="mt-1 text-[10px] text-[#858d99]">{u.email}</div></td><td className="px-4 py-3">{u.is_active ? "Active" : "Disabled"}</td><td className="px-4 py-3"><select aria-label={`Role for ${u.email}`} disabled={busy} value={u.roles.includes("ADMIN") ? "ADMIN" : "ANALYST"} onChange={e=>changeRole(u,e.target.value)} className="rounded border border-[#303741] bg-[#0d1015] px-2 py-1"><option>ANALYST</option><option>ADMIN</option></select></td></tr>)}{!loading && users.length===0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-[#858d99]">No accounts found.</td></tr>}{loading && <tr><td colSpan={3} className="px-4 py-10 text-center text-[#858d99]">Loading accounts…</td></tr>}</tbody></table></div>
      </section>
    </section>
    <p className="mt-4 text-[10px] text-[#66707b]">Role changes are audited. The backend rejects unauthorized requests even if this page is accessed directly.</p>
  </div></main>;
}
