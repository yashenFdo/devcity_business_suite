import toast from 'react-hot-toast';
import { RotateCcw, Trash2 } from 'lucide-react';

/** "Deleted · Undo" toast. `onUndo` restores the item. */
export const showUndoToast = (message: string, onUndo: () => void) =>
  toast(
    (t) => (
      <span className="flex items-center gap-3 text-[13px]">
        <Trash2 size={15} className="flex-shrink-0 text-slate-400" />
        <span className="flex-1">{message}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-primary-600 hover:bg-primary-50"
          onClick={() => {
            toast.dismiss(t.id);
            onUndo();
          }}
        >
          <RotateCcw size={13} /> Undo
        </button>
      </span>
    ),
    { duration: 7000 }
  );
