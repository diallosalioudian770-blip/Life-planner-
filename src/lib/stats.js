// Every statistic is computed from data the user entered and validated.
// Scheduled time (plannedMin) and real time (actualMin) are always kept apart,
// and nothing counts as done unless its status is 'done'.

import { occurrences } from './recurrence.js';
import { addDays, rangeDays, parse, startOfWeek, fmtHours, diffDays, weekKeyToMonday, endOfMonth } from './date.js';
import { isStudyType } from './defaults.js';

export function logsIn(store, from, to) {
  return store.list('logs').filter((l) => l.date >= from && l.date <= to);
}

export function postponedIn(store, from, to) {
  const out = [];
  for (const it of store.list('items')) for (const p of it.postponed || []) if (p.from >= from && p.from <= to) out.push({ title: it.title, categoryId: it.categoryId, ...p, itemId: it.id });
  for (const oc of store.list('occ')) {
    const it = store.get('items', oc.itemId);
    if (!it) continue;
    for (const p of oc.postponed || []) if (p.from >= from && p.from <= to) out.push({ title: oc.override?.title || it.title, categoryId: it.categoryId, ...p, itemId: it.id });
  }
  return out;
}

function blank() {
  return { plannedMin: 0, actualMin: 0, tasks: 0, tasksDone: 0, events: 0, eventsDone: 0, missed: 0, postponed: 0, done: 0, count: 0 };
}

export function rangeStats(store, from, to, todayStr) {
  const occ = occurrences(store, from, to);
  const byCat = {};
  const cat = (id) => (byCat[id || 'autre'] ||= blank());
  const totals = blank();
  for (const o of occ) {
    for (const t of [cat(o.categoryId), totals]) {
      t.count++;
      t.plannedMin += o.durationMin;
      if (o.isTask) t.tasks++; else t.events++;
      if (o.status === 'done') {
        t.done++;
        if (o.isTask) t.tasksDone++; else t.eventsDone++;
        t.actualMin += Number(o.actualMin) || 0;
      } else if (o.isTask && o.date < todayStr) t.missed++;
    }
  }
  for (const l of logsIn(store, from, to)) {
    cat(l.categoryId).actualMin += Number(l.minutes) || 0;
    totals.actualMin += Number(l.minutes) || 0;
  }
  const postponed = postponedIn(store, from, to);
  for (const p of postponed) { cat(p.categoryId).postponed++; totals.postponed++; }
  const highPrio = occ.filter((o) => o.isTask && (o.priority === 'haute' || o.priority === 'fixe'));
  return {
    from, to, occ, byCat, totals, postponed,
    highPrio: { total: highPrio.length, done: highPrio.filter((o) => o.status === 'done').length },
    remaining: occ.filter((o) => o.isTask && o.status !== 'done'),
  };
}

export function studyStats(store, from, to) {
  const subjects = store.list('subjects');
  const occ = occurrences(store, from, to);
  const res = Object.fromEntries(subjects.map((s) => [s.id, { plannedMin: 0, actualMin: 0, courseMin: 0, sessions: 0, sessionsDone: 0 }]));
  for (const o of occ) {
    if (!o.subjectId || !res[o.subjectId]) continue;
    const r = res[o.subjectId];
    if (isStudyType(o.type)) {
      r.plannedMin += o.durationMin;
      r.sessions++;
      if (o.status === 'done') { r.sessionsDone++; r.actualMin += Number(o.actualMin) || 0; }
    } else if (['cours', 'tp', 'remediation'].includes(o.type)) r.courseMin += o.durationMin;
  }
  for (const l of logsIn(store, from, to)) if (l.subjectId && res[l.subjectId]) res[l.subjectId].actualMin += Number(l.minutes) || 0;
  return res;
}

// Compare real study time with weekly goals over a period (default: 4 weeks).
export function studyBalance(store, todayStr, weeks = 4) {
  const from = addDays(startOfWeek(todayStr), -7 * (weeks - 1));
  const st = studyStats(store, from, todayStr);
  const elapsedWeeks = Math.max(1, (diffDays(from, todayStr) + 1) / 7);
  return store.list('subjects').map((s) => {
    const goal = s.weeklyGoalMin ? s.weeklyGoalMin * elapsedWeeks : null;
    const a = st[s.id]?.actualMin || 0;
    let verdict = null;
    if (goal) verdict = a < goal * 0.7 ? 'moins' : a > goal * 1.3 ? 'plus' : 'equilibre';
    return { subject: s, actualMin: a, goalMin: goal, ratio: goal ? a / goal : null, verdict };
  });
}

