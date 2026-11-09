import React, { useId } from 'react';
import type { Stamp } from '../../../types';
import { formatDate } from '../../../utils/formatters';
import { STAMP_INK, type StampInk } from './stampInk';


interface StampSVGProps {
  stamp: Pick<Stamp, 'shape' | 'title' | 'subtitle' | 'lines' | 'showDate'>;
  ink: StampInk;
  date?: string;
  /** Rendered width in px (height follows the shape). */
  size?: number;
  /** Tilt in degrees; defaults to a natural slight angle derived from the text. */
  rotate?: number;
  /** Turn off the ink texture (e.g. for small previews). */
  plain?: boolean;
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const fit = (text: string, max: number, min: number, budget: number) =>
  Math.max(min, Math.min(max, budget / Math.max(1, text.length)));

/** Font size so that `text` fits `width` px (bold caps ≈ 0.68em per char plus spacing). */
const fitWidth = (text: string, width: number, max: number, min: number, spacing: number) =>
  Math.max(min, Math.min(max, (width / Math.max(1, text.length) - spacing) / 0.68));

/**
 * Text curved around a circle, laid out letter by letter (works in every
 * renderer and printer, unlike <textPath>). `bottom` reads left→right along
 * the lower arc with letters upright.
 */
const ArcText: React.FC<{
  text: string;
  radius: number;
  fontSize: number;
  weight: number;
  spacing: number;
  bottom?: boolean;
  maxSpan?: number;
}> = ({ text, radius, fontSize, weight, spacing, bottom, maxSpan = 300 }) => {
  const chars = [...text];
  const advance = (ch: string) => (ch === ' ' ? fontSize * 0.34 : fontSize * (/[MW]/.test(ch) ? 0.86 : /[IJ1.,:'·|]/.test(ch) ? 0.34 : 0.66)) + spacing;
  const widths = chars.map(advance);
  const total = widths.reduce((a, b) => a + b, 0);
  // Shrink letter spacing if the text would wrap past the allowed arc.
  const maxLen = (maxSpan / 360) * 2 * Math.PI * radius;
  const scale = total > maxLen ? maxLen / total : 1;
  let cursor = -(total * scale) / 2;
  return (
    <>
      {chars.map((ch, i) => {
        const w = widths[i] * scale;
        const mid = cursor + w / 2;
        cursor += w;
        const theta = mid / radius; // radians from the top/bottom centre
        const angle = bottom ? Math.PI / 2 - theta : -Math.PI / 2 + theta;
        const x = 80 + radius * Math.cos(angle);
        const y = 80 + radius * Math.sin(angle);
        const deg = (angle * 180) / Math.PI + (bottom ? -90 : 90);
        return (
          <text
            key={i}
            x={x}
            y={y}
            transform={`rotate(${deg.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Inter Variable, Inter, Arial, sans-serif"
            fontWeight={weight}
            fontSize={fontSize}
            stroke="none"
          >
            {ch}
          </text>
        );
      })}
    </>
  );
};

/**
 * A rubber-stamp style seal drawn in SVG (crisp in print). The ink texture
 * comes from an SVG turbulence filter, which erodes the ink a little like a real stamp.
 */
export const StampSVG: React.FC<StampSVGProps> = ({ stamp, ink, date, size, rotate, plain }) => {
  const uid = useId().replace(/:/g, '');
  const color = STAMP_INK[ink];
  const title = (stamp.title || '').toUpperCase();
  const subtitle = (stamp.subtitle || '').toUpperCase();
  const lines = (stamp.lines ?? []).filter(Boolean);
  const dateText = stamp.showDate && date ? formatDate(date, 'dd MMM yyyy').toUpperCase() : '';
  const tilt = rotate ?? ((hash(title + subtitle) % 9) - 6);
  const filter = plain ? undefined : `url(#ink-${uid})`;

  const defs = (
    <defs>
      <filter id={`ink-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed={hash(title) % 50} result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.75 1.32" result="mask" />
        <feComposite in="SourceGraphic" in2="mask" operator="in" />
      </filter>
    </defs>
  );

  if (stamp.shape === 'round') {
    const w = size ?? 150;
    const bottomText = (lines.join('  •  ') || subtitle).toUpperCase();
    const centerMain = lines.length ? subtitle : '';
    return (
      <svg width={w} height={w} viewBox="0 0 160 160" role="img" aria-label={`${title} stamp`} style={{ transform: `rotate(${tilt}deg)`, overflow: 'visible' }}>
        {defs}
        <g filter={filter} fill={color} stroke={color} opacity={0.9}>
          <circle cx="80" cy="80" r="76" fill="none" strokeWidth="3.2" />
          <circle cx="80" cy="80" r="70" fill="none" strokeWidth="1.1" />
          <circle cx="80" cy="80" r="44" fill="none" strokeWidth="1.1" />
          <ArcText text={title} radius={57} fontSize={Math.min(14, Math.max(8, 190 / Math.max(1, title.length)))} weight={800} spacing={1.4} maxSpan={bottomText ? 200 : 330} />
          {bottomText && (
            <ArcText text={bottomText} radius={57} fontSize={Math.min(8.5, Math.max(5.2, 150 / Math.max(1, bottomText.length)))} weight={600} spacing={0.6} bottom maxSpan={140} />
          )}
          <text x="80" y="71" textAnchor="middle" fontSize="11" stroke="none">
            ★
          </text>
          {centerMain && (
            <text x="80" y="86" textAnchor="middle" fontFamily="Inter Variable, Inter, Arial, sans-serif" fontWeight={700} fontSize={fit(centerMain, 9, 5.5, 72)} stroke="none">
              {centerMain}
            </text>
          )}
          {dateText && (
            <text x="80" y={centerMain ? 99 : 90} textAnchor="middle" fontFamily="Inter Variable, Inter, Arial, sans-serif" fontWeight={600} fontSize="7.5" stroke="none">
              {dateText}
            </text>
          )}
        </g>
      </svg>
    );
  }

  // Rectangular stamp
  const w = size ?? 200;
  const rows: { text: string; size: number; weight: number }[] = [];
  if (subtitle) rows.push({ text: subtitle, size: fitWidth(subtitle, 190, 10, 6, 0.8), weight: 700 });
  lines.slice(0, 2).forEach((l) => rows.push({ text: l, size: fitWidth(l, 196, 8.5, 5.5, 0.4), weight: 500 }));
  if (dateText) rows.push({ text: dateText, size: 8.5, weight: 700 });
  const h = 58 + rows.length * 12.5;
  return (
    <svg width={w} height={(w * h) / 220} viewBox={`0 0 220 ${h}`} role="img" aria-label={`${title} stamp`} style={{ transform: `rotate(${tilt}deg)`, overflow: 'visible' }}>
      {defs}
      <g filter={filter} fill={color} stroke={color} opacity={0.9}>
        <rect x="2" y="2" width="216" height={h - 4} rx="9" fill="none" strokeWidth="3.2" />
        <rect x="8" y="8" width="204" height={h - 16} rx="5" fill="none" strokeWidth="1.1" />
        <text x="110" y="38" textAnchor="middle" fontFamily="Inter Variable, Inter, Arial, sans-serif" fontWeight={900} fontSize={fitWidth(title, 184, 24, 10, 1.5)} letterSpacing="1.5" stroke="none">
          {title}
        </text>
        {rows.map((r, i) => (
          <text key={i} x="110" y={55 + i * 12.5} textAnchor="middle" fontFamily="Inter Variable, Inter, Arial, sans-serif" fontWeight={r.weight} fontSize={r.size} letterSpacing="0.8" stroke="none">
            {r.text}
          </text>
        ))}
      </g>
    </svg>
  );
};

/** The built-in green PAID stamp. */
export const PaidStampSVG: React.FC<{ date?: string; size?: number; rotate?: number }> = ({ date, size = 170, rotate = -8 }) => (
  <StampSVG stamp={{ shape: 'rect', title: 'Paid', subtitle: 'Thank you', showDate: true }} ink="paid" date={date} size={size} rotate={rotate} />
);
