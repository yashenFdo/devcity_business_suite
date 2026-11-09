import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, Download, FileX2, Loader2, Printer, ShieldCheck, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { DocumentPreviewRenderer } from '../../components/documents/DocumentPreviewRenderer';
import { useDocumentPrint } from '../../components/documents/useDocumentPrint';
import { DevCityFooterCompact } from '../../components/brand/DevCityFooter';
import { LogoMark } from '../../components/brand/Logo';
import { openSharedDocument, type SharedDocumentResult } from '../../cloud/sharing';
import { formatCurrency, formatDate } from '../../utils/formatters';

const TYPE_LABEL = { quotation: 'Quotation', invoice: 'Invoice', bill: 'Bill', receipt: 'Receipt' } as const;

/** Only render logos we know are images (data URLs or https). */
const safeImage = (src?: string) => (src && /^(data:image\/(png|jpe?g|gif|webp|svg\+xml);|https:\/\/)/i.test(src) ? src : undefined);

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; result: SharedDocumentResult };

/** Public, read-only view of a shared document: /d/:token (works signed in or out). */
export const SharedDocumentPage: React.FC<{ token: string }> = ({ token }) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    openSharedDocument(token)
      .then((result) => {
        if (alive) setState({ kind: 'done', result });
      })
      .catch((e: Error) => {
        if (alive) setState({ kind: 'error', message: e.message });
      });
    return () => {
      alive = false;
    };
  }, [token, attempt]);

  // Keep shared documents out of search engines.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const result = state.kind === 'done' ? state.result : null;
  const title =
    result && result.status !== 'notFound'
      ? `${result.status === 'active' ? TYPE_LABEL[result.snapshot.documentType] + ' ' : ''}${result.documentNumber}${result.workspaceName ? ` · ${result.workspaceName}` : ''}`
      : 'Shared document';
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  if (state.kind === 'loading') {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-slate-400" role="status">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-sm">Opening document…</span>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <Notice
          icon={AlertTriangle}
          tone="rose"
          title="We couldn't open this document"
          message={state.message}
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setState({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          }
        />
      </Shell>
    );
  }

  const r = state.result;
  if (r.status === 'notFound') {
    return (
      <Shell>
        <Notice
          icon={FileX2}
          tone="slate"
          title="Document not found"
          message="This link is not valid. Check that you copied the whole link, or ask the sender for a new one."
        />
      </Shell>
    );
  }
  if (r.status === 'expired') {
    return (
      <Shell>
        <Notice
          icon={Clock}
          tone="amber"
          title="This link has expired"
          message={`The link to ${r.documentNumber}${r.workspaceName ? ` from ${r.workspaceName}` : ''} expired${
            r.expiresAt ? ` on ${formatDate(r.expiresAt)}` : ''
          }. Please ask the sender for a new link.`}
        />
      </Shell>
    );
  }
  if (r.status === 'revoked') {
    return (
      <Shell>
        <Notice
          icon={Ban}
          tone="slate"
          title="This link is no longer available"
          message={`${r.workspaceName || 'The sender'} has withdrawn access to ${r.documentNumber}. Please contact them if you still need it.`}
        />
      </Shell>
    );
  }

  return <SharedDocumentView result={r} />;
};

const SharedDocumentView: React.FC<{ result: Extract<SharedDocumentResult, { status: 'active' }> }> = ({ result }) => {
  const { snapshot } = result;
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useDocumentPrint(printRef, snapshot.number);
  const company = snapshot.company.name || result.workspaceName;
  const logo = safeImage(snapshot.company.logo);
  const typeLabel = TYPE_LABEL[snapshot.documentType];
  const amount = snapshot.documentType === 'receipt' ? (snapshot.amountPaid ?? snapshot.total) : snapshot.total;

  const print = () => {
    try {
      handlePrint();
    } catch {
      toast.error('Printing is not available in this browser.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100/80">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          {logo ? (
            <img src={logo} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg bg-white object-contain ring-1 ring-slate-200" />
          ) : (
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: snapshot.company.brandColor || '#0f172a' }}
              aria-hidden="true"
            >
              {(company || 'D').trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">{company}</p>
            <p className="truncate text-xs text-slate-500">
              {typeLabel} <span className="font-mono">{snapshot.number}</span>
              <span className="hidden sm:inline"> · {formatCurrency(amount, snapshot.currencySymbol)}</span>
            </p>
          </div>
          <button type="button" className="btn-secondary hidden sm:inline-flex" onClick={print}>
            <Printer size={15} /> Print
          </button>
          <button type="button" className="btn-primary" onClick={print} aria-label="Download PDF">
            <Download size={15} aria-hidden="true" />
            <span className="sm:hidden">PDF</span>
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-2 py-5 sm:px-6 sm:py-8">
        <DocumentPreviewRenderer ref={printRef} data={snapshot} templateId={snapshot.templateId} gutter={16} />
        <p className="no-print mx-auto mt-4 max-w-md text-center text-xs text-slate-500">
          {result.expiresAt ? `This link is available until ${formatDate(result.expiresAt)}.` : 'Tap Download PDF and choose "Save as PDF" to keep a copy.'}
        </p>
      </main>

      <SharedFooter />
    </div>
  );
};

const SharedFooter: React.FC = () => (
  <footer className="no-print border-t border-slate-200/80 bg-white px-4 py-6">
    <p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
      <ShieldCheck size={13} className="text-emerald-600" /> Shared securely via DevCity Business Suite
    </p>
    <DevCityFooterCompact />
  </footer>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-slate-50">
    <header className="border-b border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-3 sm:px-6">
        <LogoMark size={28} />
        <span className="text-[13px] font-semibold text-slate-900">Shared document</span>
      </div>
    </header>
    <main className="flex flex-1 flex-col px-4">{children}</main>
    <SharedFooter />
  </div>
);

const TONES = {
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  slate: 'bg-slate-100 text-slate-500 ring-slate-200',
};

const Notice: React.FC<{
  icon: React.ElementType;
  tone: keyof typeof TONES;
  title: string;
  message: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, tone, title, message, action }) => (
  <div className="flex flex-1 items-center justify-center py-16">
    <div className="card w-full max-w-md px-6 py-10 text-center sm:px-10">
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${TONES[tone]}`}>
        <Icon size={22} />
      </span>
      <h1 className="mt-5 text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  </div>
);
