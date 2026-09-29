/* CoTribu — suggestions d'adresses pendant qu'on tape un lieu.
   1) les lieux déjà utilisés par la famille ; 2) la base d'adresses officielle française (IGN, gratuite, sans clé). */

const AC = {el:null, box:null, timer:null, ctrl:null, items:[], sel:-1};
const IGN_URL = 'https://data.geopf.fr/geocodage/completion/';

document.addEventListener('input', e => { const el = e.target; if (AC.skip) return; if (el.matches && el.matches('[data-ac="place"]')) acQuery(el); });
document.addEventListener('focusin', e => { const el = e.target; if (el.matches && el.matches('[data-ac="place"]') && !el.value) acQuery(el); });
document.addEventListener('focusout', e => { if (e.target === AC.el) setTimeout(() => { if (document.activeElement !== AC.el) acClose(); }, 150); });
document.addEventListener('keydown', e => {
  if (!AC.box || e.target !== AC.el) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); AC.sel = Math.max(-1, Math.min(AC.items.length - 1, AC.sel + (e.key === 'ArrowDown' ? 1 : -1))); acDraw(); }
  else if (e.key === 'Enter' && AC.sel >= 0) { e.preventDefault(); acPick(AC.sel); }
  else if (e.key === 'Escape') acClose();
});

function acQuery(el){
  AC.el = el; clearTimeout(AC.timer);
  const q = el.value.trim();
  const local = knownPlaces().filter(p => !q || norm(p).includes(norm(q))).slice(0, q ? 3 : 5).map(p => ({label: p, sub: 'Déjà utilisé', ic: 'history'}));
  acShow(local, q.length >= 3);
  if (q.length < 3) return;
  AC.timer = setTimeout(async () => {
    try { if (AC.ctrl) AC.ctrl.abort(); } catch(_){}
    const ctrl = AC.ctrl = new AbortController();
    try {
      const url = `${IGN_URL}?text=${encodeURIComponent(q)}&type=StreetAddress,PositionOfInterest&maximumResponses=6`;
      const res = await fetch(url, {signal: ctrl.signal});
      const data = await res.json();
      if (ctrl !== AC.ctrl || AC.el !== el || el.value.trim() !== q) return;
      const seen = new Set(local.map(x => norm(x.label)));
      const web = (data.results || []).map(r => ({label: r.fulltext, sub: r.kind && /poi|position/i.test(r.kind) ? 'Lieu' : 'Adresse', ic: 'map-pin'}))
        .filter(x => x.label && !seen.has(norm(x.label)) && seen.add(norm(x.label)));
      acShow([...local, ...web], false);
    } catch(err) { if (err.name !== 'AbortError') acShow(local, false); }
  }, 250);
}
function acShow(items, loading){
  AC.items = items; AC.sel = -1; AC.loading = loading;
  if (!items.length && !loading) { acClose(true); return; }
  if (!AC.box) {
    AC.box = document.createElement('div'); AC.box.className = 'acbox'; AC.box.setAttribute('role', 'listbox');
    AC.box.addEventListener('pointerdown', e => { e.preventDefault(); const b = e.target.closest('[data-i]'); if (b) acPick(+b.dataset.i); });
  }
  if (AC.box.previousElementSibling !== AC.el) AC.el.insertAdjacentElement('afterend', AC.box);
  acDraw();
  // garder la liste visible au-dessus du clavier
  requestAnimationFrame(() => { if (AC.el && AC.box) { const pn = AC.el.closest('.panel'); if (pn) { const top = AC.el.getBoundingClientRect().top - pn.getBoundingClientRect().top - 12; if (top > 0) pn.scrollTop += top; } else AC.el.scrollIntoView({block: 'start'}); } });
}
function acDraw(){
  if (!AC.box) return;
  AC.box.innerHTML = AC.items.map((x, i) => `<div class="acopt ${i === AC.sel ? 'on' : ''}" role="option" data-i="${i}">${icon(x.ic, 16)}<span><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span></div>`).join('')
    + (AC.loading ? `<div class="acopt muted"><span class="spin"></span><span><small>Recherche d’adresses…</small></span></div>` : '');
}
function acPick(i){
  const x = AC.items[i]; if (!x || !AC.el) return;
  AC.el.value = x.label;
  AC.skip = true; AC.el.dispatchEvent(new Event('input', {bubbles: true})); AC.skip = false; // met à jour le brouillon (CH)
  acClose(); AC.el.blur();
}
function acClose(keepEl){ if (AC.box) { AC.box.remove(); AC.box = null; } AC.items = []; if (!keepEl) { clearTimeout(AC.timer); } }
