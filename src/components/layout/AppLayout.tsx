import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { CreateSheet, MobileTabBar } from './MobileTabBar';
import { ShortcutsDialog } from './ShortcutsDialog';
import { OfflineBanner } from './SaveStatus';
import { recordVisit } from './recentItems';
import { DevCityFooter } from '../brand/DevCityFooter';
import { PageSkeleton } from '../ui/Skeleton';
import { lockWorkspace, refreshJoinQueue } from '../../security/session';
import { can, useSession } from '../../security/sessionState';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** "G then <key>" navigation targets. */
const GO_TO: Record<string, string> = {
  o: '/',
  q: '/quotations',
  i: '/invoices',
  r: '/receipts',
  b: '/bills',
  c: '/customers',
  p: '/people',
  s: '/settings',
};

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const workspaceId = useSession((s) => s.workspace?.id);
  const goPending = useRef(0);

  // Editors render full-bleed; everything else gets standard page padding.
  const fullBleed = /\/(new|edit)$/.test(pathname);

  useEffect(() => {
    recordVisit(workspaceId, pathname);
  }, [workspaceId, pathname]);

  // Join requests also arrive live (Realtime); this is a safety net.
  const isAdmin = useSession((s) => s.user?.role === 'admin');
  useEffect(() => {
    if (!isAdmin) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshJoinQueue(true);
    };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [isAdmin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        void lockWorkspace('manual');
        return;
      }
      if (mod || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      // "G then X" navigation (within 1.2 s)
      if (goPending.current && Date.now() - goPending.current < 1200 && GO_TO[key]) {
        e.preventDefault();
        goPending.current = 0;
        navigate(GO_TO[key]);
        return;
      }
      goPending.current = 0;
      if (key === 'g') {
        goPending.current = Date.now();
      } else if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (key === 'n' && (can('documents.create') || can('payments.record'))) {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white lg:bg-slate-50">
        <OfflineBanner />
        <Header onMenuClick={() => setMobileMenuOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main id="main" className="flex-1 overflow-y-auto bg-slate-50">
          <Suspense fallback={<PageSkeleton />}>
            {fullBleed ? (
              <Outlet />
            ) : (
              <div className="pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
                <div key={pathname} className="px-4 py-6 animate-fade-in md:px-8 md:py-8">
                  <Outlet />
                </div>
                <DevCityFooter />
              </div>
            )}
          </Suspense>
        </main>
      </div>
      {!fullBleed && <MobileTabBar onMore={() => setMobileMenuOpen(true)} onCreate={() => setCreateOpen(true)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};
