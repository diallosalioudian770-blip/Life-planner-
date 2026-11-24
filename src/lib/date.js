// Date helpers. All calendar dates are local "YYYY-MM-DD" strings.

const pad = (n) => String(n).padStart(2, '0');

export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // midday avoids DST edge cases
}

export const today = () => ymd(new Date());

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function addMonths(s, n) {
  const d = parse(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}

export function diffDays(a, b) {
  // b - a in days
  return Math.round((parse(b) - parse(a)) / 86400000);
}

export const weekday = (s) => parse(s).getDay(); // 0 = dimanche

export function startOfWeek(s) {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd); // lundi
}

export const endOfWeek = (s) => addDays(startOfWeek(s), 6);

export function weekDays(s) {
  const start = startOfWeek(s);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ISO week key, e.g. 2026-W48
export function weekKey(s) {
  const d = parse(s);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const isoYear = target.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4, 12);
  const fDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fDay + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${isoYear}-W${pad(week)}`;
}

export function weekKeyToMonday(key) {
  const [y, w] = key.split('-W').map(Number);
  const jan4 = ymd(new Date(y, 0, 4, 12));
  return addDays(startOfWeek(jan4), (w - 1) * 7);
}

export const monthKey = (s) => s.slice(0, 7);
export const startOfMonth = (s) => s.slice(0, 7) + '-01';
export function endOfMonth(s) {
  const d = parse(startOfMonth(s));
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
}

// 6x7 grid of dates for a month view (weeks start on Monday)
export function monthGrid(s) {
  const start = startOfWeek(startOfMonth(s));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function rangeDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const fr = 'fr-FR';
export const fmtDay = (s, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  parse(s).toLocaleDateString(fr, opts);
export const fmtShort = (s) => parse(s).toLocaleDateString(fr, { day: 'numeric', month: 'short' });
export const fmtMonth = (s) => parse(s).toLocaleDateString(fr, { month: 'long', year: 'numeric' });
export const fmtWeekdayShort = (s) => parse(s).toLocaleDateString(fr, { weekday: 'short' });
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const WEEKDAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// "HH:MM" <-> minutes
export function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function fromMin(m) {
  m = Math.max(0, Math.min(24 * 60 - 1, Math.round(m)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function fmtDuration(min) {
  min = Math.round(min || 0);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

export const fmtHours = (min) => {
  const h = (min || 0) / 60;
  return `${h.toLocaleString(fr, { maximumFractionDigits: 1 })} h`;
};