export function chapterProgress(subject) {
  const ch = subject.chapters || [];
  if (!ch.length) return null;
  const score = { a_faire: 0, en_cours: 0.5, a_revoir: 0.75, etudie: 1 };
  return ch.reduce((s, c) => s + (score[c.status] ?? 0), 0) / ch.length;
}

export function gradeAverage(grades) {
  const valid = grades.filter((g) => g.score !== '' && g.score != null && g.max);
  if (!valid.length) return null;
  const wsum = valid.reduce((s, g) => s + (Number(g.coef) || 1), 0);
  return valid.reduce((s, g) => s + (g.score / g.max) * 20 * (Number(g.coef) || 1), 0) / wsum;
}

// ---- habits ----
export function habitDue(h, date) {
  if (h.createdDate && date < h.createdDate) return false;
  if (h.schedule?.type === 'days') return (h.schedule.days || []).includes(parse(date).getDay());
  return true;
}
export function habitDone(h, log) {
  if (!log) return false;
  if (h.target && h.unit) return Number(log.value) >= Number(h.target);
  return !!log.value;
}
export function habitStats(store, from, to) {
  const logs = {};
  for (const l of store.list('habitLogs')) logs[l.id] = l;
  const habits = store.list('habits').filter((h) => !h.archived);
  const per = habits.map((h) => {
    let due = 0, done = 0;
    if (h.schedule?.type === 'weekly') {
      for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) {
        const days = rangeDays(w, addDays(w, 6)).filter((d) => d >= from && d <= to);
        const n = Number(h.schedule.timesPerWeek) || 1;
        const d = days.filter((d) => habitDone(h, logs[`${h.id}@${d}`])).length;
        due += n; done += Math.min(d, n);
      }
    } else {
      for (const d of rangeDays(from, to)) {
        if (!habitDue(h, d)) continue;
        due++;
        if (habitDone(h, logs[`${h.id}@${d}`])) done++;
      }
    }
    return { habit: h, due, done, rate: due ? done / due : null };
  });
  const due = per.reduce((s, p) => s + p.due, 0);
  const done = per.reduce((s, p) => s + p.done, 0);
  return { per, due, done, rate: due ? done / due : null };
}
export function habitStreak(store, h, todayStr) {
  let n = 0;
  for (let d = todayStr, i = 0; i < 366; i++, d = addDays(d, -1)) {
    if (!habitDue(h, d)) continue;
    const l = store.get('habitLogs', `${h.id}@${d}`);
    if (habitDone(h, l)) n++;
    else if (d !== todayStr) break;
  }
  return n;
}

// ---- finances ----
export function financeStats(store, from, to) {
  const settings = store.get('settings', 'main');
  const fin = settings?.finance || {};
  const tx = store.list('transactions');
  const inRange = tx.filter((t) => t.date >= from && t.date <= to);
  const sum = (arr, type) => arr.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount || 0), 0);
  const byCategory = {};
  for (const t of inRange) if (t.type === 'expense') byCategory[t.category || 'Autres'] = (byCategory[t.category || 'Autres'] || 0) + Number(t.amount || 0);
  let balance = null;
  if (fin.initialBalance != null && fin.initialBalance !== '') {
    const since = tx.filter((t) => !fin.initialBalanceDate || t.date >= fin.initialBalanceDate);
    balance = Number(fin.initialBalance) + sum(since, 'income') - sum(since, 'expense') - sum(since, 'saving') + sum(since, 'withdraw');
  }
  const savedTotal = sum(tx, 'saving') - sum(tx, 'withdraw');
  return {
    income: sum(inRange, 'income'), expense: sum(inRange, 'expense'), saving: sum(inRange, 'saving') - sum(inRange, 'withdraw'),
    byCategory, balance, savedTotal, count: inRange.length,
  };
}

export const euro = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' }));

// ---- other trackers ----
export function languageMinutes(store, from, to) {
  const res = {};
  for (const o of occurrences(store, from, to)) if (o.languageId && o.status === 'done') res[o.languageId] = (res[o.languageId] || 0) + (Number(o.actualMin) || 0);
  for (const l of logsIn(store, from, to)) if (l.languageId) res[l.languageId] = (res[l.languageId] || 0) + (Number(l.minutes) || 0);
  return res;
}

export function sportStats(store, from, to, todayStr) {
  const occ = occurrences(store, from, to).filter((o) => o.type === 'seance' || o.categoryId === 'sport');
  const sessions = occ.filter((o) => o.type === 'seance');
  return {
    planned: sessions.length,
    done: sessions.filter((o) => o.status === 'done').length,
    missed: sessions.filter((o) => o.status !== 'done' && o.date < todayStr).length,
    actualMin: occ.filter((o) => o.status === 'done').reduce((s, o) => s + (Number(o.actualMin) || 0), 0)
      + logsIn(store, from, to).filter((l) => l.categoryId === 'sport').reduce((s, l) => s + Number(l.minutes || 0), 0),
  };
}

