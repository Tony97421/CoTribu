/* CoTribu — glisser-déposer (doigt ou souris) : ordre des articles, changement de rayon, ordre des rayons.
   Un conteneur [data-sort="type"] contient des lignes [data-sid] ; on attrape une ligne par sa poignée [data-grip]. */

let DG = null;
const DROP = {};

document.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-grip]'); if (!g || DG) return;
  const row = g.closest('[data-sid]'), box = row && row.closest('[data-sort]'); if (!box) return;
  e.preventDefault();
  const r = row.getBoundingClientRect();
  DG = {row, kind: box.dataset.sort, grabY: e.clientY - r.top, x: e.clientX, y: e.clientY, pid: e.pointerId, scroller: row.closest('.panel')};
  S.dragging = true;
  row.classList.add('dragging');
  document.body.classList.add('is-dragging');
  try { g.setPointerCapture(e.pointerId); } catch(_){}
  try { navigator.vibrate && navigator.vibrate(12); } catch(_){}
  dragFollow(); requestAnimationFrame(dragLoop);
});
document.addEventListener('pointermove', e => {
  if (!DG || e.pointerId !== DG.pid) return;
  e.preventDefault(); DG.x = e.clientX; DG.y = e.clientY; dragMove();
}, {passive:false});
document.addEventListener('pointerup', e => { if (DG && e.pointerId === DG.pid) dragEnd(); });
document.addEventListener('pointercancel', e => { if (DG && e.pointerId === DG.pid) dragEnd(); });

function dragFollow(){ // la ligne suit le doigt
  const row = DG.row; row.style.transform = '';
  const nr = row.getBoundingClientRect();
  row.style.transform = `translateY(${DG.y - DG.grabY - nr.top}px)`;
}
function dragMove(){
  const {row, kind} = DG;
  row.style.pointerEvents = 'none';
  const el = document.elementFromPoint(Math.min(Math.max(DG.x, 8), window.innerWidth - 8), DG.y);
  row.style.pointerEvents = '';
  if (el) {
    const target = el.closest(`[data-sort="${kind}"] [data-sid]`);
    if (target && target !== row) {
      const tr = target.getBoundingClientRect(), after = DG.y > tr.top + tr.height / 2;
      if (after ? target.nextElementSibling !== row : target.previousElementSibling !== row) target.parentNode.insertBefore(row, after ? target.nextSibling : target);
    } else if (!target) {
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
  const {row, kind} = DG;
  row.classList.remove('dragging'); row.style.transform = '';
  document.body.classList.remove('is-dragging');
  const boxes = [...document.querySelectorAll(`[data-sort="${kind}"]`)];
  DG = null; S.dragging = false; S.dragPending = false;
  if (DROP[kind]) DROP[kind](boxes, row); else render();
}

/* ---------- articles de courses ---------- */
DROP.items = (boxes, row) => {
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

/* ---------- ordre des rayons (pour toute la famille) ---------- */
function setAisleOrder(ids){
  const o = ids ? {ids, at: new Date().toISOString()} : {ids: [], at: new Date().toISOString()};
  const list = [...S.members.values()].map(m => ({...clone(m), aisleOrder: o}));
  if (list.length) putMany('members', list);
}
DROP.aisles = boxes => {
  const ids = [...boxes[0].querySelectorAll('[data-sid]')].map(r => r.dataset.sid);
  setAisleOrder(ids); renderSheet(); render();
};
SHEETS.aisleOrder = () => `<h2>Ordre des rayons</h2>
  <span class="muted">Mets les rayons dans l’ordre où tu les parcours dans ton magasin : la liste suivra ce chemin. Maintiens la poignée ⠿ à droite et fais glisser.</span>
  <div class="menu" data-sort="aisles">${aislesSorted().map(a => `<div class="lrow u-${a.tone}" data-sid="${a.id}"><span class="bubble sm">${icon(a.icon,16)}</span><span class="body"><span class="t">${esc(a.name)}</span></span><span class="grip" data-grip aria-label="Glisser pour déplacer">${icon('grip-vertical',20)}</span></div>`).join('')}</div>
  <div class="actions"><button class="btn primary" data-act="close">Terminé</button>${aisleOrder() ? `<button class="btn soft" data-act="aisleOrderReset">Ordre par défaut</button>` : ''}</div>`;
Object.assign(H, {
  aisleOrderOpen: () => openSheet('aisleOrder'),
  aisleOrderReset: () => { setAisleOrder(null); renderSheet(); render(); toast('Ordre par défaut rétabli'); },
});
