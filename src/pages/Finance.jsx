import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, PiggyBank, Wallet, Settings2 } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { financeStats, euro } from '../lib/stats.js';
import { today, startOfMonth, endOfMonth, addMonths, fmtMonth, fmtShort, monthKey, MONTHS, parse } from '../lib/date.js';
import { PageHead, Field, Empty, Progress, useSettings, toast, Tabs, useLocalState } from '../components/ui.jsx';
import { HBars, PlanActualChart } from '../components/charts.jsx';
import { ListBlock, GoalsBlock } from '../components/blocks.jsx';

const TX_TYPES = [['expense', 'Dépense'], ['income', 'Revenu'], ['saving', 'Mise en épargne'], ['withdraw', "Retrait d'épargne"]];

function FinanceSettings() {
  const settings = useSettings();
  const fin = settings.finance || {};
  const upd = (p) => store.put('settings', { id: 'main', finance: { ...fin, ...p } });
  const [newCat, setNewCat] = useState('');
  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><h3><Settings2 size={18} />Mon point de départ</h3></div>
        <p className="small muted mb">Ton solde n'est jamais inventé : indique-le toi-même, puis toutes les opérations saisies à partir de cette date le mettent à jour automatiquement.</p>
        <div className="form-grid">
          <Field label="Solde actuel (€)"><input className="input" type="number" step="0.01" defaultValue={fin.initialBalance ?? ''} onBlur={(e) => upd({ initialBalance: e.target.value === '' ? null : Number(e.target.value), initialBalanceDate: fin.initialBalanceDate || today() })} aria-label="Solde actuel" /></Field>
          <Field label="À la date du"><input className="input" type="date" defaultValue={fin.initialBalanceDate || ''} onBlur={(e) => upd({ initialBalanceDate: e.target.value || null })} aria-label="Date du solde" /></Field>
          <Field label="Budget mensuel (€)"><input className="input" type="number" step="1" defaultValue={fin.monthlyBudget ?? ''} onBlur={(e) => upd({ monthlyBudget: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Budget mensuel" /></Field>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>Limites de dépenses par catégorie (par mois)</h3></div>
        <div className="grid g2">
          {(fin.categories || []).map((c) => (
            <div key={c} className="row">
              <span className="small" style={{ flex: 1 }}>{c}</span>
              <input className="input" style={{ width: 110 }} type="number" placeholder="—" defaultValue={fin.limits?.[c] ?? ''} onBlur={(e) => upd({ limits: { ...(fin.limits || {}), [c]: e.target.value === '' ? null : Number(e.target.value) } })} aria-label={`Limite ${c}`} />
              <button className="btn ghost icon sm" aria-label={`Supprimer la catégorie ${c}`} onClick={() => upd({ categories: fin.categories.filter((x) => x !== c) })}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <form className="row mt" onSubmit={(e) => { e.preventDefault(); if (!newCat.trim()) return; upd({ categories: [...(fin.categories || []), newCat.trim()] }); setNewCat(''); }}>
          <input className="input" style={{ maxWidth: 260 }} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie de dépense" />
          <button className="btn"><Plus size={15} />Ajouter</button>
        </form>
      </div>
    </div>
  );
}

function SavingsGoals() {
  useStore();
  const goals = store.list('savings');
  const tx = store.list('transactions');
  const [f, setF] = useState({ name: '', target: '' });
  return (
    <div className="card">
      <div className="card-head"><h3><PiggyBank size={18} />Objectifs d'épargne</h3></div>
      {goals.length ? (
        <div className="stack-sm mb">
          {goals.map((g) => {
            const saved = tx.filter((t) => t.goalId === g.id).reduce((s, t) => s + (t.type === 'saving' ? 1 : t.type === 'withdraw' ? -1 : 0) * Number(t.amount), 0);
            return (
              <div key={g.id}>
                <div className="row between small"><span>{g.name}</span><span className="row" style={{ gap: 4 }}><span className="muted">{euro(saved)}{g.target ? ` / ${euro(g.target)}` : ''}</span><button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('savings', g.id)}><Trash2 size={13} /></button></span></div>
                {g.target ? <Progress value={saved / g.target} color="var(--gold)" /> : null}
              </div>
            );
          })}
        </div>
      ) : <p className="small muted mb">Crée un objectif, puis ajoute des opérations « Mise en épargne » qui lui sont liées.</p>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) return; store.put('savings', { name: f.name.trim(), target: f.target === '' ? null : Number(f.target) }); setF({ name: '', target: '' }); }}>
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Fonds d'urgence" aria-label="Nom de l'objectif d'épargne" />
        <input className="input" style={{ width: 110 }} type="number" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Cible €" aria-label="Montant cible" />
        <button className="btn icon primary" aria-label="Ajouter l'objectif"><Plus size={16} /></button>
      </form>
    </div>
  );
}

export default function Finance({ cat }) {
  const [tab, setTab] = useLocalState('fin-tab', 'dash');
  const [ref, setRef] = useState(today());
  const settings = useSettings();
  const fin = settings.finance || {};
  useStore();
  const from = startOfMonth(ref);
  const to = endOfMonth(ref);
  const s = financeStats(store, from, to);
  const tx = store.list('transactions').filter((t) => t.date >= from && t.date <= to).sort((a, b) => (a.date < b.date ? 1 : -1));
  const savings = store.list('savings');
  const [f, setF] = useState({ type: 'expense', amount: '', category: fin.categories?.[0] || 'Autres', label: '', date: today(), goalId: '' });
  const add = (e) => {
    e.preventDefault();
    const amount = Number(String(f.amount).replace(',', '.'));
    if (!amount || amount <= 0) { toast('Indique un montant positif.'); return; }
    store.put('transactions', { ...f, amount, category: f.type === 'expense' ? f.category : f.type === 'saving' ? 'Épargne' : null, goalId: f.goalId || null, createdAt: Date.now() });
    setF({ ...f, amount: '', label: '' });
    toast('Opération enregistrée.');
  };
  const budget = fin.monthlyBudget;
  const hist = Array.from({ length: 6 }, (_, i) => addMonths(from, i - 5)).map((m) => { const x = financeStats(store, m, endOfMonth(m)); return { label: MONTHS[parse(m).getMonth()].slice(0, 3), a: x.income, b: x.expense }; });

  return (
    <div>
      <PageHead eyebrow="Indépendance" title={<span className="row"><Wallet size={26} style={{ color: cat.color }} />{cat.name}</span>}>
        <Tabs tabs={[['dash', 'Tableau de bord'], ['reglages', 'Réglages'], ['objectifs', 'Objectifs']]} value={tab} onChange={setTab} />
      </PageHead>
      {tab === 'reglages' && <FinanceSettings />}
      {tab === 'objectifs' && <div className="grid g2"><SavingsGoals /><GoalsBlock categoryId="finances" title="Objectifs financiers" /></div>}
      {tab === 'dash' && (
        <div className="stack">
          <div className="row wrap">
            <button className="btn icon" aria-label="Mois précédent" onClick={() => setRef(addMonths(from, -1))}><ChevronLeft size={18} /></button>
            <strong style={{ textTransform: 'capitalize' }}>{fmtMonth(from)}</strong>
            <button className="btn icon" aria-label="Mois suivant" onClick={() => setRef(addMonths(from, 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="grid g4" data-testid="finance-stats">
            <div className="card stat"><span className="stat-label">Solde actuel</span>{s.balance == null ? <button className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setTab('reglages')}>Renseigner mon solde</button> : <span className="stat-value">{euro(s.balance)}</span>}</div>
            <div className="card stat"><span className="stat-label">Revenus du mois</span><span className="stat-value">{euro(s.income)}</span></div>
            <div className="card stat"><span className="stat-label">Dépenses du mois</span><span className="stat-value">{euro(s.expense)}</span>{budget ? <><Progress value={s.expense / budget} color={s.expense > budget ? 'var(--danger)' : 'var(--gold)'} /><span className="xs muted">{s.expense > budget ? `Dépassement de ${euro(s.expense - budget)}` : `Reste ${euro(budget - s.expense)}`} sur {euro(budget)}</span></> : <span className="xs muted">Pas de budget défini</span>}</div>
            <div className="card stat"><span className="stat-label">Épargne totale</span><span className="stat-value">{euro(s.savedTotal)}</span><span className="xs muted">ce mois : {euro(s.saving)}</span></div>
          </div>
          <div className="grid cols-2-1">
            <div className="card">
              <div className="card-head"><h3>Opérations du mois</h3><span className="chip">{tx.length}</span></div>
              {tx.length ? (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th style={{ textAlign: 'right' }}>Montant</th><th /></tr></thead>
                  <tbody>{tx.map((t) => (
                    <tr key={t.id}>
                      <td className="nowrap">{fmtShort(t.date)}</td>
                      <td>{t.label || TX_TYPES.find((x) => x[0] === t.type)?.[1]}</td>
                      <td className="small muted">{t.type === 'expense' ? t.category : TX_TYPES.find((x) => x[0] === t.type)?.[1]}{t.goalId ? ` · ${savings.find((g) => g.id === t.goalId)?.name || ''}` : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: t.type === 'income' || t.type === 'withdraw' ? 'var(--ok)' : undefined }} className="nowrap">{t.type === 'income' || t.type === 'withdraw' ? '+' : '−'} {euro(t.amount)}</td>
                      <td><button className="btn ghost icon sm" aria-label="Supprimer l'opération" onClick={() => store.remove('transactions', t.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ) : <Empty title="Aucune opération">Ajoute tes revenus et dépenses : les totaux se calculent automatiquement.</Empty>}
            </div>
            <form className="card" onSubmit={add}>
              <div className="card-head"><h3>Nouvelle opération</h3></div>
              <div className="form-grid">
                <Field label="Type" full><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Type d'opération">{TX_TYPES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
                <Field label="Montant (€)"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label="Montant" /></Field>
                <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
                {f.type === 'expense' && <Field label="Catégorie" full><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Catégorie de dépense">{(fin.categories || []).map((c) => <option key={c}>{c}</option>)}</select></Field>}
                {(f.type === 'saving' || f.type === 'withdraw') && <Field label="Objectif d'épargne" full><select className="input" value={f.goalId} onChange={(e) => setF({ ...f, goalId: e.target.value })}><option value="">—</option>{savings.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
                <Field label="Libellé" full><input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ex. Courses Delhaize" /></Field>
              </div>
              <button className="btn primary mt" style={{ width: '100%' }}><Plus size={15} />Enregistrer</button>
            </form>
          </div>
          <div className="grid g2">
            <div className="card"><div className="card-head"><h3>Dépenses par catégorie</h3></div>
              {Object.keys(s.byCategory).length ? <HBars data={Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v, extra: fin.limits?.[l] ? `/ ${euro(fin.limits[l])}` : '', barColor: fin.limits?.[l] && v > fin.limits[l] ? 'var(--danger)' : 'var(--gold)' }))} format={euro} /> : <Empty>Aucune dépense ce mois-ci.</Empty>}
            </div>
            <div className="card"><div className="card-head"><h3>Historique sur 6 mois</h3></div>
              <PlanActualChart groups={hist} labels={['Revenus', 'Dépenses']} format={(v) => `${Math.round(v)}€`} />
            </div>
          </div>
          <ListBlock space="achats" title="Envies d'achat / achats à suivre" placeholder="Ex. Calculatrice financière" withDate />
        </div>
      )}
    </div>
  );
}
void monthKey;
