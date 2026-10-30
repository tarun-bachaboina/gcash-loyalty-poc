import { CountUp } from './CountUp';
import { formatPoints } from './format';
import { useSvgId } from './svgId';

const SIZES = {
  sm: { coin: 16, text: 'text-sm font-bold', unit: 'text-[0.7em]' },
  md: { coin: 20, text: 'text-base font-bold', unit: 'text-[0.7em]' },
  lg: { coin: 28, text: 'font-display text-2xl font-extrabold tracking-tight', unit: 'text-[0.55em]' },
  // Clamped so a 7-digit balance still fits a 360px screen
  xl: { coin: 40, text: 'font-display text-[clamp(2.25rem,11vw,3rem)] leading-none font-extrabold tracking-tight', unit: 'text-[0.4em]' },
} as const;

// Coin mark: the GCash logo mark (C ring, G, inner and outer pay waves), path data copied unchanged from
// public/assets/GCash_logo.svg (viewBox units). Its bounding box (x 4.4–503.5, y 1.0–421.9) is centred on the coin.
const MARK_CX = 253.95;
const MARK_CY = 211.45;
const MARK_SCALE = 0.034; // farthest mark point is 253 units from its centre → 8.6 of the coin's 11 radius
const MARK = [
  'M 148.8 12.6 C 173.9 4.4 200.6 1.0 227.0 2.7 C 265.7 4.8 303.5 18.5 335.0 41.0 C 338.4 43.5 342.1 45.8 345.0 49.0 C 350.0 54.7 352.0 62.8 350.2 70.2 C 348.4 78.2 342.1 85.0 334.3 87.4 C 326.7 89.8 318.0 88.2 311.9 83.1 C 288.4 65.0 259.8 53.6 230.3 50.8 C 219.5 49.6 208.5 49.6 197.7 50.8 C 166.6 53.9 136.5 66.4 112.3 86.3 C 85.0 108.6 65.1 140.0 57.3 174.4 C 50.1 205.6 52.3 239.0 63.9 268.9 C 76.1 300.7 98.8 328.2 127.4 346.6 C 148.8 360.3 173.5 368.8 198.7 371.2 C 208.5 372.4 218.5 372.4 228.2 371.3 C 258.7 368.7 288.2 357.0 312.4 338.3 C 318.5 333.5 327.2 332.1 334.6 334.6 C 344.8 338.1 352.1 349.0 350.8 359.8 C 350.2 366.1 346.9 372.1 341.9 375.9 C 322.7 390.9 300.9 402.4 277.7 409.8 C 247.8 419.4 215.6 421.9 184.5 417.6 C 150.0 412.8 116.8 399.0 89.0 378.0 C 62.0 357.8 40.0 330.9 25.5 300.4 C 11.3 270.5 4.4 237.1 5.6 204.0 C 6.7 163.3 20.2 123.1 44.0 90.0 C 69.6 54.0 106.7 26.3 148.8 12.6 Z', // C ring
  'M 145.6 97.5 C 188.0 71.9 245.3 72.6 286.5 100.5 C 296.7 108.0 298.8 124.0 290.9 133.9 C 283.8 143.6 269.1 146.5 259.0 140.0 C 243.0 129.8 223.6 125.4 204.8 127.6 C 186.0 129.6 168.0 138.3 154.8 151.8 C 141.6 164.9 133.0 182.5 130.9 201.0 C 129.0 216.0 131.5 231.5 137.7 245.3 C 145.9 263.5 160.8 278.6 179.0 287.0 C 197.6 295.8 219.4 297.2 239.0 291.1 C 265.2 283.1 286.9 261.4 294.4 235.1 C 275.6 235.2 256.8 235.1 238.0 235.1 C 229.0 235.1 220.3 229.5 216.6 221.4 C 212.0 212.1 214.4 200.0 222.2 193.2 C 226.2 189.6 231.5 187.2 236.9 187.0 C 265.3 186.8 293.6 186.9 322.0 186.9 C 331.3 186.6 340.3 192.4 344.0 200.9 C 347.2 207.5 346.2 215.0 345.8 222.1 C 343.3 252.9 329.4 282.6 307.4 304.4 C 286.3 325.6 257.8 339.3 228.0 342.3 C 198.7 345.5 168.4 338.4 143.5 322.5 C 118.4 306.6 98.8 281.9 89.2 253.7 C 79.4 225.2 79.9 193.3 90.1 165.0 C 100.1 137.0 120.1 112.8 145.6 97.5 Z', // G
  'M 376.4 110.6 C 386.7 107.9 398.4 113.2 403.2 122.7 C 429.2 177.7 429.2 244.3 403.2 299.3 C 399.9 305.8 393.3 310.6 386.0 311.8 C 377.5 313.3 368.4 309.7 363.1 302.9 C 357.6 295.8 356.6 285.6 360.6 277.6 C 380.0 235.5 379.7 185.0 360.1 143.0 C 354.2 130.1 362.6 113.6 376.4 110.6 Z', // inner pay wave
  'M 441.4 69.4 C 451.8 66.3 464.0 71.2 469.0 81.0 C 493.0 127.9 503.5 181.5 499.2 234.0 C 496.2 271.4 485.9 308.3 468.6 341.6 C 462.3 353.5 445.4 357.3 434.5 349.5 C 424.4 343.0 421.1 328.5 427.1 318.0 C 460.5 252.4 460.8 171.1 427.8 105.3 C 424.8 99.9 423.2 93.5 424.7 87.4 C 426.4 78.9 433.1 71.7 441.4 69.4 Z', // outer pay wave
];

