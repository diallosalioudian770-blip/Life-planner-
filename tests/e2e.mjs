// End-to-end checks of the real app in a browser (desktop + iPhone size).
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'OK ' : 'ÉCHEC', name, extra]); };
const pad = (n) => String(n).padStart(2, '0');
const d0 = new Date();
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(d0);
const plus = (n) => { const d = new Date(d0); d.setDate(d.getDate() + n); return ymd(d); };

const b = await chromium.launch();
const onFail = async (e) => { console.log('ERREUR', e.message.split('\n')[0], (e.stack.match(/e2e.mjs:\d+/)||[])[0]); for (const r of results) console.log(r.join('  ')); try { await globalThis.__p?.screenshot({ path: process.env.FAILSHOT || '/tmp/fail.png' }); } catch {} process.exit(2); }; process.on('unhandledRejection', onFail); process.on('uncaughtException', onFail);
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'fr-FR' });
const p = await ctx.newPage();
globalThis.__p = p;
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const go = async (h) => { await p.goto(BASE + '#/' + h); await p.waitForTimeout(200); };
const save = () => p.getByRole('button', { name: 'Enregistrer', exact: true }).click();
const rows = () => p.locator('[data-testid=item-row]');

async function addItem({ title, date = TODAY, start, duration, category, subject, type, recur, days }) {
  await p.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
  const dlg = p.getByRole('dialog');
  await dlg.getByLabel('Nom', { exact: true }).fill(title);
  if (type) await dlg.getByLabel('Type', { exact: true }).selectOption(type);
  if (category) await dlg.getByLabel('Catégorie', { exact: true }).selectOption(category);
  if (subject) await dlg.getByLabel('Matière', { exact: true }).selectOption(subject);
  await dlg.getByLabel('Date', { exact: true }).fill(date);
  if (start) await dlg.getByLabel('Heure', { exact: true }).fill(start);
  if (duration) await dlg.getByLabel('Durée', { exact: true }).fill(String(duration));
  if (recur) await dlg.getByLabel('Répétition', { exact: true }).selectOption(recur);
  if (days) {
    for (const d of ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']) {
      const btn = dlg.getByRole('button', { name: d, exact: true });
      const on = (await btn.getAttribute('class')).includes('primary');
      if (on !== days.includes(d)) await btn.click();
    }
  }
  await save();
  await p.waitForTimeout(150);
}

// 1. ajout
await go('jour');
await addItem({ title: 'Compta chapitre 2', start: '10:00', duration: 60, category: 'etudes', subject: 'sub-compta', type: 'revision' });
ok('1. Ajout d\'une tâche', await rows().filter({ hasText: 'Compta chapitre 2' }).count() > 0);

// 2. modification
await rows().filter({ hasText: 'Compta chapitre 2' }).first().getByRole('button', { name: /Modifier/ }).click();
await p.getByRole('dialog').getByLabel('Nom', { exact: true }).fill('Compta chapitre 2 — exercices');
await save();
ok('2. Modification d\'une tâche', await rows().filter({ hasText: 'exercices' }).count() > 0);

// validation avec temps réel
await rows().filter({ hasText: 'exercices' }).first().getByRole('button', { name: /^Valider/ }).click();
await p.getByLabel('Temps réellement effectué', { exact: true }).fill('45');
await p.getByRole('dialog').getByRole('button', { name: 'Valider', exact: true }).click();
await p.waitForTimeout(150);
const summary = await p.locator('[data-testid=day-summary]').innerText();
ok('Validation : temps réel distinct du prévu', summary.includes('45 min') && summary.includes('prévu : 1 h'), summary.replace(/\n/g, ' | '));
ok('Tâche terminée listée', await p.locator('[data-testid=done-list]').getByText('exercices').count() > 0);

// 4. déplacement / report
await addItem({ title: 'Appeler la mutuelle', category: 'perso' });
await rows().filter({ hasText: 'Appeler la mutuelle' }).first().getByRole('button', { name: /Reporter/ }).click();
await p.getByRole('button', { name: 'Le lendemain' }).click();
await p.waitForTimeout(150);
ok('4. Report : la tâche quitte la journée', await rows().filter({ hasText: 'Appeler la mutuelle' }).count() === 0);
ok('4. Report : visible dans « Reportées »', await p.getByText('Reportées').count() > 0);
await go('jour?d=' + plus(1));
ok('4. Report : présente le lendemain', await rows().filter({ hasText: 'Appeler la mutuelle' }).count() === 1);

