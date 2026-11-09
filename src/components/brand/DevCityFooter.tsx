import React from 'react';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from './Logo';
import { DEVCITY, telHref } from './devcityContact';

/** Full product footer: shown at the bottom of every page in the app. */
export const DevCityFooter: React.FC = () => (
  <footer className="no-print mt-16 border-t border-slate-200/80 bg-white">
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr_1fr] md:px-8">
      <div>
        <Logo height={22} />
        <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-slate-500">
          Quotations, invoices, receipts and team workspaces, built for software engineering companies.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contact</p>
        <ul className="mt-3 space-y-2 text-[13px] text-slate-600">
          <li>
            <a href={`mailto:${DEVCITY.email}`} className="inline-flex items-center gap-2 font-medium text-slate-900 hover:text-primary-700">
              <Mail size={14} className="text-slate-400" /> {DEVCITY.email}
            </a>
          </li>
          <li className="flex items-start gap-2">
            <Phone size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <span>
              {DEVCITY.phones.map((p, i) => (
                <React.Fragment key={p}>
                  {i > 0 && <span className="text-slate-300"> · </span>}
                  <a href={telHref(p)} className="hover:text-primary-700">
                    {p}
                  </a>
                </React.Fragment>
              ))}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-400" /> {DEVCITY.address}
          </li>
        </ul>
      </div>

      <div className="md:text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Developed by</p>
        <a
          href={DEVCITY.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-slate-900 hover:text-primary-700"
        >
          {DEVCITY.websiteLabel} <ArrowUpRight size={15} />
        </a>
        <p className="mt-1 text-[13px] text-slate-500">Custom software engineering &amp; dedicated developer squads</p>
      </div>
    </div>
    <div className="border-t border-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:justify-between md:px-8">
        <span>© {new Date().getFullYear()} {DEVCITY.company}. All rights reserved.</span>
        <span>
          DevCity Business Suite · Developed by{' '}
          <a href={DEVCITY.website} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-500 hover:text-primary-700">
            {DEVCITY.websiteLabel}
          </a>
        </span>
      </div>
    </div>
  </footer>
);

/** One-line footer for sign-in, onboarding and shared-document pages. */
export const DevCityFooterCompact: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <p className={`text-center text-xs leading-relaxed ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
    © {new Date().getFullYear()} {DEVCITY.company} · Developed by{' '}
    <a href={DEVCITY.website} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary-600">
      {DEVCITY.websiteLabel}
    </a>
    <br />
    <a href={`mailto:${DEVCITY.email}`} className="hover:text-primary-600">
      {DEVCITY.email}
    </a>{' '}
    · {DEVCITY.phones.join(' · ')}
  </p>
);
