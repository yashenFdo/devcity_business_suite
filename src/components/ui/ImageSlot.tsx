import React, { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ALLOWED_IMAGE_TYPES, readImage } from '../../utils/readImage';

/** Click-or-drop image upload with a checkerboard preview (validated PNG/JPG/WebP ≤ 512 KB). */
export const ImageSlot: React.FC<{
  label: string;
  hint: string;
  icon: React.ElementType;
  value?: string;
  onChange: (v: string | undefined) => void;
  /** Hide the visible label (when the surrounding UI already names the slot). */
  hideLabel?: boolean;
}> = ({ label, hint, icon: Icon, value, onChange, hideLabel }) => {
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await readImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  };
  return (
    <div>
      {!hideLabel && <p className="label">{label}</p>}
      <input
        ref={input}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="hidden"
        aria-label={label}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
          <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] p-2 ring-1 ring-slate-200">
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex-1" />
          <button type="button" className="btn-sm btn-secondary" onClick={() => input.current?.click()}>
            Replace
          </button>
          <button
            type="button"
            className="btn-icon btn-ghost hover:bg-rose-50 hover:text-rose-600"
            onClick={() => onChange(undefined)}
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center transition-colors hover:border-primary-300 hover:bg-primary-50/30"
        >
          <Icon size={22} className="text-slate-400" />
          <span className="text-[13px] font-medium text-slate-700">Click or drop an image</span>
          <span className="text-xs text-slate-500">{hint}</span>
        </button>
      )}
    </div>
  );
};
