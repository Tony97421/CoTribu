/* CoTribu — points et récompenses */

const taskPoints = t => (t && t.points != null) ? +t.points : 1;
const weekStart = () => mondayOf(localToday());
function memberPts(m){ return m && m.points ? +m.points : 0; }
function weekPts(m){
  const from = weekStart();
  return (m && m.history || []).filter(h => h.d >= from && (h.t === 'task' || h.t === 'bonus')).reduce((a,h) => a + (+h.pts||0), 0);
}
function pushHistory(m, entry){
  m.history = [entry, ...(m.history || [])].slice(0, 150);
  m.points = Math.max(0, memberPts(m) + (+entry.pts||0));
}
function addTaskPoints(who, t, day){
  const m0 = S.members.get(who); const pts = taskPoints(t); if (!m0 || !pts) return;
  const m = clone(m0);
  pushHistory(m, {t:'task', pts, d:day, at:new Date().toISOString(), label:t.name, taskId:t.id});
  put('members', m);
  setTimeout(() => toast(`+${pts} point${pts>1?'s':''} pour ${m.name}`), 30);
}
function removeTaskPoints(who, t, day){
  const m0 = S.members.get(who); if (!m0) return;
  const m = clone(m0);
  const i = (m.history || []).findIndex(h => h.t === 'task' && h.taskId === t.id && h.d === day);
  if (i < 0) return;
  const [h] = m.history.splice(i, 1);
  m.points = Math.max(0, memberPts(m) - (+h.pts||0));
  put('members', m);
}

const REWARD_IDEAS = [
  ['Choisir le dessert', 10, 'cake'], ['30 min d’écran en plus', 20, 'star'], ['Choisir le film du soir', 25, 'sparkles'],
  ['1 € d’argent de poche', 15, 'gift'], ['Soirée pyjama', 60, 'bed-double'], ['Sortie cinéma', 100, 'party-popper'],
];

function viewPoints(){
  const ms = sorted(S.members);
  let h = backBtn('Plus') + ptitle('Points et récompenses', 'Chaque tâche faite rapporte des points à échanger contre des récompenses.');
  // champions de la semaine
  const ranked = ms.map(m => ({m, w: weekPts(m)})).sort((a,b) => b.w - a.w);
  const max = Math.max(1, ...ranked.map(x => x.w));
  h += `<div class="card u-shop"><div class="row"><span class="bubble">${icon('star',18)}</span><h3 style="flex:1">Cette semaine</h3><span class="muted small">depuis lundi</span></div>
    <div class="bars">${ranked.map((x,i) => `<div class="barrow"><span class="n">${i===0 && x.w ? '★ ' : ''}${esc(x.m.name)}</span><span class="track"><b style="width:${Math.round(x.w/max*100)}%;background:${memberColor(x.m)}"></b></span><span class="v">${x.w}</span></div>`).join('')}</div>
    ${ranked[0] && ranked[0].w ? `<span class="small">Bravo ${esc(ranked[0].m.name)} ! Toute la tribu avance ensemble.</span>` : '<span class="muted small">Coche des tâches pour gagner tes premiers points.</span>'}</div>`;
  // soldes
  h += `<h2>Les cagnottes</h2><div class="grid2">${ms.map(m => `<div class="card" style="align-items:center;text-align:center;gap:8px">
      ${avatar(m.id,'lg')}<strong>${esc(m.name)}</strong>
      <span style="font-family:var(--display);font-size:30px;line-height:1" class="num">${memberPts(m)}</span><span class="muted small">points</span>
      <div class="row" style="gap:6px"><button class="btn soft sm" data-act="ptsBonus" data-id="${m.id}">Bonus</button><button class="btn ghost sm" data-act="ptsHistory" data-id="${m.id}">Détail</button></div></div>`).join('')}</div>`;
  // récompenses
  const rw = sorted(S.rewards);
  h += `<div class="row"><h2 style="flex:1">Récompenses</h2><button class="btn upri sm u-shop" data-act="rewardNew">${icon('plus',16)}Ajouter</button></div>`;
  if (!rw.length) h += `<div class="empty"><span class="muted">Décidez ensemble de ce que les points permettent d’obtenir.</span><button class="btn upri u-shop" data-act="rewardIdeas">${icon('sparkles',18)}Ajouter des idées de récompenses</button></div>`;
  else h += `<div class="card" style="padding:4px 16px">${rw.map(r => `<div class="lrow" style="padding-left:0;padding-right:0"><span class="bubble sm u-shop">${icon(r.icon||'gift',16)}</span>
      <span class="body" data-act="rewardEdit" data-id="${r.id}" role="button" tabindex="0"><span class="t">${esc(r.name)}</span><span class="s num">${r.cost} points</span></span>
      <button class="btn deep sm" data-act="rewardRedeem" data-id="${r.id}">Échanger</button></div>`).join('')}</div>`;
  h += `<span class="info">Les points s’ajoutent quand une tâche est cochée, et s’enlèvent si on la décoche. Le nombre de points de chaque tâche se règle dans la tâche (Maison).</span>`;
  return h;
}

