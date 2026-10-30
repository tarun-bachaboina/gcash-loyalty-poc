const pointsFmt = new Intl.NumberFormat('en-PH');
const pesoFmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPoints = (n: number) => pointsFmt.format(Math.round(n));
export const formatPeso = (n: number) => `₱${pesoFmt.format(n)}`;

const manilaParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO timestamp → "YYYY-MM-DD HH:mm" in Asia/Manila (PRD display format). */
export function formatManilaDateTime(iso: string) {
  const p = Object.fromEntries(manilaParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export { manilaDate as formatManilaDate } from '@gcash/shared';
