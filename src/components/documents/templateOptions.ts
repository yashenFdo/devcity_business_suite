import type { TemplateId } from '../../types';

export const TEMPLATE_OPTIONS: { id: TemplateId; name: string; description: string }[] = [
  { id: 'executive', name: 'Executive', description: 'Clean, modern and brand-coloured. Recommended.' },
  { id: 'modern-minimal', name: 'Minimal', description: 'Light, airy and typographic.' },
  { id: 'corporate-pro', name: 'Corporate', description: 'Structured, with bold section headers.' },
  { id: 'tech-modern', name: 'Technical', description: 'Monospace accents for engineering work.' },
  { id: 'elegant-business', name: 'Elegant', description: 'Classic serif styling.' },
];

export const DEFAULT_TEMPLATE: TemplateId = 'executive';

export const templateName = (id?: TemplateId) => TEMPLATE_OPTIONS.find((t) => t.id === id)?.name ?? 'Executive';