// 3. suppression
await go('jour');
await addItem({ title: 'Tâche à supprimer' });
await rows().filter({ hasText: 'Tâche à supprimer' }).getByRole('button', { name: /Supprimer/ }).click();
await p.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
await p.waitForTimeout(150);
ok('3. Suppression d\'une tâche', await rows().filter({ hasText: 'Tâche à supprimer' }).count() === 0);

// 5. récurrence
const mon = (() => { const d = new Date(d0); const wd = d.getDay(); d.setDate(d.getDate() + (wd === 0 ? -6 : 1 - wd)); return ymd(d); })();
await go('semaine');
await addItem({ title: 'Révision maths', date: mon, start: '16:00', duration: 60, category: 'etudes', subject: 'sub-maths', type: 'revision', recur: 'weekly', days: ['Lun', 'Mer', 'Ven'] });
const countBlocks = async () => p.locator('[data-testid=week-block]').filter({ hasText: 'Révision maths' }).count();
const c1 = await countBlocks();
await p.reload(); await p.waitForTimeout(400);
await p.reload(); await p.waitForTimeout(400);
const c2 = await countBlocks();
ok('5. Récurrence : 3 occurrences, pas de doublon après actualisation', c1 === 3 && c2 === 3, `${c1} puis ${c2}`);
await go(`semaine?w=${plus(7)}`);
ok('5. Récurrence : semaine suivante aussi', await countBlocks() === 3);
// modifier uniquement cette occurrence (mercredi)
await go('jour?d=' + plus(0) /* placeholder */);
const wed = (() => { const d = new Date(mon + 'T12:00'); d.setDate(d.getDate() + 2); return ymd(d); })();
await go('jour?d=' + wed);
await rows().filter({ hasText: 'Révision maths' }).getByRole('button', { name: /Modifier/ }).click();
await p.getByRole('dialog').getByLabel('Heure', { exact: true }).fill('18:30');
await save();
await p.getByRole('button', { name: 'Uniquement cette occurrence' }).click();
await p.waitForTimeout(150);
await go('semaine?w=' + mon);
const times = await p.locator('[data-testid=week-block]').filter({ hasText: 'Révision maths' }).allInnerTexts();
ok('5. Modifier une seule occurrence', times.filter((t) => t.includes('18:30')).length === 1 && times.filter((t) => t.includes('16:00')).length === 2, times.join(' / '));
// supprimer les suivantes (depuis vendredi)
const fri = (() => { const d = new Date(mon + 'T12:00'); d.setDate(d.getDate() + 4); return ymd(d); })();
await go('jour?d=' + fri);
await rows().filter({ hasText: 'Révision maths' }).getByRole('button', { name: /Supprimer/ }).click();
await p.getByRole('button', { name: 'Cette occurrence et toutes les suivantes' }).click();
await go('semaine?w=' + mon);
const c3 = await countBlocks();
await go(`semaine?w=${plus(7)}`);
ok('5. Supprimer les occurrences futures', c3 === 2 && (await countBlocks()) === 0, `${c3}`);

// 6. vues + glisser-déposer
await go('semaine');
await addItem({ title: 'Cours économie', date: mon, start: '09:00', duration: 120, category: 'etudes', subject: 'sub-eco', type: 'cours' });
const block = p.locator('[data-testid=week-block]').filter({ hasText: 'Cours économie' });
const box = await block.boundingBox();
const grid = await p.locator('[data-testid=week-grid]').boundingBox();
const colW = (grid.width - 52) / 7;
await p.mouse.move(box.x + 20, box.y + 10);
await p.mouse.down();
await p.mouse.move(box.x + 20 + colW / 2, box.y + 30, { steps: 5 });
await p.mouse.move(box.x + 20 + colW, box.y + 10 + 46, { steps: 5 });
await p.mouse.up();
await p.waitForTimeout(200);
const tue = (() => { const d = new Date(mon + 'T12:00'); d.setDate(d.getDate() + 1); return ymd(d); })();
await go('jour?d=' + tue);
const moved = await rows().filter({ hasText: 'Cours économie' }).innerText().catch(() => '');
ok('6. Glisser-déposer dans la semaine (jour + horaire)', moved.includes('10:00'), moved.replace(/\n/g, ' '));
await go('mois');
ok('6. Vue mois affiche les activités', await p.locator('[data-testid=month-grid]').getByText('Cours économie').count() > 0);
await go('annee');
ok('6. Vue année', await p.locator('[data-testid=year-grid] .mini-month').count() === 12);
await go('annee?y=2031');
ok('6. Année au choix (2031)', (await p.locator('h1').innerText()).includes('2031'));

