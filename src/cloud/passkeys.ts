// ============================================================
// Passkeys (WebAuthn) via Supabase Auth.
// Sign in with Windows Hello, Touch ID, Face ID, a phone or a security key.
// The private key never leaves the user's device.
// ============================================================
import { friendlyError, supabase } from './supabase';
import { logAudit } from '../store/useAuditStore';

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export const passkeysSupported = () =>
  typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

/** Can the browser offer passkeys in the email field's autofill? */
export const conditionalUiAvailable = async () => {
  try {
    return passkeysSupported() && !!(await PublicKeyCredential.isConditionalMediationAvailable?.());
  } catch {
    return false;
  }
};

type MaybeWebAuthnError = { name?: string; code?: string; message?: string; cause?: { name?: string } } | null;

/** null = the user simply cancelled (show nothing). */
export const passkeyError = (err: unknown): string | null => {
  const e = err as MaybeWebAuthnError;
  const browserName = e?.cause?.name ?? e?.name;
  if (e?.code === 'ERROR_CEREMONY_ABORTED' || browserName === 'AbortError') return null;
  if (browserName === 'NotAllowedError') return null; // dismissed or timed out
  if (e?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || browserName === 'InvalidStateError') {
    return 'This device already has a passkey for your account.';
  }
  if (e?.code === 'ERROR_INVALID_DOMAIN' || e?.code === 'ERROR_INVALID_RP_ID' || browserName === 'SecurityError') {
    return "Passkeys aren't set up for this web address yet. Check the Passkeys settings in Supabase (RP ID and origins).";
  }
  if (/challenge_expired/i.test(e?.message ?? '')) return 'The passkey request expired. Please try again.';
  if (/passkey|credential/i.test(e?.message ?? '') && /not found|unknown/i.test(e?.message ?? '')) {
    return 'That passkey is no longer linked to an account. Sign in another way and add it again.';
  }
  return friendlyError(err, 'Passkey sign-in failed. Please try again.');
};

/** A friendly default name such as "Windows · Edge". */
const deviceLabel = () => {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Mac/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : 'This device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return browser ? `${os} · ${browser}` : os;
};

export type PasskeyResult = { ok: true } | { ok: false; error: string | null };

export const signInWithPasskey = async (signal?: AbortSignal, conditional = false): Promise<PasskeyResult> => {
  try {
    const { error } = await supabase.auth.signInWithPasskey({
      options: { signal, ...(conditional ? { mediation: 'conditional' as CredentialMediationRequirement } : {}) },
    });
    return error ? { ok: false, error: passkeyError(error) } : { ok: true };
  } catch (err) {
    return { ok: false, error: passkeyError(err) };
  }
};

export const listPasskeys = async (): Promise<Passkey[]> => {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) throw new Error(friendlyError(error, 'Could not load your passkeys.'));
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.friendly_name || 'Passkey',
    createdAt: p.created_at,
    lastUsedAt: p.last_used_at,
  }));
};

export const addPasskey = async (): Promise<PasskeyResult> => {
  try {
    const { data, error } = await supabase.auth.registerPasskey();
    if (error) return { ok: false, error: passkeyError(error) };
    if (data?.id) await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceLabel() });
    logAudit('security', 'Added a passkey');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: passkeyError(err) };
  }
};

export const renamePasskey = async (id: string, name: string) => {
  const { error } = await supabase.auth.passkey.update({ passkeyId: id, friendlyName: name.trim().slice(0, 120) });
  if (error) throw new Error(friendlyError(error));
};

export const deletePasskey = async (id: string) => {
  const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
  if (error) throw new Error(friendlyError(error));
  logAudit('security', 'Removed a passkey');
};
