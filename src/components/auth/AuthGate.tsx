import React from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSession } from '../../security/sessionState';
import { SignInScreen } from '../../pages/auth/SignInScreen';
import { ResetPasswordScreen } from '../../pages/auth/ResetPasswordScreen';
import { OnboardingScreen } from '../../pages/auth/OnboardingScreen';
import { InviteScreen } from '../../pages/auth/InviteScreen';
import { SetupRequiredScreen } from '../../pages/auth/SetupRequiredScreen';
import { IdleWatcher } from './IdleWatcher';
import { LogoMark } from '../brand/Logo';

/**
 * Decides what to show: sign-in, password reset, invitation, onboarding,
 * or the app itself (only when a workspace is open).
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useSession((s) => s.status);
  const { pathname } = useLocation();
  const inviteToken = pathname.match(/^\/invite\/([A-Za-z0-9]{32,128})\/?$/)?.[1];

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
        <LogoMark size={40} />
        <Loader2 className="animate-spin text-slate-300" size={20} />
      </div>
    );
  }
  if (status === 'unconfigured') return <SetupRequiredScreen />;
  if (status === 'recovery') return <ResetPasswordScreen />;
  if (inviteToken) return <InviteScreen key={inviteToken} token={inviteToken} />;
  if (status === 'signedOut') return <SignInScreen />;
  if (status === 'onboarding') return <OnboardingScreen />;

  return (
    <>
      {children}
      <IdleWatcher />
    </>
  );
};
