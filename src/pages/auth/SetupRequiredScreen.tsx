import React from 'react';
import { Database } from 'lucide-react';
import { AuthLayout } from './AuthLayout';

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">{n}</span>
    <div className="text-[13px] leading-relaxed text-slate-600">{children}</div>
  </li>
);

/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
export const SetupRequiredScreen: React.FC = () => (
  <AuthLayout>
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100">
      <Database size={20} className="text-amber-600" />
    </span>
    <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Connect your database</h1>
    <p className="mt-1.5 text-sm text-slate-500">DevCity stores workspaces in Supabase. Setup takes about five minutes.</p>
    <ol className="mt-7 space-y-4">
      <Step n={1}>
        Create a free project at <b>supabase.com</b>.
      </Step>
      <Step n={2}>
        In <b>SQL Editor</b>, paste and run <code className="font-mono text-xs">supabase/migrations/0001_workspaces.sql</code>.
      </Step>
      <Step n={3}>
        From <b>Project Settings → API</b>, copy the Project URL and the <b>anon</b> public key into <code className="font-mono text-xs">.env.local</code>:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {'VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...'}
        </pre>
      </Step>
      <Step n={4}>
        Restart <code className="font-mono text-xs">npm run dev</code>. See <b>README.md</b> for Google sign-in.
      </Step>
    </ol>
  </AuthLayout>
);