SHEETS.reward = () => { const d = S.draft; return `<h2>${d.id ? 'Modifier la récompense' : 'Nouvelle récompense'}</h2>
  <label class="f" for="rw-name">Récompense<input type="text" id="rw-name" data-ch="rwName" value="${esc(d.name)}" placeholder="Ex. Choisir le dessert"></label>
  <label class="f" for="rw-cost">Coût en points<input type="number" id="rw-cost" data-ch="rwCost" min="1" max="10000" value="${esc(d.cost)}" inputmode="numeric"></label>
  <div class="sect"><span class="eyebrow">Icône</span><div class="chips u-shop">${['gift','star','cake','sparkles','party-popper','bed-double','book-open','bike','pizza','music'].map(ic => `<button class="chip sq" data-act="rwIcon" data-v="${ic}" aria-pressed="${d.icon===ic}">${icon(ic,18)}</button>`).join('')}</div></div>
  <div class="actions"><button class="btn primary" data-act="rewardSave">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>
  ${d.id ? `<button class="btn danger ${S.armed==='rw'?'armed':''}" data-act="rewardDel">${S.armed==='rw'?'Confirmer la suppression':'Supprimer'}</button>` : ''}`; };

SHEETS.redeem = () => { const r = S.rewards.get(S.draft.rid); if (!r) return ''; const ms = sorted(S.members);
  return `<h2>${esc(r.name)}</h2><span class="muted num">${r.cost} points</span>
  <div class="sect"><span class="eyebrow">Qui échange ses points ?</span><div class="chips u-shop">${ms.map(m => { const ok = memberPts(m) >= r.cost; return `<button class="chip" data-act="redeemWho" data-id="${m.id}" aria-pressed="${S.draft.who===m.id}" ${ok?'':'disabled style="opacity:.45"'}>${avatar(m.id)}${esc(m.name)} · ${memberPts(m)}</button>`; }).join('')}</div>
  ${ms.every(m => memberPts(m) < r.cost) ? '<span class="info">Personne n’a encore assez de points. Courage !</span>' : ''}</div>
  <div class="actions"><button class="btn deep" data-act="redeemGo" ${S.draft.who?'':'disabled'}>${icon('gift',18)}Valider l’échange</button><button class="btn soft" data-act="close">Annuler</button></div>`; };

SHEETS.bonus = () => { const m = S.members.get(S.draft.mid); if (!m) return '';
  return `<h2>Points pour ${esc(m.name)}</h2>
  <div class="chips u-shop">${[1,2,5,10,-5].map(n => `<button class="chip sq" data-act="bonusPts" data-v="${n}" aria-pressed="${S.draft.pts===n}">${n>0?'+':''}${n}</button>`).join('')}</div>
  <label class="f" for="bn-why">Pourquoi<input type="text" id="bn-why" data-ch="bnWhy" value="${esc(S.draft.why||'')}" placeholder="Ex. Bravo pour ton contrôle, a aidé sans qu’on demande"></label>
  <div class="actions"><button class="btn deep" data-act="bonusGo">Donner</button><button class="btn soft" data-act="close">Annuler</button></div>`; };

