import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { DocumentData } from './documentTypes';
import { ExecutiveTemplate } from './templates/ExecutiveTemplate';
import { ModernMinimalTemplate } from './templates/ModernMinimalTemplate';
import { CorporateProTemplate } from './templates/CorporateProTemplate';
import { ElegantBusinessTemplate } from './templates/ElegantBusinessTemplate';
import { TechModernTemplate } from './templates/TechModernTemplate';
import type { TemplateId } from '../../types';
import { DEFAULT_TEMPLATE } from './templateOptions';

const PAPER_WIDTH = 794; // A4 @ 96dpi
const PAPER_HEIGHT = 1123;

interface Props {
  data: DocumentData;
  templateId?: TemplateId;
  /** A fixed zoom factor, or 'fit' to fill the available width (never above 100%). */
  scale?: number | 'fit';
  /** Horizontal breathing room (px) when fitting. */
  gutter?: number;
}

/**
 * Renders a document on an A4 "sheet". The forwarded ref points at the
 * unscaled paper, which is what gets printed / saved as PDF.
 */
export const DocumentPreviewRenderer = forwardRef<HTMLDivElement, Props>(
  ({ data, templateId, scale = 'fit', gutter = 48 }, ref) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const paperRef = useRef<HTMLDivElement | null>(null);
    const [fit, setFit] = useState(1);
    const [height, setHeight] = useState(PAPER_HEIGHT);

    const setPaperRef = useCallback(
      (node: HTMLDivElement | null) => {
        paperRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    useLayoutEffect(() => {
      const outer = outerRef.current;
      const paper = paperRef.current;
      if (!outer || !paper) return;
      const ro = new ResizeObserver(() => {
        setFit(Math.min(1, Math.max(0.3, (outer.clientWidth - gutter) / PAPER_WIDTH)));
        setHeight(paper.offsetHeight || PAPER_HEIGHT);
      });
      ro.observe(outer);
      ro.observe(paper);
      return () => ro.disconnect();
    }, [gutter]);

    const s = scale === 'fit' ? fit : scale;
    const active = templateId || data.templateId || DEFAULT_TEMPLATE;

    return (
      <div ref={outerRef} className="w-full">
        <div className="mx-auto" style={{ width: PAPER_WIDTH * s, height: height * s }}>
          <div
            className="origin-top-left overflow-hidden rounded-[3px] bg-white shadow-paper ring-1 ring-slate-900/5 transition-transform duration-150"
            style={{ width: PAPER_WIDTH, transform: `scale(${s})` }}
          >
            <div ref={setPaperRef} className="bg-white" style={{ width: PAPER_WIDTH, minHeight: PAPER_HEIGHT }}>
              {active === 'executive' && <ExecutiveTemplate data={data} />}
              {active === 'modern-minimal' && <ModernMinimalTemplate data={data} />}
              {active === 'corporate-pro' && <CorporateProTemplate data={data} />}
              {active === 'elegant-business' && <ElegantBusinessTemplate data={data} />}
              {active === 'tech-modern' && <TechModernTemplate data={data} />}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DocumentPreviewRenderer.displayName = 'DocumentPreviewRenderer';
