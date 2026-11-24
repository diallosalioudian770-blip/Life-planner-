// Revision planner: PROPOSES study sessions in free slots of the week.
// It never writes to the calendar; the UI asks the user to accept, edit or refuse.

import { occurrences } from './recurrence.js';
import { addDays, diffDays, fromMin, parse, rangeDays, startOfWeek, toMin } from './date.js';
import { isStudyType } from './defaults.js';

const GAP = 10; // minutes kept around existing activities

function freeSlots(windows, busy) {
  // windows: [{s,e}] minutes; busy: [{s,e}]
  let slots = windows.map((w) => ({ ...w }));
  for (const b of busy) {
    const next = [];
    for (const s of slots) {
      if (b.e <= s.s || b.s >= s.e) { next.push(s); continue; }
      if (b.s > s.s) next.push({ s: s.s, e: b.s });
      if (b.e < s.e) next.push({ s: b.e, e: s.e });
    }
    slots = next;
  }
  return slots.filter((s) => s.e - s.s >= 30);
}

export function suggestRevisions(store, weekDate, todayStr, { refused = [] } = {}) {
  const settings = store.get('settings', 'main');
  const plan = { sessionMin: 60, breakMin: 15, maxStudyMinPerDay: 180, keepFreeMin: 60, restDays: [], ...(settings?.planning || {}) };
  const weekStart = startOfWeek(weekDate);
  const weekEnd = addDays(weekStart, 6);
  const from = todayStr > weekStart ? todayStr : weekStart;
  if (from > weekEnd) return { suggestions: [], notes: ['Cette semaine est terminée.'] };

  const subjects = store.list('subjects');
  const weekOcc = occurrences(store, weekStart, weekEnd);
  const horizonOcc = occurrences(store, from, addDays(from, 21));
  const notes = [];

  // 1. need per subject (minutes) for the rest of the week
  const need = {};
  const reasons = {};
  for (const s of subjects) {
    const scheduled = weekOcc.filter((o) => o.subjectId === s.id && isStudyType(o.type)).reduce((a, o) => a + o.durationMin, 0);
    let n = s.weeklyGoalMin ? Math.max(0, s.weeklyGoalMin - scheduled) : 0;
    const r = [];
    if (n) r.push(`objectif hebdo : ${Math.round(n / 6) / 10} h restantes à placer`);
    const exam = horizonOcc.filter((o) => o.subjectId === s.id && (o.type === 'examen' || o.type === 'interro' || o.type === 'echeance') && o.status !== 'done')
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (exam) {
      const days = diffDays(todayStr, exam.date);
      const extra = days <= 3 ? 180 : days <= 7 ? 120 : days <= 14 ? 60 : 30;
      n += extra;
      r.push(`${exam.type === 'echeance' ? 'échéance' : exam.type === 'interro' ? 'interrogation' : 'examen'} « ${exam.title} » dans ${days} jour${days > 1 ? 's' : ''}`);
      s._examDays = days;
    } else s._examDays = 99;
    if (n && s.reinforced) { n = Math.round(n * 1.25); r.push('matière à renforcer'); }
    need[s.id] = n;
    reasons[s.id] = r;
  }
  if (!subjects.some((s) => need[s.id] > 0)) {
    notes.push("Aucun besoin à planifier : fixe un objectif hebdomadaire de révision par matière (onglet Études › Matières) ou ajoute tes examens et échéances.");
    return { suggestions: [], notes };
  }

  // 2. free time per day from availability minus what is already planned
  const days = rangeDays(from, weekEnd).filter((d) => !(plan.restDays || []).includes(parse(d).getDay()));
  const dayInfo = days.map((d) => {
    const wd = parse(d).getDay();
    const windows = (settings?.availability?.[wd] || []).map((w) => ({ s: toMin(w.start), e: toMin(w.end) })).filter((w) => w.e > w.s);
    const dayOcc = weekOcc.filter((o) => o.date === d);
    const busy = dayOcc.filter((o) => o.start).map((o) => ({ s: toMin(o.start) - GAP, e: toMin(o.start) + Math.max(o.durationMin, 30) + GAP }));
    if (d === todayStr) { const now = new Date(); const m = now.getHours() * 60 + now.getMinutes() + 15; busy.push({ s: 0, e: m }); }
    const slots = freeSlots(windows, busy);
    const freeTotal = slots.reduce((a, s) => a + s.e - s.s, 0);
    const studyPlanned = dayOcc.filter((o) => isStudyType(o.type)).reduce((a, o) => a + o.durationMin, 0);
    // keep time free for rest and unexpected events
    const capacity = Math.max(0, Math.min(plan.maxStudyMinPerDay - studyPlanned, freeTotal - plan.keepFreeMin));
    return { date: d, slots, capacity, placed: [], lastSubject: null };
  });

  const refusedSet = new Set(refused);
  const suggestions = [];
  const sorted = () => subjects.filter((s) => need[s.id] >= 30)
    .sort((a, b) => (a._examDays - b._examDays) || (need[b.id] - need[a.id]));

  // 3. round-robin across days, one session per subject per day (two if exam ≤ 3 days)
  let progress = true;
  while (progress) {
    progress = false;
    for (const day of dayInfo) {
      if (day.capacity < 30) continue;
      const cand = sorted().find((s) => {
        const count = day.placed.filter((p) => p.subjectId === s.id).length;
        const max = s._examDays <= 3 ? 2 : 1;
        if (s._examDays < diffDays(todayStr, day.date)) return false; // don't plan after the exam
        return count < max && day.lastSubject !== s.id;
      });
      if (!cand) continue;
      const len = Math.min(plan.sessionMin, need[cand.id], day.capacity);
      if (len < 30) continue;
      const slotIdx = day.slots.findIndex((sl) => sl.e - sl.s >= len);
      if (slotIdx < 0) { day.capacity = 0; continue; }
      const slot = day.slots[slotIdx];
      const start = slot.s;
      const id = `${cand.id}|${day.date}|${fromMin(start)}`;
      // consume slot (+ break), even if refused, so the next proposal moves on
      slot.s = start + len + plan.breakMin;
      if (slot.e - slot.s < 30) day.slots.splice(slotIdx, 1);
      progress = true;
      if (refusedSet.has(id)) continue; // refused slot: try another time for the same need
      day.capacity -= len;
      day.lastSubject = cand.id;
      need[cand.id] -= len;
      day.placed.push({ subjectId: cand.id });
      suggestions.push({
        id, date: day.date, start: fromMin(start), durationMin: len, subjectId: cand.id,
        title: `Révision — ${cand.name}`, reason: reasons[cand.id].join(' · '),
      });
    }
  }
  const left = subjects.filter((s) => need[s.id] >= 30);
  if (left.length) notes.push(`Pas assez de créneaux libres pour tout placer cette semaine (${left.map((s) => s.name).join(', ')}). Tu peux élargir tes disponibilités dans Paramètres ou alléger tes objectifs.`);
  return { suggestions: suggestions.sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1)), notes };
}
