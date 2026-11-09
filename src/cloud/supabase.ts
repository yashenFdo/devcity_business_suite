import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = () => /^https:\/\/.+/.test(url) && anonKey.length > 20;

/**
 * The public "anon" key is designed to be shipped to browsers: every table
 * is protected by Row Level Security (see supabase/migrations).
 */
export const supabase: SupabaseClient = createClient(url || 'https://not-configured.supabase.co', anonKey || 'not-configured', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'devcity-auth',
  },
});

/** Turn Supabase / Postgres errors into short, human messages. */
export const friendlyError = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message ?? '';
  if (!msg) return fallback;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Can't reach the server. Check your internet connection.";
  if (/Invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/User already registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (/row-level security|permission denied/i.test(msg) || e?.code === '42501') {
    return msg.startsWith('Only') || msg.includes('not found') ? msg : "You don't have permission to do that.";
  }
  if (/JWT|token is expired/i.test(msg)) return 'Your session expired. Please sign in again.';
  return msg.length < 160 ? msg : fallback;
};
