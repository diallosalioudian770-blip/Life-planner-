// Reminders. In-app reminders always work. System notifications use the
// browser Notification API: they fire while the app is open (or recently
// active as an installed PWA). Background push while the app is fully closed
// needs a push server, which is NOT implemented (see README).

import { occurrences } from './recurrence.js';
import { addDays, parse, today, toMin } from './date.js';
import { habitDue, habitDone } from './stats.js';

function at(date, hhmm) {
  const d = parse(date);
  const m = toMin(hhmm || '09:00');
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export function computeReminders(store, now = new Date()) {
  const settings = store.get('settings', 'main') || {};
  const n = settings.notifications || {};
  const t = today();
  const out = [];
  const occ = occurrences(store, addDays(t, -1), addDays(t, Math.max(8, Number(n.examLeadDays) || 3) + 1));
  for (const o of occ) {
    if (o.status === 'done') continue;
    if (n.items !== false && o.reminderMin != null) {
      const when = new Date(at(o.date, o.start).getTime() - o.reminderMin * 60000);
      out.push({ key: `item:${o.key}:${o.reminderMin}`, kind: 'item', when, title: o.title, body: o.start ? `${o.date === t ? "Aujourd'hui" : o.date} à ${o.start}` : `Prévu le ${o.date}`, date: o.date });
    }
    if (n.exams && (o.type === 'examen' || o.type === 'interro')) {
      const lead = Number(n.examLeadDays) || 3;
      out.push({ key: `exam:${o.key}`, kind: 'exam', when: at(addDays(o.date, -lead), '10:00'), title: `${o.type === 'examen' ? 'Examen' : 'Interrogation'} dans ${lead} jour${lead > 1 ? 's' : ''}`, body: o.title, date: o.date });
    }
    if (n.deadlines && o.type === 'echeance') {
      const lead = Number(n.deadlineLeadDays) || 1;
      out.push({ key: `dl:${o.key}`, kind: 'deadline', when: at(addDays(o.date, -lead), '10:00'), title: `Échéance dans ${lead} jour${lead > 1 ? 's' : ''}`, body: o.title, date: o.date });
    }
    if (n.rdv && o.type === 'rdv' && o.start && o.reminderMin == null) {
      out.push({ key: `rdv:${o.key}`, kind: 'rdv', when: new Date(at(o.date, o.start).getTime() - 60 * 60000), title: 'Rendez-vous dans 1 h', body: o.title, date: o.date });
    }
  }
  if (n.habits && n.habitTime) {
    const pending = store.list('habits').filter((h) => !h.archived && habitDue(h, t) && !habitDone(h, store.get('habitLogs', `${h.id}@${t}`)));
    if (pending.length) out.push({ key: `habits:${t}`, kind: 'habit', when: at(t, n.habitTime), title: 'Tes habitudes du jour', body: pending.map((h) => h.name).slice(0, 4).join(', '), date: t });
  }
  if (n.goals && n.goalTime && parse(t).getDay() === 0) {
    const open = store.list('goals').filter((g) => !g.done && g.horizon === 'semaine');
    if (open.length) out.push({ key: `goals:${t}`, kind: 'goal', when: at(t, n.goalTime), title: 'Tes objectifs de la semaine', body: `${open.length} objectif(s) encore ouvert(s). Pense au bilan de la semaine.`, date: t });
  }
  return out.filter((r) => r.when.getTime() > now.getTime() - 36 * 3600000).sort((a, b) => a.when - b.when);
}

const NOTIFIED = 'lp:notified';
function notifiedSet() {
  try { return JSON.parse(localStorage.getItem(NOTIFIED) || '{}'); } catch { return {}; }
}

export function startNotifier(store) {
  let timers = [];
  async function show(r) {
    const seen = notifiedSet();
    if (seen[r.key]) return;
    const settings = store.get('settings', 'main') || {};
    const max = Number(settings.notifications?.maxPerDay) || 6;
    const t = today();
    if (Object.values(seen).filter((d) => d === t).length >= max) return;
    seen[r.key] = t;
    localStorage.setItem(NOTIFIED, JSON.stringify(seen));
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) await reg.showNotification(r.title, { body: r.body, tag: r.key, icon: './icon-192.png' });
      else new Notification(r.title, { body: r.body, tag: r.key });
    } catch { /* notification refused by the browser */ }
  }
  function plan() {
    timers.forEach(clearTimeout);
    timers = [];
    const settings = store.get('settings', 'main') || {};
    if (!settings.notifications?.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const now = Date.now();
    for (const r of computeReminders(store)) {
      const delay = r.when.getTime() - now;
      if (delay < -15 * 60000) continue; // too old
      if (delay > 12 * 3600000) continue;
      timers.push(setTimeout(() => show(r), Math.max(0, delay)));
    }
  }
  plan();
  const unsub = store.subscribe(() => { clearTimeout(plan._t); plan._t = setTimeout(plan, 1500); });
  const iv = setInterval(plan, 30 * 60000);
  return () => { unsub(); clearInterval(iv); timers.forEach(clearTimeout); };
}