// 7-8. statistiques et bilan hebdo
await go('semaine/bilan');
const sumText = await p.locator('[data-testid=smart-summary]').innerText();
ok('7. Statistiques : heures réelles dans le bilan', /0,8 h|45 min/.test(await p.locator('body').innerText()), sumText.split('\n')[0]);
ok('8. Bilan : tâches non réalisées proposées', await p.locator('[data-testid=unfinished]').getByText('Révision maths').count() > 0);
await p.getByPlaceholder(/Ce qui a bien marché/).fill('Bonne semaine test');
await p.getByRole('button', { name: 'Enregistrer le bilan' }).click();
await p.reload(); await p.waitForTimeout(400);
ok('8. Bilan enregistré et conservé après actualisation', (await p.getByPlaceholder(/Ce qui a bien marché/).inputValue()) === 'Bonne semaine test' && await p.getByText('Oui').count() > 0);

// 9. bilan mensuel
await go('bilan');
ok('9. Bilan mensuel', await p.getByText('Réussites').count() > 0 && await p.getByText('Progression universitaire').count() > 0);

// 10. sauvegarde (persistance)
await p.close();
const p2 = await ctx.newPage(); globalThis.__p = p2;
await p2.goto(BASE + '#/jour'); await p2.waitForTimeout(500);
ok('10. Données conservées après fermeture/réouverture', await p2.locator('[data-testid=item-row]').filter({ hasText: 'exercices' }).count() > 0);
// tâche terminée garde son statut
ok('Tâche terminée conserve son statut', await p2.locator('[data-testid=done-list]').getByText('exercices').count() > 0);

// 13. thème
await p2.goto(BASE + '#/parametres'); await p2.waitForTimeout(300);
await p2.getByRole('radio', { name: 'Sombre', exact: true }).click();
await p2.waitForTimeout(200);
const th = await p2.evaluate(() => document.documentElement.dataset.theme);
await p2.reload(); await p2.waitForTimeout(400);
const th2 = await p2.evaluate(() => document.documentElement.dataset.theme);
ok('13. Changement de thème (et conservé)', th === 'dark' && th2 === 'dark');
await p2.getByRole('radio', { name: 'Clair', exact: true }).click();

// 14. catégories
await p2.getByLabel('Nouvelle catégorie', { exact: true }).fill('Bénévolat');
await p2.getByLabel('Nouvelle catégorie', { exact: true }).press('Enter');
await p2.waitForTimeout(200);
ok('14. Ajout de catégorie (navigation)', await p2.locator('.sidebar').getByText('Bénévolat').count() === 1);
await p2.locator('.sidebar').getByText('Bénévolat').click();
await p2.waitForTimeout(200);
ok('14. Espace de la nouvelle catégorie', (await p2.locator('h1').innerText()).includes('Bénévolat'));

// finances
await p2.goto(BASE + '#/espace/finances'); await p2.waitForTimeout(300);
ok('Finances : pas de solde inventé', await p2.getByRole('button', { name: 'Renseigner mon solde' }).count() === 1);
await p2.getByRole('button', { name: 'Renseigner mon solde' }).click();
await p2.getByLabel('Solde actuel', { exact: true }).fill('100');
await p2.getByLabel('Solde actuel', { exact: true }).blur();
await p2.getByRole('tab', { name: 'Tableau de bord' }).click();
await p2.getByLabel('Montant', { exact: true }).fill('20');
await p2.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await p2.waitForTimeout(200);
const fin = await p2.locator('[data-testid=finance-stats]').innerText();
ok('Finances : solde calculé automatiquement', fin.includes('80,00'), fin.replace(/\n/g, ' | '));

