import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/';
const OUT = process.env.OUT || '/tmp/shots';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
const routes = ['', 'jour', 'semaine', 'semaine/bilan', 'mois', 'annee', 'bilan', 'bilan?y=2026', 'parametres',
  ...['etudes', 'glowup', 'social', 'projets', 'finances', 'perso', 'sport', 'beaute', 'carriere', 'langues', 'habitudes', 'lecture'].map((s) => 'espace/' + s)];
const b = await chromium.launch();
for (const [name, vp] of [['desk', { width: 1366, height: 860 }], ['mob', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  for (const r of routes) {
    await p.goto(BASE + '#/' + r);
    await p.waitForTimeout(250);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) errs.push(`${name} ${r}: horizontal overflow ${await p.evaluate(() => document.documentElement.scrollWidth)}`);
    if (process.env.SHOTS) await p.screenshot({ path: `${OUT}/${name}-${r.replace(/[/?=]/g, '_') || 'home'}.png`, fullPage: false });
  }
  console.log(name, errs.length ? errs : 'OK');
  await ctx.close();
}
await b.close();