/**
 * Gold "GCash coin": a solid disc in one gold gradient with the GCash logo mark (exact geometry, centred) engraved into it (a darker shade of
 * the same gold), so nothing behind the coin shows through (user decision: single gold gradient, no blue).
 * Gold is earned: points only.
 */
export function Coin({ size = 20, className }: { size?: number; className?: string }) {
  const id = useSvgId();
  const gold = `url(#${id}g)`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className ?? ''}`}>
      <defs>
        {/* One gradient across the whole coin, so rim and mark read as a single struck piece */}
        <linearGradient id={`${id}g`} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--gold-300)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--gold-500)' }} />
          <stop offset="1" style={{ stopColor: 'var(--gold-600)' }} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={gold} />
      {/* Engraved mark: black at low opacity darkens the gold itself, in either theme */}
      <g transform={`translate(12 12) scale(${MARK_SCALE}) translate(${-MARK_CX} ${-MARK_CY})`} className="fill-black/35">
        {MARK.map((d) => (
          <path key={d.slice(0, 12)} d={d} />
        ))}
      </g>
    </svg>
  );
}

interface PointsChipProps {
  points: number;
  size?: keyof typeof SIZES;
  /** EARN shows "+", green; BURN shows "−", red (PRD C-5). */
  tone?: 'default' | 'earn' | 'burn';
  /** Rendered on a SpacePanel (navy hero): light text. */
  onSpace?: boolean;
  /** Count up from `from` instead of rendering statically. */
  animate?: boolean;
  from?: number;
  announce?: boolean;
  className?: string;
}

const TONE = {
  surface: { default: 'text-text-1', earn: 'text-success-700', burn: 'text-danger-700' },
  space: { default: 'text-on-space', earn: 'text-on-space-success', burn: 'text-on-space-danger' },
} as const;

export function PointsChip({ points, size = 'md', tone = 'default', onSpace = false, animate = false, from = 0, announce, className }: PointsChipProps) {
  const s = SIZES[size];
  const sign = tone === 'earn' ? '+' : tone === 'burn' ? '−' : '';
  const value = Math.abs(points);
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${s.text} ${TONE[onSpace ? 'space' : 'surface'][tone]} ${className ?? ''}`}>
      <Coin size={s.coin} />
      <span className="tabular">
        <span>
          {sign}
          {animate ? <CountUp to={value} from={from} announce={announce} /> : formatPoints(value)}
        </span>
        <span className={`ml-1 font-sans font-bold ${s.unit} ${onSpace ? 'text-on-space-muted' : ''}`}>PTS</span>
      </span>
    </span>
  );
}
