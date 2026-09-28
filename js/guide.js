/* CoTribu — guide de démarrage et « Premiers pas » */

const GUIDE = [
  {ic:'house', u:'u-home', t:'Bienvenue dans CoTribu', s:'Le quotidien de la famille, partagé. Voici l’essentiel en une minute : tu pourras revoir ce guide à tout moment dans Plus.'},
  {ic:'sun', u:'u-shop', t:'Aujourd’hui', s:'Tout ce qui compte aujourd’hui sur un seul écran : les tâches, le planning, le repas, les courses. Le bouton + permet d’ajouter n’importe quoi, n’importe où.'},
  {ic:'circle-check', u:'u-home', t:'Maison', s:'Les tâches sont rangées par pièce et reviennent toutes seules (chaque mardi, une semaine sur deux, le 1er dimanche du mois…). Quand quelqu’un coche, toute la famille le voit. On peut aussi faire « chacun son tour ».'},
  {ic:'shopping-cart', u:'u-shop', t:'Courses', s:'Écris « 6 bananes » ou « lait » : l’article se range tout seul dans son rayon. Au magasin, coche ce que tu prends, les autres le voient en direct.'},
  {ic:'calendar-days', u:'u-plan', t:'Planning', s:'Rendez-vous, activités, anniversaires : une couleur par catégorie, et un rappel une heure avant sur le téléphone de chacun.'},
  {ic:'users', u:'u-lav', t:'Toute la tribu', s:'Dans Plus : les proches (grand-mère, nounou) à qui demander une garde, les points et récompenses des enfants, la charge mentale, les souvenirs et les repas.'},
  {ic:'sparkles', u:'u-warm', t:'Pour bien démarrer', s:'Sur l’accueil, la carte « Premiers pas » te guide : qui es-tu, ta photo, inviter la famille, activer les rappels… Deux minutes et c’est prêt.'},
];
function guideOpen(){ S.guide = 0; guideRender(); }
function guideClose(){ LS.set('cotribu-guide-done', '1'); S.guide = null; const g = document.getElementById('guide'); if (g) g.remove(); render(); }
function guideRender(){
  let g = document.getElementById('guide');
  if (S.guide == null) { if (g) g.remove(); return; }
  if (!g) {
    g = document.createElement('div'); g.id = 'guide'; g.setAttribute('role','dialog'); g.setAttribute('aria-modal','true'); document.body.appendChild(g);
    let x0 = null;
    g.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
    g.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (dx < -50 && S.guide < GUIDE.length - 1) { S.guide++; guideRender(); } else if (dx > 50 && S.guide > 0) { S.guide--; guideRender(); } });
  }
  const i = S.guide, st = GUIDE[i], last = i === GUIDE.length - 1;
  g.innerHTML = `<div class="gcard ${st.u}">
    <button class="gskip" data-act="guideClose">${last ? '' : 'Passer'}</button>
    <div class="gart"><span>${icon(st.ic, 64)}</span></div>
    <h1>${esc(st.t)}</h1><p>${esc(st.s)}</p>
    <div class="gdots">${GUIDE.map((_,k) => `<i class="${k===i?'on':''}"></i>`).join('')}</div>
    <div class="actions">${i ? `<button class="btn soft" data-act="guidePrev">Retour</button>` : ''}<button class="btn deep" data-act="${last ? 'guideClose' : 'guideNext'}">${last ? 'C’est parti !' : 'Suivant'}</button></div>
  </div>`;
}
// premier lancement : le guide s'ouvre une fois le foyer chargé
AFTER.push(() => {
  if (S.guide == null && S.role === 'member' && S.loaded && !LS.get('cotribu-guide-done') && !S.guideShown) { S.guideShown = true; setTimeout(guideOpen, 300); }
});

/* ---------- Premiers pas ---------- */
function firstSteps(){
  const me = S.me && S.members.get(S.me);
  const anyDone = [...S.tasks.values()].some(t => t.lastDone);
  return [
    ['me', 'Dire qui je suis sur ce téléphone', !!me, 'stepMe'],
    ['photo', 'Mettre ma photo', !!(me && me.photo), 'stepPhoto'],
    ['invite', 'Inviter la famille', !!LS.get('cotribu-shared'), 'stepInvite'],
    ['push', 'Activer les rappels', S.push && S.push.state === 'on', 'stepPush'],
    ['install', 'Installer l’app sur l’écran d’accueil', isStandalone(), 'stepInstall'],
    ['task', 'Cocher ma première tâche', anyDone, 'stepTask'],
  ];
}
function firstStepsCard(){
  if (LS.get('cotribu-steps-hidden')) return '';
  const steps = firstSteps(), done = steps.filter(s => s[2]).length;
  if (done === steps.length) return '';
  return `<div class="card u-home"><div class="row"><span class="bubble">${icon('sparkles',18)}</span><div style="flex:1"><h3>Premiers pas</h3><span class="muted small num">${done} sur ${steps.length} · deux minutes pour bien démarrer</span></div>
      <button class="x" style="border:0;background:none;color:var(--muted)" data-act="stepsHide" aria-label="Masquer">${icon('x',18)}</button></div>
    <span class="pbar"><b style="width:${Math.round(done/steps.length*100)}%"></b></span>
    <div class="mini">${steps.map(([k,l,ok,act]) => `<div class="task ${ok?'done':''}"><span class="check" aria-hidden="true">${checkIc()}</span>
      <span class="body"><span class="name" style="${ok?'':'font-weight:600'}">${esc(l)}</span></span>${ok ? '' : `<button class="btn ghost sm" data-act="${act}">Faire</button>`}</div>`).join('')}</div>
    <button class="btn ghost sm" data-act="guideOpen">Revoir le guide</button></div>`;
}
const goFoyer = () => { if (S.sheet) closeSheet(); S.tab = 'plus'; goSub(() => { S.sub.plus = 'foyer'; }); };
Object.assign(H, {
  guideOpen: () => guideOpen(),
  guideNext: () => { S.guide = Math.min(GUIDE.length - 1, S.guide + 1); guideRender(); },
  guidePrev: () => { S.guide = Math.max(0, S.guide - 1); guideRender(); },
  guideClose: () => guideClose(),
  stepsHide: () => { LS.set('cotribu-steps-hidden', '1'); render(); },
  stepMe: () => { window.scrollTo(0,0); const c = document.querySelector('[data-act="me"]'); if (c) c.scrollIntoView({behavior:'smooth', block:'center'}); else goFoyer(); },
  stepPhoto: () => { if (!S.me) { toast('Dis d’abord qui tu es.'); return; } const m = S.members.get(S.me); S.draft = {...clone(m), _old: m.photo || null}; openSheet('memberEdit'); },
  stepInvite: () => { LS.set('cotribu-shared', '1'); shareInvite(); setTimeout(render, 500); },
  stepPush: () => { if (!S.me) { toast('Dis d’abord qui tu es.'); return; } enablePush(); },
  stepInstall: () => { if (installEvt) H.install(); else { S.tab = 'plus'; S.sub.plus = null; render(); window.scrollTo(0,0); } },
  stepTask: () => { S.tab = 'maison'; S.sub.maison = 'jour'; render(); window.scrollTo(0,0); },
});
// l'invitation partagée depuis Foyer compte aussi
const _share = H.share; H.share = el => { LS.set('cotribu-shared', '1'); _share(el); };
