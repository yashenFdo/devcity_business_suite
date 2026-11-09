import React from 'react';
import { Modal } from '../ui/Modal';

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'Anywhere',
    items: [
      [[MOD, 'K'], 'Search or jump to anything'],
      [['/'], 'Open search'],
      [['N'], 'Create a new document'],
      [['?'], 'Show keyboard shortcuts'],
      [[MOD, 'Shift', 'L'], 'Sign out'],
    ],
  },
  {
    title: 'Go to (press G, then…)',
    items: [
      [['G', 'O'], 'Overview'],
      [['G', 'Q'], 'Quotations'],
      [['G', 'I'], 'Invoices'],
      [['G', 'R'], 'Receipts'],
      [['G', 'B'], 'Vendor bills'],
      [['G', 'C'], 'Clients'],
      [['G', 'P'], 'People'],
      [['G', 'S'], 'Settings'],
    ],
  },
  {
    title: 'While editing a document',
    items: [
      [[MOD, 'S'], 'Save'],
      [['Esc'], 'Close dialogs and menus'],
    ],
  },
];

export const ShortcutsDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal isOpen={open} onClose={onClose} title="Keyboard shortcuts" description="Move faster without the mouse." size="lg">
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {GROUPS.map((g) => (
        <section key={g.title} className={g.title.startsWith('Go to') ? 'sm:row-span-2' : ''}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</h3>
          <ul className="space-y-1.5">
            {g.items.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between gap-4 text-[13px] text-slate-700">
                <span>{label}</span>
                <span className="flex flex-shrink-0 items-center gap-1">
                  {keys.map((k, i) => (
                    <React.Fragment key={k + i}>
                      {g.title.startsWith('Go to') && i > 0 && <span className="text-[10px] text-slate-400">then</span>}
                      <kbd className="kbd min-w-[22px]">{k}</kbd>
                    </React.Fragment>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </Modal>
);
