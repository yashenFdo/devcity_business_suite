import React, { Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { lockWorkspace } from '../../security/session';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();

  // Editors render full-bleed; everything else gets standard page padding.
  const fullBleed = /\/(new|edit)$/.test(pathname);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        void lockWorkspace('manual');
      } else if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white lg:bg-slate-50">
        <Header onMenuClick={() => setMobileMenuOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main id="main" className="flex-1 overflow-y-auto bg-slate-50">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <Loader2 size={22} className="animate-spin text-slate-300" />
              </div>
            }
          >
          {fullBleed ? (
            <Outlet />
          ) : (
            <div key={pathname} className="px-4 py-6 animate-fade-in md:px-8 md:py-8">
              <Outlet />
            </div>
          )}
          </Suspense>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};
