/* CoTribu — univers Courses : liste partagée, rayons, recettes, historique */

function parseItem(text){
  let t = String(text||'').trim().replace(/\s+/g,' ');
  let qty = '';
  let m = t.match(/^((?:\d+(?:[.,/]\d+)?\s?[½¼¾]?|[½¼¾])\s?(kg|mg|g|l|dl|cl|ml|x|bo[iî]tes?|paquets?|bouteilles?|briques?|pots?|sachets?|tranches?|pinc[ée]es?|cuill[eè]res?(?:\s+[àa]\s+(?:soupe|caf[ée]))?|c\.?\s?[àa]\s?[sc]\.?|cs|cc|gousses?|verres?|feuilles?|brins?|bottes?|filets?|noix|zestes?|morceaux?|cubes?|tasses?|poign[ée]es?|rouleaux?|barquettes?|boules?)?)\s+(de\s+|d[’'])?(.+)$/i);
  if (m) { qty = m[1].trim(); t = m[4]; }
  else if ((m = t.match(/^(.+?)\s+(x\s?\d+|\d+[.,]?\d*\s?(kg|g|l|cl|ml))$/i))) { t = m[1]; qty = m[2].trim(); }
  return {name: cap(t), qty};
}
const activeItems = () => [...S.items.values()].filter(i => !i.archived);
const onList = name => activeItems().some(i => !i.done && norm(i.name) === norm(name));

function itemRow(i, opts={}){
  const a = aisleOf(i.aisle);
  return `<div class="task ${i.done?'done':''} u-${a.tone}" data-sid="${i.id}">
    <button class="check" data-act="itemToggle" data-id="${i.id}" aria-pressed="${!!i.done}" aria-label="${i.done?'Décocher':'Cocher'} ${esc(i.name)}">${checkIc()}</button>
    ${opts.noIcon ? '' : `<span class="aisle-ic">${icon(a.icon,18)}</span>`}
    <div class="body" data-act="editItem" data-id="${i.id}" role="button" tabindex="0"><span class="name">${esc(i.name)}</span>${i.qty||i.done?`<span class="meta">${esc(i.qty||'')}${i.done&&i.doneBy&&S.members.has(i.doneBy)?`${i.qty?' · ':''}pris par ${esc(nameOf(i.doneBy))}`:''}</span>`:''}</div>
    ${i.addedBy && S.members.has(i.addedBy) ? avatar(i.addedBy) : ''}
    <button class="del" data-act="itemDel" data-id="${i.id}" aria-label="Supprimer ${esc(i.name)}">${icon('trash-2',18)}</button>
    ${opts.grip ? `<span class="grip" data-grip aria-label="Glisser pour déplacer">${icon('grip-vertical',20)}</span>` : ''}
  </div>`;
}
function addBar(){
  return `<div class="addbar u-shop"><input type="text" id="c-new" data-ch="cNew" data-enter="addItem" placeholder="Ajouter un article (ex. 6 bananes)" autocomplete="off" enterkeyhint="done" value="${esc(S.cNew||'')}"><button class="go" data-act="addItem" aria-label="Ajouter">${icon('plus',22)}</button></div>`;
}

VIEWS.courses = () => {
  const s = S.sub.courses;
  let h = ptitle('Courses', 'Une liste partagée, toujours à jour.');
  h += seg('csub', s, [['liste','Ma liste'],['rayons','Par rayons'],['recettes','Recettes'],['historique','Historique']], 'u-shop');
  if ((s === 'liste' || s === 'rayons') && !S.aisleOpen) h += storeBar();
  if (s === 'rayons') h += S.aisleOpen ? coursesAisle(S.aisleOpen) : coursesAisles();
  else if (s === 'recettes') h += coursesRecipes();
  else if (s === 'historique') h += coursesHistory();
  else h += coursesList();
  return h;
};

function coursesList(){
  const items = activeItems();
  let h = addBar();
  if (!items.length) return h + `<div class="empty"><h3>La liste est vide</h3><span class="muted">Ajoute un article : il est rangé tout seul dans son rayon, et toute la famille le voit.</span></div>`;
  for (const a of aislesSorted()){
    const list = items.filter(i => (i.aisle||'autre') === a.id).sort((x,y) => (x.done - y.done) || itemKey(x) - itemKey(y));
    if (!list.length) continue;
    const closed = S.closedAisles && S.closedAisles[a.id];
    h += `<section class="group u-${a.tone}" data-sort="items" data-aisle="${a.id}"><div class="ghead" style="background:var(--u-soft)"><span class="bubble sm">${icon(a.icon,16)}</span><h3>${esc(a.name)}</h3>
      <span class="pill num">${list.filter(i=>!i.done).length}</span><button class="iconbtn" style="background:none" data-act="foldAisle" data-v="${a.id}" aria-label="${closed?'Déplier':'Replier'}">${icon(closed?'chevron-down':'chevron-up',20)}</button></div>
      ${closed ? '' : list.map(i => itemRow(i, {noIcon:true, grip:true})).join('')}</section>`;
  }
  const bought = items.filter(i => i.done).length;
  if (bought) h += `<button class="btn soft block" data-act="clearBought">${icon('check',18)}Ranger les ${bought} articles achetés</button>`;
  h += `<span class="info">Maintiens la poignée ⠿ et fais glisser un article pour changer son ordre ou son rayon. <button class="linkbtn" data-act="aisleOrderOpen">Changer l’ordre des rayons</button></span>`;
  return h;
}
function coursesAisles(){
  const items = activeItems();
  return `<span class="info">Appui long sur une carte pour la déplacer. <button class="linkbtn" data-act="aisleOrderOpen">Ou range-les en liste</button></span><div class="tiles" data-sort="aisles" data-grid>${aislesSorted().map(a => {
    const list = items.filter(i => (i.aisle||'autre') === a.id);
    const left = list.filter(i => !i.done).length, done = list.length - left;
    return `<button class="tile u-${a.tone}" data-act="openAisle" data-id="${a.id}" data-sid="${a.id}" data-press><span class="art">${icon(a.icon,46)}</span>
      <span class="tb"><span class="tn" style="font-size:16px">${esc(a.name)}</span>
      <span class="tc"><span class="row" style="gap:6px"><span class="check" style="width:20px;height:20px;${list.length&&!left?'background:var(--done);border-color:var(--done)':''}">${list.length&&!left?icon('check',12,'style="opacity:1" stroke-width="3"'):''}</span>${left} ${left>1?'articles':'article'}${done?` · ${done} pris`:''}</span></span></span></button>`;
  }).join('')}</div>` + addBar();
}
function coursesAisle(id){
  const a = aisleOf(id);
  const list = activeItems().filter(i => (i.aisle||'autre') === id).sort((x,y)=>(x.done-y.done) || itemKey(x) - itemKey(y));
  return `${backBtn('Rayons')}<div class="row u-${a.tone}"><span class="bubble">${icon(a.icon,20)}</span><h2>${esc(a.name)}</h2></div>
    <section class="group" data-sort="items" data-aisle="${id}">${list.map(i => itemRow(i,{noIcon:true, grip:true})).join('') || '<div class="task"><span class="muted">Rien à acheter dans ce rayon.</span></div>'}</section>` + addBar();
}
function weekMeals(){
  const today = localToday();
  return [...S.meals.values()].filter(m => m.date >= today && m.date <= addDays(today,6) && (m.ingredients||[]).length)
    .sort((a,b) => a.date.localeCompare(b.date) || (a.slot==='midi'?-1:1));
}
function dayTag(ds){ const t = localToday(); return ds === t ? 'Aujourd’hui' : ds === addDays(t,1) ? 'Demain' : cap(fmt(ds,{weekday:'long'})); }
function coursesRecipes(){
  const meals = weekMeals();
  if (!meals.length) return `<div class="empty"><h3>Aucun repas prévu cette semaine</h3><span class="muted">Planifie tes repas avec leurs ingrédients : ce qui manque s’ajoute à la liste en un geste.</span><button class="btn upri u-shop" data-act="goRepas">${icon('utensils',18)}Planifier les repas</button></div>`;
  const missing = [];
  meals.forEach(m => (m.ingredients||[]).forEach(g => { if (!missing.some(x => norm(x.name)===norm(g.name))) missing.push({...g, aisle: g.aisle || aisleFor(g.name), meal:m}); }));
  const need = missing.filter(g => !onList(g.name));
  let h = `<div class="row"><h3 style="flex:1">À partir de vos repas de la semaine</h3><button class="btn ghost sm" data-act="addAllIngr">Tout ajouter</button></div>
    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px">${meals.map(m => `<div class="ucard u-shop" style="min-width:150px;flex:none"><span class="kicker">${esc(dayTag(m.date))} · ${m.slot==='midi'?'midi':'soir'}</span>
      <strong>${esc(m.name)}</strong><span class="muted small">${(m.ingredients||[]).length} ingrédients</span>
      <button class="btn upri sm u-shop" data-act="addMealIngr" data-id="${m.id}">${icon('plus',16)}Ajouter</button></div>`).join('')}</div>`;
  h += `<h3>Ingrédients manquants (${need.length})</h3>`;
  for (const a of aislesSorted()){
    const list = missing.filter(g => g.aisle === a.id); if (!list.length) continue;
    h += `<section class="group u-${a.tone}"><div class="ghead" style="background:var(--u-soft)"><span class="bubble sm">${icon(a.icon,16)}</span><h3>${esc(a.name)}</h3></div>
      ${list.map(g => { const has = onList(g.name); return `<div class="task ${has?'done':''}"><span class="aisle-ic">${icon(a.icon,18)}</span><div class="body"><span class="name">${esc(g.name)}</span><span class="meta">${esc(g.qty||'')}${g.qty?' · ':''}${esc(g.meal.name)}</span></div>
        <button class="cart ${has?'on':''}" data-act="addIngr" data-name="${esc(g.name)}" data-qty="${esc(g.qty||'')}" data-aisle="${g.aisle}" aria-label="${has?'Déjà dans la liste':'Ajouter à la liste'}">${icon(has?'check':'shopping-cart',18)}</button></div>`; }).join('')}</section>`;
  }
  if (need.length) h += `<button class="btn deep block" data-act="addAllIngr">${icon('shopping-cart',20)}Tout ajouter à la liste (${need.length})</button>`;
  return h;
}
function coursesHistory(){
  const hist = [...S.items.values()].filter(i => i.archived).sort((a,b) => String(b.doneAt||'').localeCompare(String(a.doneAt||'')));
  if (!hist.length) return `<div class="empty"><h3>Pas encore d’historique</h3><span class="muted">Les articles achetés arrivent ici : un geste suffit pour les racheter.</span></div>`;
  const byDay = {};
  hist.forEach(i => { const d = (i.doneAt||'').slice(0,10) || 'autre'; (byDay[d] = byDay[d] || []).push(i); });
  return Object.entries(byDay).map(([d, list]) => `<section class="group"><div class="ghead" style="background:var(--shop-soft)"><h3>${d==='autre'?'Plus ancien':esc(cap(fmt(d,{weekday:'long',day:'numeric',month:'long'})))}</h3><span class="pill num">${list.length}</span></div>
    ${list.map(i => { const a = aisleOf(i.aisle); const again = onList(i.name); return `<div class="task u-${a.tone}"><span class="aisle-ic">${icon(a.icon,18)}</span><div class="body"><span class="name">${esc(i.name)}</span>${i.qty?`<span class="meta">${esc(i.qty)}</span>`:''}</div>
      <button class="cart ${again?'on':''}" data-act="rebuy" data-id="${i.id}" aria-label="Racheter">${icon(again?'check':'rotate-ccw',18)}</button><button class="del" data-act="itemDel" data-id="${i.id}" aria-label="Supprimer de l’historique">${icon('trash-2',18)}</button></div>`; }).join('')}</section>`).join('');
}

function addItemFromText(text, aisle){
  const p = parseItem(text); if (!p.name) return null;
  const existing = activeItems().find(i => !i.done && norm(i.name) === norm(p.name));
  if (existing) { toast(`${existing.name} est déjà dans la liste`); return existing; }
  const it = {id:uid('i'), name:p.name, qty:p.qty, aisle: aisle || aisleFor(p.name), done:false, addedBy:S.me||null, addedAt:new Date().toISOString()};
  put('items', it); if (typeof thinkCredit === 'function') thinkCredit('items'); return it;
}
function addIngredient(g){
  if (onList(g.name)) return false;
  put('items', {id:uid('i'), name:cap(g.name), qty:g.qty||'', aisle: g.aisle || aisleFor(g.name), done:false, addedBy:S.me||null, addedAt:new Date().toISOString()});
  return true;
}
function pruneHistory(){
  const hist = [...S.items.values()].filter(i => i.archived).sort((a,b) => String(b.doneAt||'').localeCompare(String(a.doneAt||'')));
  hist.slice(150).forEach(i => del('items', i.id));
}

SHEETS.item = () => {
  const d = S.draft;
  return `<h2>Modifier l’article</h2>
    <label class="f" for="i-name">Article<input type="text" id="i-name" data-ch="iName" value="${esc(d.name)}"></label>
    <label class="f" for="i-qty">Quantité<input type="text" id="i-qty" data-ch="iQty" value="${esc(d.qty||'')}" placeholder="Ex. 1 kg, x4, 2 briques"></label>
    <label class="f" for="i-aisle">Rayon<select id="i-aisle" data-ch="iAisle">${AISLES.map(a => `<option value="${a.id}" ${d.aisle===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
    <div class="actions"><button class="btn primary" data-act="saveItem">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>
    <button class="btn danger ${S.armed==='item'?'armed':''}" data-act="delItem">${S.armed==='item'?'Confirmer la suppression':'Retirer de la liste'}</button>`;
};

Object.assign(H, {
  csub: el => { S.sub.courses = el.dataset.v; S.aisleOpen = null; render(); },
  addItem: () => {
    const el = document.getElementById('c-new'); const v = (el ? el.value : S.cNew || '').trim();
    if (!v) { el && el.focus(); return; }
    const it = addItemFromText(v, S.aisleOpen || null);
    S.cNew = ''; render();
    const n = document.getElementById('c-new'); if (n) { n.value = ''; n.focus(); }
    if (it && it.aisle) { const a = aisleOf(it.aisle); if (!S.aisleOpen) toast(`${it.name} → ${a.name}`); }
  },
  itemToggle: el => {
    const i = clone(S.items.get(el.dataset.id)); if (!i) return;
    const was = i.doneBy;
    i.done = !i.done; i.doneBy = i.done ? (S.me||null) : null; i.doneAt = i.done ? new Date().toISOString() : null;
    put('items', i);
    if (typeof doneCredit === 'function') { if (i.done && i.doneBy) doneCredit(i.doneBy, 1); else if (!i.done && was) doneCredit(was, -1); }
    render();
  },
  foldAisle: el => { S.closedAisles = S.closedAisles || {}; S.closedAisles[el.dataset.v] = !S.closedAisles[el.dataset.v]; render(); },
  clearBought: () => {
    const list = activeItems().filter(i => i.done).map(i => ({...clone(i), archived:true}));
    putMany('items', list); pruneHistory(); render(); toast(`${list.length} articles rangés dans l’historique`);
  },
  openAisle: el => goSub(() => { S.aisleOpen = el.dataset.id; }),
  editItem: el => { const i = S.items.get(el.dataset.id); if (!i) return; S.draft = clone(i); openSheet('item'); },
  saveItem: () => { const d = S.draft; if (!d.name.trim()) { toast('Écris le nom de l’article.'); return; } d.name = d.name.trim(); put('items', d); closeSheet(); render(); },
  itemDel: el => {
    const it = S.items.get(el.dataset.id); if (!it) return;
    del('items', it.id); render();
    toastUndo(`« ${it.name} » supprimé`, () => { put('items', it); render(); });
  },
  delItem: () => { if (S.armed !== 'item') { S.armed = 'item'; renderSheet(); return; } del('items', S.draft.id); closeSheet(); render(); },
  addIngr: el => { if (addIngredient({name:el.dataset.name, qty:el.dataset.qty, aisle:el.dataset.aisle})) { render(); toast(el.dataset.name + ' ajouté'); } },
  addMealIngr: el => { const m = S.meals.get(el.dataset.id); if (!m) return; let n = 0; (m.ingredients||[]).forEach(g => { if (addIngredient(g)) n++; }); render(); toast(n ? `${n} ingrédients ajoutés` : 'Tout est déjà dans la liste'); },
  addAllIngr: () => { let n = 0; weekMeals().forEach(m => (m.ingredients||[]).forEach(g => { if (addIngredient(g)) n++; })); render(); toast(n ? `${n} ingrédients ajoutés à la liste` : 'Tout est déjà dans la liste'); },
  rebuy: el => { const i = S.items.get(el.dataset.id); if (!i || onList(i.name)) return; addIngredient({name:i.name, qty:i.qty, aisle:i.aisle}); render(); toast(i.name + ' remis dans la liste'); },
  goRepas: () => { S.tab = 'plus'; S.sub.plus = 'repas'; render(); window.scrollTo(0,0); },
});
Object.assign(CH, {
  cNew: el => { S.cNew = el.value; },
  iName: el => { S.draft.name = el.value; },
  iQty: el => { S.draft.qty = el.value; },
  iAisle: el => { S.draft.aisle = el.value; },
});
['cNew','iName','iQty'].forEach(k => LIVE.add(k));
