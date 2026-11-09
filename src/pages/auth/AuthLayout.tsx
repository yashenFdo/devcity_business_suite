import React from 'react';
import { FileCheck2, Lock, ShieldCheck, Users } from 'lucide-react';
import { Logo } from '../../components/brand/Logo';

const FEATURES = [
  {
    icon: FileCheck2,
    title: 'Quote → Invoice → Receipt',
    text: 'One continuous workflow, with every document numbered and linked automatically.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    text: 'Every row is protected by server-side access rules, so people only ever see their own workspace.',
  },
  {
    icon: Users,
    title: 'Your whole team, together',
    text: 'Invite colleagues by email or invite code, manage roles and keep an employee directory.',
  },
];

/** A small, purely decorative invoice illustration. */
const PaperIllustration = () => (
  <div className="relative mx-auto w-full max-w-[340px]" aria-hidden="true">
    <div className="absolute -inset-6 rounded-[28px] bg-primary-500/20 blur-3xl" />
    <div className="relative rotate-[-2deg] rounded-xl bg-white p-5 shadow-2xl ring-1 ring-white/10">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-2.5 w-16 rounded bg-slate-900" />
          <div className="h-1.5 w-24 rounded bg-slate-200" />
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-600">Invoice</div>
          <div className="mt-1 font-mono text-[9px] text-slate-400">DEV-INV-2026-014</div>
        </div>
      </div>
      <div className="mt-4 h-px bg-slate-100" />
      <div className="mt-3 space-y-2">
        {[68, 52, 60].map((w, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-1.5 rounded bg-slate-200" style={{ width: `${w}%` }} />
            <div className="h-1.5 w-10 rounded bg-slate-300" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2">
        <span className="text-[10px] font-medium text-primary-700">Amount due</span>
        <span className="font-mono text-xs font-semibold text-primary-700">$24,500.00</span>
      </div>
    </div>
    <div className="absolute -bottom-4 -right-2 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
      <ShieldCheck size={13} /> Secured
    </div>
  </div>
);

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    {/* Brand panel */}
    <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col">
      <div className="bg-grid absolute inset-0 opacity-[0.35]" />
      <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-primary-600/30 blur-[120px]" />
      <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
        <Logo dark />
        <div className="space-y-12">
          <PaperIllustration />
          <div>
            <h2 className="max-w-md text-[28px] font-semibold leading-tight tracking-tight">
              Business documents, engineered with the same care as your software.
            </h2>
            <ul className="mt-8 space-y-5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
                    <f.icon size={17} className="text-primary-300" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{f.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Lock size={13} /> Encrypted in transit and at rest. Every action is recorded in the activity log.
        </p>
      </div>
    </aside>

    {/* Form panel */}
    <main className="flex min-h-screen flex-col px-6 py-8 sm:px-10">
      <div className="lg:hidden">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[400px] animate-slide-up">{children}</div>
      </div>
      <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} DevCity Pvt Ltd · devcity.us</p>
    </main>
  </div>
);
