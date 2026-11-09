import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from './AuthLayout';
import { PasswordInput, PasswordStrength } from '../../components/ui/PasswordField';
import { assessPassword } from '../../security/passwordPolicy';
import { finishRecovery, updatePassword } from '../../security/session';

/** Shown after opening a password-reset email link. */
export const ResetPasswordScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = assessPassword(password).valid && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const r = await updatePassword(password);
    if (r.ok === false) {
      setBusy(false);
      setError(r.error);
      return;
    }
    toast.success('Password updated');
    await finishRecovery();
  };

  return (
    <AuthLayout>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100">
        <KeyRound size={20} className="text-primary-600" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-slate-500">You'll use it to sign in from now on.</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div>
          <PasswordInput label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordStrength password={password} />
        </div>
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && confirm !== password ? "Passwords don't match." : error}
        />
        <button type="submit" className="btn-primary btn-lg w-full" disabled={!valid || busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Save password & continue
        </button>
      </form>
    </AuthLayout>
  );
};
