import React from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSession } from '../../security/sessionState';
import { SignInScreen } from '../../pages/auth/SignInScreen';
import { ResetPasswordScreen } from '../../pages/auth/ResetPasswordScreen';
import { OnboardingScreen } from '../../pages/auth/OnboardingScreen';
import { InviteScreen } from '../../pages/auth/InviteScreen';
import { SetupRequiredScreen } from '../../pages/auth/SetupRequiredScreen';
import { SharedDocumentPage } from '../../pages/share/SharedDocumentPage';
import { SHARE_PATH } from '../../cloud/sharing';
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
  const shareToken = pathname.match(SHARE_PATH)?.[1];

  // Public shared-document links work for everyone, signed in or not.
  if (shareToken) return <SharedDocumentPage key={shareToken} token={shareToken} />;

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
