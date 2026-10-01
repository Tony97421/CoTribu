/* CoTribu — glisser-déposer (doigt ou souris) : ordre des articles, changement de rayon, ordre des rayons, magasins.
   Un conteneur [data-sort="type"] contient des éléments [data-sid].
   On attrape un élément par sa poignée [data-grip] (tout de suite) ou par un appui long s'il porte [data-press] (cartes). */

let DG = null, PRESS = null, NOCLICK = 0;
const DROP = {};

function startDrag(row, box, x, y, pid, capture, fromPress){
  const r = row.getBoundingClientRect();
  DG = {row, kind: box.dataset.sort, grid: box.hasAttribute('data-grid'), grabX: x - r.left, grabY: y - r.top, x, y, pid, fromPress, scroller: row.closest('.panel')};
  S.dragging = true;
  row.classList.add('dragging');
  document.body.classList.add('is-dragging');
  try { capture.setPointerCapture(pid); } catch(_){}
  try { navigator.vibrate && navigator.vibrate(fromPress ? 25 : 12); } catch(_){}
  dragFollow(); requestAnimationFrame(dragLoop);
}
function cancelPress(){ if (PRESS) { clearTimeout(PRESS.t); PRESS.el.classList.remove('pressing'); PRESS = null; } }

document.addEventListener('pointerdown', e => {
  if (DG || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const g = e.target.closest('[data-grip]');
  if (g) {
    const row = g.closest('[data-sid]'), box = row && row.closest('[data-sort]'); if (!box) return;
    e.preventDefault(); startDrag(row, box, e.clientX, e.clientY, e.pointerId, g, false); return;
  }
  const el = e.target.closest('[data-press]'), box = el && el.closest('[data-sort]'); if (!box) return;
  cancelPress();
  PRESS = {el, x: e.clientX, y: e.clientY, pid: e.pointerId};
  el.classList.add('pressing');
  PRESS.t = setTimeout(() => { const p = PRESS; if (!p) return; PRESS = null; p.el.classList.remove('pressing'); startDrag(p.el, box, p.x, p.y, p.pid, p.el, true); }, 380);
});
document.addEventListener('pointermove', e => {
  if (PRESS && e.pointerId === PRESS.pid && Math.hypot(e.clientX - PRESS.x, e.clientY - PRESS.y) > 8) cancelPress();
  if (!DG || e.pointerId !== DG.pid) return;
  e.preventDefault(); DG.x = e.clientX; DG.y = e.clientY; dragMove();
}, {passive:false});
document.addEventListener('pointerup', e => { cancelPress(); if (DG && e.pointerId === DG.pid) dragEnd(); });
document.addEventListener('pointercancel', e => { cancelPress(); if (DG && e.pointerId === DG.pid) dragEnd(); });
document.addEventListener('touchmove', e => { if (DG) e.preventDefault(); }, {passive:false}); // pas de défilement pendant qu'on déplace
document.addEventListener('contextmenu', e => { if (PRESS || DG) e.preventDefault(); });
window.addEventListener('click', e => { if (Date.now() - NOCLICK < 250) { e.stopImmediatePropagation(); e.preventDefault(); NOCLICK = 0; } }, true);

function dragFollow(){ // l'élément suit le doigt
  const row = DG.row; row.style.transform = '';
  const nr = row.getBoundingClientRect();
  row.style.transform = DG.grid ? `translate(${DG.x - DG.grabX - nr.left}px, ${DG.y - DG.grabY - nr.top}px) scale(1.04)` : `translateY(${DG.y - DG.grabY - nr.top}px)`;
}
function dragMove(){
  const {row, kind} = DG;
  row.style.pointerEvents = 'none';
  // si le doigt dépasse le bord de la fenêtre, on vise la première/dernière ligne visible
  const sr = DG.scroller ? DG.scroller.getBoundingClientRect() : {top: 0, bottom: window.innerHeight};
  const py = Math.min(Math.max(DG.y, sr.top + 24), sr.bottom - 24);
  const el = document.elementFromPoint(Math.min(Math.max(DG.x, 8), window.innerWidth - 8), py);
  row.style.pointerEvents = '';
  if (el) {
    const target = el.closest(`[data-sort="${kind}"] [data-sid]`);
    if (target && target !== row) {
      const tr = target.getBoundingClientRect();
      const after = DG.grid ? DG.x > tr.left + tr.width / 2 : py > tr.top + tr.height / 2;
      if (after ? target.nextElementSibling !== row : target.previousElementSibling !== row) target.parentNode.insertBefore(row, after ? target.nextSibling : target);
    } else if (!target && !DG.grid) {
      const box = el.closest(`[data-sort="${kind}"]`);
      if (box && row.parentNode !== box) { // au-dessus d'un titre de rayon : en tête de ce rayon
        const first = box.querySelector('[data-sid]');
        if (first) box.insertBefore(row, first); else box.appendChild(row);
      }
    }
  }
  dragFollow();
}
function dragLoop(){ // défilement automatique près des bords
  if (!DG) return;
  const sc = DG.scroller, top = sc ? sc.getBoundingClientRect().top : 0, bottom = sc ? sc.getBoundingClientRect().bottom : window.innerHeight;
  let d = 0;
  if (DG.y < top + 80) d = -Math.ceil((top + 80 - DG.y) / 8);
  else if (DG.y > bottom - 120) d = Math.ceil((DG.y - (bottom - 120)) / 8);
  if (d) { if (sc) sc.scrollTop += d; else window.scrollBy(0, d); dragMove(); }
  requestAnimationFrame(dragLoop);
}
function dragEnd(){
  const {row, kind, fromPress} = DG;
  row.classList.remove('dragging'); row.style.transform = '';
  document.body.classList.remove('is-dragging');
  if (fromPress) NOCLICK = Date.now(); // l'appui long ne doit pas ouvrir la carte
  const box = row.closest(`[data-sort="${kind}"]`);
  const boxes = [...document.querySelectorAll(`[data-sort="${kind}"]`)];
  DG = null; S.dragging = false; S.dragPending = false;
  if (DROP[kind]) DROP[kind](boxes, row, box); else render();
}

/* ---------- articles de courses ---------- */
DROP.items = boxes => {
  const changed = []; let moved = null;
  for (const b of boxes) {
    const aisle = b.dataset.aisle;
    [...b.querySelectorAll('[data-sid]')].forEach((r, i) => {
      const it = S.items.get(r.dataset.sid); if (!it) return;
      if ((it.aisle||'autre') !== aisle || it.order !== i) {
        const n = {...clone(it), aisle, order: i};
        if ((it.aisle||'autre') !== aisle) moved = n;
        changed.push(n);
      }
    });
  }
  if (changed.length) putMany('items', changed);
  render();
  if (moved) toast(`${moved.name} rangé dans « ${aisleOf(moved.aisle).name} ». CoTribu s’en souviendra.`);
};

/* ---------- blocs de l'accueil ---------- */
DROP.home = (boxes, row, box) => { const p = homePrefs(); p.order = [...(box || boxes[0]).querySelectorAll('[data-sid]')].map(r => r.dataset.sid); saveHomePrefs(p); render(); };

/* ---------- magasins et ordre des rayons ---------- */
function saveStores(list){ const o = {list, at: new Date().toISOString()}; const ms = [...S.members.values()].map(m => ({...clone(m), stores: o})); if (ms.length) putMany('members', ms); }
function pickStore(id){ if (S.hh) LS.set('cotribu-store-' + S.hh.id, id || ''); }
function setAisleOrder(ids){
  const st = currentStore();
  if (st) { saveStores(famStores().map(s => s.id === st.id ? {...s, order: ids || []} : s)); return; }
  const o = {ids: ids || [], at: new Date().toISOString()};
  const list = [...S.members.values()].map(m => ({...clone(m), aisleOrder: o}));
  if (list.length) putMany('members', list);
}
DROP.aisles = (boxes, row, box) => {
  const ids = [...(box || boxes[0]).querySelectorAll('[data-sid]')].map(r => r.dataset.sid);
  setAisleOrder(ids); if (S.sheet) renderSheet(); render();
  const st = currentStore(); toast(st ? `Ordre enregistré pour ${st.name}` : 'Ordre des rayons enregistré');
};
function storeBar(){
  const stores = famStores(), cur = currentStore();
  return `<div class="storebar u-shop"><span class="muted small">${icon('map-pin',14)}Magasin</span>
    <button class="chip" data-act="storePick" data-id="" aria-pressed="${!cur}">Habituel</button>
    ${stores.map(s => `<button class="chip" data-act="storePick" data-id="${s.id}" aria-pressed="${cur && cur.id === s.id}">${esc(s.name)}</button>`).join('')}
    <button class="chip add" data-act="storeNew">${icon('plus',14)}Magasin</button></div>`;
}
const STORE_IDEAS = ['Super U', 'Leclerc', 'Carrefour', 'Intermarché', 'Lidl', 'Auchan', 'Aldi', 'Monoprix', 'Biocoop', 'Marché'];
SHEETS.storeNew = () => {
  const have = new Set(famStores().map(s => norm(s.name)));
  return `<h2>Nouveau magasin</h2>
  <span class="muted">Chaque magasin garde son propre ordre de rayons. Toute la famille voit la liste des magasins, et chacun choisit le sien sur son téléphone.</span>
  <div class="chips u-shop">${STORE_IDEAS.filter(n => !have.has(norm(n))).map(n => `<button class="chip" data-act="storeIdea" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
  <label class="f" for="st-name">Nom du magasin<input type="text" id="st-name" data-ch="stName" value="${esc(S.draft.name||'')}" placeholder="Ex. Super U de Rezé"></label>
  <div class="actions"><button class="btn primary" data-act="storeCreate">Créer et ranger les rayons</button><button class="btn soft" data-act="close">Annuler</button></div>`;
};
SHEETS.aisleOrder = () => {
  const st = currentStore();
  return `<h2>Ordre des rayons${st ? ` · ${esc(st.name)}` : ''}</h2>
  <span class="muted">Mets les rayons dans l’ordre où tu les parcours${st ? ' dans ce magasin' : ' dans ton magasin'} : la liste suivra ce chemin. Maintiens la poignée ⠿ à droite et fais glisser.</span>
  <div class="menu" data-sort="aisles">${aislesSorted().map(a => `<div class="lrow u-${a.tone}" data-sid="${a.id}"><span class="bubble sm">${icon(a.icon,16)}</span><span class="body"><span class="t">${esc(a.name)}</span></span><span class="grip" data-grip aria-label="Glisser pour déplacer">${icon('grip-vertical',20)}</span></div>`).join('')}</div>
  <div class="actions"><button class="btn primary" data-act="close">Terminé</button>${aisleOrder() ? `<button class="btn soft" data-act="aisleOrderReset">Ordre par défaut</button>` : ''}</div>
  ${st ? `<label class="f" for="st-rename">Nom du magasin<input type="text" id="st-rename" data-ch="stRename" value="${esc(st.name)}"></label>
    <button class="btn danger ${S.armed==='store'?'armed':''}" data-act="storeDel">${S.armed==='store' ? `Confirmer : supprimer ${esc(st.name)}` : 'Supprimer ce magasin'}</button>` : ''}`;
};
Object.assign(H, {
  aisleOrderOpen: () => openSheet('aisleOrder'),
  aisleOrderReset: () => { setAisleOrder(null); renderSheet(); render(); toast('Ordre par défaut rétabli'); },
  storePick: el => { pickStore(el.dataset.id); render(); const st = currentStore(); toast(st ? `Rayons dans l’ordre de ${st.name}` : 'Ordre habituel'); },
  storeNew: () => { S.draft = {name:''}; openSheet('storeNew'); },
  storeIdea: el => { S.draft.name = el.dataset.v; renderSheet(); },
  storeCreate: () => {
    const name = (S.draft.name||'').trim(); if (!name) { toast('Donne un nom au magasin.'); return; }
    if (famStores().some(s => norm(s.name) === norm(name))) { toast('Ce magasin existe déjà.'); return; }
    const st = {id: uid('mag'), name, order: aislesSorted().map(a => a.id)};
    saveStores([...famStores(), st]); pickStore(st.id);
    S.draft = null; S.sheet = 'aisleOrder'; S.armed = null; renderSheet(); render();
  },
  storeDel: () => {
    if (S.armed !== 'store') { S.armed = 'store'; renderSheet(); return; }
    const st = currentStore(); if (!st) return;
    saveStores(famStores().filter(s => s.id !== st.id)); pickStore('');
    closeSheet(); render(); toast(`${st.name} supprimé`);
  },
});
Object.assign(CH, {
  stName: el => { S.draft.name = el.value; },
  stRename: el => { const st = currentStore(), v = el.value.trim(); if (st && v && v !== st.name) { saveStores(famStores().map(s => s.id === st.id ? {...s, name: v} : s)); render(); } },
});
LIVE.add('stName');
