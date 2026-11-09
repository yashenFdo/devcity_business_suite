import type { RefObject } from 'react';
import { useReactToPrint } from 'react-to-print';
import { logAudit } from '../../store/useAuditStore';

const PAGE_STYLE = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/** Print / "Save as PDF" a rendered document at true A4 size. */
export const useDocumentPrint = (contentRef: RefObject<HTMLDivElement | null>, documentTitle: string) =>
  useReactToPrint({
    contentRef,
    documentTitle,
    pageStyle: PAGE_STYLE,
    onAfterPrint: () => logAudit('document', 'Printed / exported PDF', documentTitle),
  });