export function booksFinished(store, from, to) {
  return store.list('books').filter((b) => b.status === 'done' && b.endDate && b.endDate >= from && b.endDate <= to);
}

export function goalsIn(store, horizon, period) {
  return store.list('goals').filter((g) => g.horizon === horizon && (period == null || g.period === period));
}

// Auto-measured goals read their value from real data only.
export function goalValue(store, g, todayStr) {
  if (!g.metric || g.metric === 'manuel') return Number(g.current) || 0;
  const [from, to] = goalRange(g, todayStr);
  if (g.metric === 'heures') {
    const st = rangeStats(store, from, to, todayStr);
    return Math.round(((st.byCat[g.categoryId]?.actualMin || 0) / 60) * 10) / 10;
  }
  if (g.metric === 'taches') return rangeStats(store, from, to, todayStr).byCat[g.categoryId]?.tasksDone || 0;
  if (g.metric === 'livres') return booksFinished(store, from, to).length;
  if (g.metric === 'seances') return sportStats(store, from, to, todayStr).done;
  if (g.metric === 'epargne') return financeStats(store, from, to).saving;
  return 0;
}

export function goalRange(g, todayStr) {
  const p = g.period;
  if (g.horizon === 'semaine' && p) { const m = weekKeyToMonday(p); return [m, addDays(m, 6)]; }
  if (g.horizon === 'mois' && p) { return [p + '-01', endOfMonth(p + '-01')]; }
  if (g.horizon === 'annee' && p) return [p + '-01-01', p + '-12-31'];
  return [g.startDate || '2000-01-01', todayStr];
}

export function goalProgress(store, g, todayStr) {
  if (g.done) return 1;
  if (!g.target) return g.steps?.length ? g.steps.filter((s) => s.done).length / g.steps.length : 0;
  return Math.min(1, goalValue(store, g, todayStr) / Number(g.target));
}


// ---- smart summary: honest sentences from real data only ----
export function smartSummary(store, from, to, todayStr, categories) {
  const st = rangeStats(store, from, to, todayStr);
  const study = studyStats(store, from, to);
  const subjects = store.list('subjects');
  const out = [];
  const catName = (id) => categories.find((c) => c.id === id)?.name || 'Autre';
  const studyCat = st.byCat.etudes;
  const studyActual = Object.values(study).reduce((s, x) => s + x.actualMin, 0);
  if (studyActual > 0) out.push(`Tu as réalisé ${fmtHours(studyActual)} de travail personnel en études sur cette période.`);
  else if (studyCat?.plannedMin) out.push(`Aucune séance d'étude n'a encore été validée sur cette période. Rien n'est perdu : tu peux reprogrammer ce qui reste.`);
  if (st.highPrio.total) out.push(`Tu as terminé ${st.highPrio.done} de tes ${st.highPrio.total} tâches prioritaires.`);
  if (st.totals.tasks) out.push(`${st.totals.tasksDone} tâche${st.totals.tasksDone > 1 ? 's' : ''} validée${st.totals.tasksDone > 1 ? 's' : ''} sur ${st.totals.tasks} prévue${st.totals.tasks > 1 ? 's' : ''}.`);
  for (const s of subjects) {
    const x = study[s.id];
    if (!x) continue;
    const goal = s.weeklyGoalMin ? s.weeklyGoalMin * Math.max(1, Math.round((diffDays(from, to) + 1) / 7)) : null;
    const target = goal || x.plannedMin;
    if (target && x.actualMin < target * 0.7) out.push(`Tu as consacré moins de temps que prévu à « ${s.name} » (${fmtHours(x.actualMin)} sur ${fmtHours(target)}).`);
    else if (target && x.actualMin >= target) out.push(`Objectif atteint pour « ${s.name} » : ${fmtHours(x.actualMin)}. Bravo.`);
  }
  const best = Object.entries(st.byCat).filter(([, v]) => v.tasks >= 2).sort((a, b) => b[1].tasksDone / b[1].tasks - a[1].tasksDone / a[1].tasks)[0];
  if (best && best[1].tasksDone) out.push(`Ta catégorie la plus régulière : ${catName(best[0])} (${best[1].tasksDone}/${best[1].tasks}).`);
  if (st.postponed.length) out.push(`${st.postponed.length} tâche${st.postponed.length > 1 ? 's ont été reportées' : ' a été reportée'}. Reporter, c'est aussi s'adapter.`);
  if (!out.length) out.push("Pas encore assez de données validées pour analyser cette période. Coche tes tâches au fil des jours et le bilan se remplira tout seul.");
  return out;
}
