// Recurring activities are stored ONCE as a series (item.recur). Occurrences are
// computed on the fly for the visible range, so a refresh never duplicates them.
// Per-occurrence state (done, real time, moved, edited) lives in the `occ`
// collection under the key `${itemId}@${originalDate}`.

import { addDays, diffDays, parse, startOfWeek } from './date.js';
import { uid } from './store.js';
import { isTaskType } from './defaults.js';

export const occKey = (itemId, date) => `${itemId}@${date}`;

export function matchesRecurrence(item, date) {
  const r = item.recur;
  if (!r) return date === item.date;
  if (date < item.date) return false;
  if (r.until && date > r.until) return false;
  if ((item.exdates || []).includes(date)) return false;
  const interval = Math.max(1, r.interval || 1);
  if (r.freq === 'daily') return diffDays(item.date, date) % interval === 0;
  if (r.freq === 'weekly') {
    const days = r.days?.length ? r.days : [parse(item.date).getDay()];
    if (!days.includes(parse(date).getDay())) return false;
    const weeks = Math.floor(diffDays(startOfWeek(item.date), startOfWeek(date)) / 7);
    return weeks % interval === 0;
  }
  if (r.freq === 'monthly') {
    const a = parse(item.date);
    const b = parse(date);
    const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    return months % interval === 0 && b.getDate() === a.getDate();
  }
  return false;
}

function buildOcc(item, origDate, occ) {
  const ov = occ?.override || {};
  const base = { ...item, ...ov };
  const isTask = isTaskType(base.type);
  return {
    key: item.recur ? occKey(item.id, origDate) : item.id,
    itemId: item.id,
    item,
    recurring: !!item.recur,
    origDate,
    date: ov.date || (item.recur ? origDate : item.date),
    title: base.title,
    type: base.type || 'tache',
    categoryId: base.categoryId,
    subjectId: base.subjectId || null,
    projectId: base.projectId || null,
    languageId: base.languageId || null,
    priority: base.priority || 'secondaire',
    start: base.start || null,
    durationMin: Number(base.durationMin) || 0,
    notes: base.notes || '',
    location: base.location || '',
    important: !!base.important,
    reminderMin: base.reminderMin ?? null,
    status: item.recur ? occ?.status || 'todo' : item.status || 'todo',
    actualMin: item.recur ? occ?.actualMin ?? null : item.actualMin ?? null,
    doneAt: item.recur ? occ?.doneAt : item.doneAt,
    postponed: item.recur ? occ?.postponed || [] : item.postponed || [],
    isTask,
    exercises: base.exercises || null,
    results: item.recur ? occ?.results || null : item.results || null,
  };
}

// All occurrences whose (possibly moved) date is within [from, to].
export function expand(items, occMap, from, to) {
  const out = [];
  for (const item of items) {
    if (!item.recur) {
      if (item.date && item.date >= from && item.date <= to) out.push(buildOcc(item, item.date, null));
      continue;
    }
    // generated occurrences in range
    const start = item.date > from ? item.date : from;
    const end = item.recur.until && item.recur.until < to ? item.recur.until : to;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (!matchesRecurrence(item, d)) continue;
      const occ = occMap[occKey(item.id, d)];
      const o = buildOcc(item, d, occ);
      if (o.date >= from && o.date <= to) out.push(o);
    }
  }
  // occurrences moved INTO the range from outside it
  for (const occ of Object.values(occMap)) {
    if (occ.deleted || !occ.override?.date) continue;
    const d = occ.override.date;
    if (d < from || d > to) continue;
    if (occ.date >= from && occ.date <= to) continue; // already handled
    const item = items.find((i) => i.id === occ.itemId);
    if (item && matchesRecurrence(item, occ.date)) out.push(buildOcc(item, occ.date, occ));
  }
  return out.sort(sortOcc);
}

export function sortOcc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.start && b.start) return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  if (a.start) return -1;
  if (b.start) return 1;
  return (a.title || '').localeCompare(b.title || '');
}

export function occMapFrom(store) {
  const m = {};
  for (const o of store.list('occ')) m[o.id] = o;
  return m;
}

export function occurrences(store, from, to) {
  return expand(store.list('items'), occMapFrom(store), from, to);
}

// ---------- mutations ----------

const OVERRIDABLE = ['title', 'start', 'durationMin', 'notes', 'priority', 'location', 'categoryId', 'subjectId', 'type', 'important', 'reminderMin', 'exercises', 'projectId', 'languageId'];

export function setStatus(store, o, status, actualMin = null) {
  const patch = status === 'done'
    ? { status: 'done', actualMin: actualMin == null ? null : Number(actualMin), doneAt: Date.now() }
    : { status: 'todo', actualMin: null, doneAt: null };
  if (o.recurring) {
    const id = occKey(o.itemId, o.origDate);
    const prev = store.get('occ', id) || { id, itemId: o.itemId, date: o.origDate };
    store.put('occ', { ...prev, ...patch });
  } else {
    store.put('items', { id: o.itemId, ...patch });
  }
}

