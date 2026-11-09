import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Fingerprint, Loader2, Mail, MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { PasswordInput, PasswordStrength } from '../../components/ui/PasswordField';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { assessPassword } from '../../security/passwordPolicy';
import { getLastEmail, sendPasswordReset, signInWithEmail, signUpWithEmail } from '../../security/session';
import { conditionalUiAvailable, passkeysSupported, signInWithPasskey } from '../../cloud/passkeys';

type Mode = 'signin' | 'signup' | 'forgot';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ErrorBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
    {children}
  </div>
);

/** Sign in, create an account, or reset a password. `context` explains why (e.g. accepting an invite). */
export const SignInScreen: React.FC<{ initialMode?: Mode; context?: React.ReactNode }> = ({ initialMode = 'signin', context }) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(getLastEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<{ kind: 'confirm' | 'reset'; email: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const conditional = useRef<AbortController | null>(null);

  // Offer saved passkeys in the email field's autofill (WebAuthn Conditional UI).
  useEffect(() => {
    if (mode !== 'signin') return;
    const controller = new AbortController();
    conditional.current = controller;
    void conditionalUiAvailable().then(async (available) => {
      if (!available || controller.signal.aborted) return;
      const r = await signInWithPasskey(controller.signal, true);
      if (r.ok === false && r.error && !controller.signal.aborted) setError(r.error);
    });
    return () => controller.abort();
  }, [mode]);

  const passkeySignIn = async () => {
    conditional.current?.abort(); // only one WebAuthn request at a time
    setPasskeyBusy(true);
    setError('');
    const r = await signInWithPasskey();
    setPasskeyBusy(false);
    if (r.ok === false && r.error) setError(r.error);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setTouched(false);
    setPassword('');
  };

  const strength = assessPassword(password, [name, email]);
  const emailValid = EMAIL_RE.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!emailValid) return setError('Enter a valid email address.');
    if (mode === 'signup' && (!name.trim() || !strength.valid)) return;
    if (mode === 'signin' && !password) return setError('Enter your password.');
    setBusy(true);
    if (mode === 'forgot') {
      const r = await sendPasswordReset(email);
      setBusy(false);
      if (r.ok === false) return setError(r.error);
      setSentTo({ kind: 'reset', email: email.trim() });
      return;
    }
    const r = mode === 'signin' ? await signInWithEmail(email, password) : await signUpWithEmail(name, email, password);
    setBusy(false);
    if (r.ok === false) {
      setError(r.error);
      return;
    }
    if (r.message) setSentTo({ kind: 'confirm', email: email.trim() });
    // Otherwise the session listener takes over and opens the workspace.
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
          <MailCheck size={22} className="text-emerald-600" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {sentTo.kind === 'confirm' ? 'We sent a confirmation link to ' : 'We sent a password reset link to '}
          <span className="font-medium text-slate-800">{sentTo.email}</span>.{' '}
          {sentTo.kind === 'confirm' ? 'Open it to activate your account.' : 'Open it to choose a new password.'} The link
          opens this app.
        </p>
        <p className="mt-4 text-xs text-slate-400">Didn't get it? Check spam, or wait a minute and try again.</p>
        <button
          type="button"
          className="btn-secondary mt-8 w-full"
          onClick={() => {
            setSentTo(null);
            switchMode('signin');
          }}
        >
          <ArrowLeft size={15} /> Back to sign in
        </button>
      </AuthLayout>
    );
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ['Welcome back', 'Sign in to your DevCity workspace.'],
    signup: ['Create your account', 'Start a workspace for your company, or join your team.'],
    forgot: ['Reset your password', "Enter your email and we'll send you a reset link."],
  };

  return (
    <AuthLayout>
      {mode === 'forgot' && (
        <button type="button" onClick={() => switchMode('signin')} className="btn-ghost btn-sm -ml-2.5 mb-6">
          <ArrowLeft size={15} /> Back to sign in
        </button>
      )}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titles[mode][0]}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{titles[mode][1]}</p>
      </div>

      {context && <div className="mb-6">{context}</div>}

      {mode !== 'forgot' && (
        <>
          <GoogleButton label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'} />
          {mode === 'signin' && passkeysSupported() && (
            <button
              type="button"
              onClick={passkeySignIn}
              disabled={passkeyBusy}
              className="mt-2.5 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:bg-slate-50 focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
            >
              {passkeyBusy ? <Loader2 size={18} className="animate-spin text-slate-500" /> : <Fingerprint size={18} className="text-primary-600" />}
              Sign in with a passkey
            </button>
          )}
          <OrDivider label={mode === 'signup' ? 'or sign up with email' : 'or sign in with email'} />
        </>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === 'signup' && (
          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input
              id="name"
              className={`input h-10 ${touched && !name.trim() ? 'input-error' : ''}`}
              autoComplete="name"
              placeholder="Jane Perera"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {touched && !name.trim() && <p className="mt-1.5 text-xs font-medium text-rose-600">Enter your name.</p>}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">
            Work email
          </label>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete={mode === 'signup' ? 'email' : mode === 'signin' ? 'username webauthn' : 'username'}
              className={`input h-10 pl-9 ${touched && !emailValid ? 'input-error' : ''}`}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div>
            {mode === 'signin' ? (
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-slate-700">
                  Password
                </label>
                <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  Forgot password?
                </button>
              </div>
            ) : (
              <label htmlFor="password" className="label">
                Password
              </label>
            )}
            <PasswordInput
              id="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={mode === 'signup' && touched && !strength.valid ? 'Choose a stronger password.' : ''}
            />
            {mode === 'signup' && <PasswordStrength password={password} personal={[name, email]} />}
          </div>
        )}

        {error && <ErrorBox>{error}</ErrorBox>}

        <button type="submit" className="btn-primary btn-lg w-full" disabled={busy}>
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : mode === 'signin' ? (
            <>
              Sign in <ArrowRight size={16} />
            </>
          ) : mode === 'signup' ? (
            'Create account'
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

      {mode !== 'forgot' && (
        <p className="mt-6 text-center text-[13px] text-slate-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="font-medium text-primary-600 hover:text-primary-700"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      )}
    </AuthLayout>
  );
};