SHEETS.ptsHistory = () => { const m = S.members.get(S.draft.mid); if (!m) return '';
  const hist = (m.history||[]).slice(0,60);
  return `<h2>${esc(m.name)} · <span class="num">${memberPts(m)}</span> points</h2>
  ${hist.length ? `<div class="card" style="padding:4px 16px">${hist.map(x => `<div class="lrow" style="padding-left:0;padding-right:0;min-height:48px"><span class="body"><span class="t">${esc(x.label || (x.t==='bonus'?'Bonus':'Tâche'))}</span><span class="s">${esc(fmtShort(x.d))}${x.t==='reward'?' · récompense':x.t==='bonus'?' · bonus':''}</span></span>
    <span class="num" style="font-weight:700;color:${x.pts<0?'var(--late-text)':'var(--done)'}">${x.pts>0?'+':''}${x.pts}</span></div>`).join('')}</div>` : '<span class="muted">Pas encore de points.</span>'}
  <button class="btn soft" data-act="close">Fermer</button>`; };

Object.assign(H, {
  rewardNew: () => { S.draft = {id:null, name:'', cost:20, icon:'gift'}; openSheet('reward'); },
  rewardEdit: el => { const r = S.rewards.get(el.dataset.id); if (!r) return; S.draft = clone(r); openSheet('reward'); },
  rwIcon: el => { S.draft.icon = el.dataset.v; renderSheet(); },
  rewardSave: () => { const d = S.draft; const name = (d.name||'').trim(); const cost = Math.max(1, Math.round(+d.cost || 0));
    if (!name) { toast('Donne un nom à la récompense.'); return; }
    put('rewards', {id: d.id || uid('w'), name, cost, icon: d.icon || 'gift', order: d.order ?? S.rewards.size}); closeSheet(); render(); },
  rewardDel: () => { if (S.armed !== 'rw') { S.armed = 'rw'; renderSheet(); return; } del('rewards', S.draft.id); closeSheet(); render(); },
  rewardIdeas: () => { putMany('rewards', REWARD_IDEAS.map(([name,cost,ic],i) => ({id:uid('w'), name, cost, icon:ic, order:i}))); render(); toast('Idées ajoutées : modifie-les comme vous voulez'); },
  rewardRedeem: el => { S.draft = {rid: el.dataset.id, who:null}; openSheet('redeem'); },
  redeemWho: el => { S.draft.who = el.dataset.id; renderSheet(); },
  redeemGo: () => {
    const r = S.rewards.get(S.draft.rid), m0 = S.members.get(S.draft.who); if (!r || !m0) return;
    if (memberPts(m0) < r.cost) { toast('Pas assez de points.'); return; }
    const m = clone(m0); pushHistory(m, {t:'reward', pts:-r.cost, d:localToday(), at:new Date().toISOString(), label:r.name, by:S.me||null});
    put('members', m); closeSheet(); render(); toast(`${m.name} a gagné : ${r.name} !`);
  },
  ptsBonus: el => { S.draft = {mid: el.dataset.id, pts: 2, why:''}; openSheet('bonus'); },
  bonusPts: el => { S.draft.pts = +el.dataset.v; renderSheet(); },
  bonusGo: () => { const d = S.draft, m0 = S.members.get(d.mid); if (!m0) return; const m = clone(m0);
    pushHistory(m, {t:'bonus', pts:d.pts, d:localToday(), at:new Date().toISOString(), label:(d.why||'').trim() || (d.pts > 0 ? 'Bonus' : 'Retrait'), by:S.me||null});
    put('members', m); closeSheet(); render(); toast(`${d.pts>0?'+':''}${d.pts} pour ${m.name}`); },
  ptsHistory: el => { S.draft = {mid: el.dataset.id}; openSheet('ptsHistory'); },
});
Object.assign(CH, { rwName: el => { S.draft.name = el.value; }, rwCost: el => { S.draft.cost = el.value; }, bnWhy: el => { S.draft.why = el.value; } });
['rwName','rwCost','bnWhy'].forEach(k => LIVE.add(k));
