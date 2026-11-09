import React, { useEffect, useRef, useState } from 'react';
import { Check, Eraser } from 'lucide-react';

const INK = '#0f172a';
const PAD = 12;

/**
 * Draw a signature with mouse, pen or finger. "Use signature" crops the
 * drawing to its ink and hands back a transparent PNG data URL.
 */
export const SignaturePad: React.FC<{ onUse: (dataUrl: string) => void; onCancel?: () => void }> = ({ onUse, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bounds = useRef({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const [hasInk, setHasInk] = useState(false);

  // Match the canvas bitmap to its on-screen size (crisp on high-DPI screens).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const grow = (x: number, y: number) => {
    const b = bounds.current;
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fill();
    grow(p.x, p.y);
    if (!hasInk) setHasInk(true);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    const from = last.current;
    // Thinner strokes when moving fast, like a real pen.
    const speed = Math.hypot(p.x - from.x, p.y - from.y);
    ctx.lineWidth = Math.max(1.4, 2.8 - speed / 18) * (e.pointerType === 'pen' ? 0.5 + e.pressure : 1);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    grow(p.x, p.y);
  };

  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    bounds.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    setHasInk(false);
  };

  const use = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const dpr = canvas.width / canvas.getBoundingClientRect().width || 1;
    const b = bounds.current;
    const sx = Math.max(0, (b.minX - PAD) * dpr);
    const sy = Math.max(0, (b.minY - PAD) * dpr);
    const sw = Math.min(canvas.width - sx, (b.maxX - b.minX + PAD * 2) * dpr);
    const sh = Math.min(canvas.height - sy, (b.maxY - b.minY + PAD * 2) * dpr);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onUse(out.toDataURL('image/png'));
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full cursor-crosshair touch-none"
          aria-label="Signature drawing area. Draw your signature with a mouse, pen or finger."
          role="img"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div className="pointer-events-none absolute inset-x-8 bottom-9 border-b border-dashed border-slate-300" />
        {!hasInk && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-slate-400">Sign above the line</p>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-ghost btn-sm mr-auto" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn-secondary btn-sm" onClick={clear} disabled={!hasInk}>
          <Eraser size={14} /> Clear
        </button>
        <button type="button" className="btn-dark btn-sm" onClick={use} disabled={!hasInk}>
          <Check size={14} /> Use signature
        </button>
      </div>
    </div>
  );
};