export function setActual(store, o, actualMin) {
  if (o.recurring) {
    const id = occKey(o.itemId, o.origDate);
    const prev = store.get('occ', id) || { id, itemId: o.itemId, date: o.origDate };
    store.put('occ', { ...prev, actualMin: Number(actualMin) });
  } else store.put('items', { id: o.itemId, actualMin: Number(actualMin) });
}

// Move one occurrence (or a single task) to another date and/or time.
export function moveOccurrence(store, o, newDate, newStart = o.start, { postpone = false } = {}) {
  const record = postpone ? [...(o.postponed || []), { from: o.date, to: newDate, at: Date.now() }] : o.postponed;
  if (o.recurring) {
    const id = occKey(o.itemId, o.origDate);
    const prev = store.get('occ', id) || { id, itemId: o.itemId, date: o.origDate };
    const override = { ...(prev.override || {}), date: newDate === o.origDate ? undefined : newDate, start: newStart };
    if (!override.date) delete override.date;
    store.put('occ', { ...prev, override, postponed: record });
  } else {
    store.put('items', { id: o.itemId, date: newDate, start: newStart, postponed: record });
  }
}

// scope: 'this' | 'future' | 'all'
export function updateOccurrence(store, o, changes, scope = 'this') {
  const item = store.get('items', o.itemId);
  if (!item) return;
  if (!item.recur) {
    store.put('items', { id: item.id, ...changes });
    return;
  }
  if (scope === 'this') {
    const id = occKey(o.itemId, o.origDate);
    const prev = store.get('occ', id) || { id, itemId: o.itemId, date: o.origDate };
    const override = { ...(prev.override || {}) };
    for (const k of OVERRIDABLE) if (k in changes) override[k] = changes[k];
    if (changes.date && changes.date !== o.origDate) override.date = changes.date;
    store.put('occ', { ...prev, override });
    return;
  }
  if (scope === 'all' || o.origDate <= item.date) {
    const { date, ...rest } = changes;
    const patch = { ...rest };
    if (date && date !== o.origDate) patch.date = addDays(item.date, diffDays(o.origDate, date));
    store.put('items', { id: item.id, ...patch });
    return;
  }
  // 'future': split the series at the selected occurrence
  const newId = uid('it');
  const newStartDate = changes.date || o.origDate;
  const shift = diffDays(o.origDate, newStartDate);
  const newRecur = { ...item.recur, ...(changes.recur || {}) };
  if (newRecur.freq === 'weekly' && shift && !changes.recur?.days) {
    newRecur.days = (newRecur.days?.length ? newRecur.days : [parse(item.date).getDay()]).map((d) => (((d + shift) % 7) + 7) % 7);
  }
  const { recur: _r, date: _d, ...rest } = changes;
  const entries = [
    ['items', { id: item.id, recur: { ...item.recur, until: addDays(o.origDate, -1) } }],
    ['items', { ...item, ...rest, id: newId, date: newStartDate, recur: newRecur, exdates: (item.exdates || []).filter((d) => d >= o.origDate), createdAt: Date.now(), splitFrom: item.id }],
  ];
  // carry over per-occurrence state of future occurrences
  for (const occ of store.list('occ')) {
    if (occ.itemId === item.id && occ.date >= o.origDate) {
      const nd = addDays(occ.date, shift);
      entries.push(['occ', { id: occ.id, deleted: true }]);
      entries.push(['occ', { ...occ, id: occKey(newId, nd), itemId: newId, date: nd }]);
    }
  }
  store.putMany(entries);
}

export function deleteOccurrence(store, o, scope = 'this') {
  const item = store.get('items', o.itemId);
  if (!item) return;
  if (!item.recur || scope === 'all' || (scope === 'future' && o.origDate <= item.date)) {
    store.remove('items', item.id);
    for (const occ of store.list('occ')) if (occ.itemId === item.id) store.remove('occ', occ.id);
    return;
  }
  if (scope === 'this') {
    store.put('items', { id: item.id, exdates: [...(item.exdates || []), o.origDate] });
    store.remove('occ', occKey(item.id, o.origDate));
    return;
  }
  store.put('items', { id: item.id, recur: { ...item.recur, until: addDays(o.origDate, -1) } });
}

export function createItem(store, data) {
  return store.put('items', {
    id: uid('it'),
    status: 'todo',
    priority: 'secondaire',
    type: 'tache',
    durationMin: 0,
    createdAt: Date.now(),
    ...data,
  });
}


// Generic per-occurrence fields (e.g. workout results)
export function setOccFields(store, o, fields) {
  if (o.recurring) {
    const id = occKey(o.itemId, o.origDate);
    const prev = store.get('occ', id) || { id, itemId: o.itemId, date: o.origDate };
    store.put('occ', { ...prev, ...fields });
  } else store.put('items', { id: o.itemId, ...fields });
}