// habitudes
await p2.goto(BASE + '#/espace/habitudes'); await p2.waitForTimeout(300);
await p2.getByRole('button', { name: 'Habitude', exact: true }).click();
await p2.getByLabel("Nom de l'habitude").fill('Lire 10 pages');
await p2.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await p2.getByRole('button', { name: `Lire 10 pages le ${TODAY}` }).click();
await p2.waitForTimeout(150);
ok('Habitudes : ajout et validation du jour', (await p2.locator('[data-testid=habit-table]').innerText()).includes('1 j'));

// suggestions
await p2.goto(BASE + '#/espace/etudes'); await p2.waitForTimeout(300);
await p2.getByRole('tab', { name: 'Révisions' }).click();
await p2.getByLabel('Objectif Comptabilité et diagnostic financier', { exact: true }).fill('240');
await p2.getByLabel('Objectif Comptabilité et diagnostic financier', { exact: true }).blur();
await p2.goto(BASE + '#/semaine?w=' + plus(7)); await p2.waitForTimeout(300);
const before = await p2.locator('[data-testid=week-block]').count();
await p2.getByRole('button', { name: 'Proposer mes révisions' }).click();
await p2.waitForTimeout(200);
const nSugg = await p2.locator('[data-testid=suggestion]').count();
const afterOpen = await p2.locator('[data-testid=week-block]').count();
await p2.locator('[data-testid=suggestion]').first().getByRole('button', { name: 'Refuser' }).click();
await p2.locator('[data-testid=suggestion]').first().getByRole('button', { name: 'Accepter' }).click();
await p2.getByRole('button', { name: 'Terminer' }).click();
await p2.waitForTimeout(200);
const after = await p2.locator('[data-testid=week-block]').count();
ok('Suggestions : proposées sans rien modifier, puis acceptées une à une', nSugg > 0 && afterOpen === before && after === before + 1, `${nSugg} propositions, ${before}→${after}`);

if (process.env.SHOTDIR) for (const r of ['', 'jour', 'semaine', 'semaine/bilan', 'mois', 'annee', 'espace/etudes', 'espace/finances', 'espace/habitudes']) { await p2.goto(BASE + '#/' + r); await p2.waitForTimeout(300); await p2.screenshot({ path: `${process.env.SHOTDIR}/d-${r.replace(/\//g, '_') || 'home'}.png` }); }
console.log('Erreurs JS (bureau) :', errors.length ? errors : 'aucune');

// 12. mobile (iPhone)
const m = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
const mp = await m.newPage();
const merr = [];
mp.on('pageerror', (e) => merr.push(e.message));
await mp.goto(BASE + '#/'); await mp.waitForTimeout(400);
ok('12. Mobile : barre de navigation du bas', await mp.locator('.bottom-nav').isVisible());
await mp.getByRole('button', { name: 'Ajouter une activité' }).tap();
await mp.getByRole('dialog').getByLabel('Nom', { exact: true }).fill('Tâche iPhone');
await mp.getByRole('button', { name: 'Enregistrer', exact: true }).tap();
await mp.locator('.bottom-nav').getByText('Journée').tap();
await mp.waitForTimeout(300);
ok('12. Mobile : ajout depuis le bouton +', await mp.locator('[data-testid=item-row]').filter({ hasText: 'Tâche iPhone' }).count() === 1);
const btnH = await mp.locator('[data-testid=item-row] .check').first().boundingBox();
ok('12. Mobile : cases à cocher assez grandes', btnH.height >= 26, `${btnH.height}px`);
const over = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
ok('12. Mobile : pas de débordement horizontal', !over);
await mp.locator('.bottom-nav').getByText('Plus').tap();
ok('12. Mobile : menu des espaces', await mp.getByRole('link', { name: 'Études & révisions' }).isVisible());
console.log('Erreurs JS (mobile) :', merr.length ? merr : 'aucune');

if (process.env.SHOTDIR) for (const r of ['', 'jour', 'semaine', 'mois']) { await mp.goto(BASE + '#/' + r); await mp.waitForTimeout(300); await mp.screenshot({ path: `${process.env.SHOTDIR}/m-${r || 'home'}.png` }); }
await b.close();
for (const r of results) console.log(r.join('  '));
const failed = results.filter((r) => r[0] !== 'OK ').length;
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
process.exit(failed ? 1 : 0);
