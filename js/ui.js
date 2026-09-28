/* CoTribu — interface commune : barre du haut, navigation, feuilles, événements */
const VIEWS = {};      // onglet → fonction qui renvoie le HTML
const H = {};          // data-act → action au toucher
const CH = {};         // data-ch → changement de champ
const LIVE = new Set();// data-ch mis à jour à chaque frappe (sinon au « change »)
const SHEETS = {};     // nom → fonction qui renvoie le HTML d'une feuille

const memberColor = m => COLORS[(m && m.color) % COLORS.length] || COLORS[0];
const nameOf = id => (S.members.get(id)||{}).name || 'Quelqu’un';
function avatar(id, cls=''){
  const m = S.members.get(id);
  if (!m) return `<span class="av free ${cls}" title="Qui veut">?</span>`;
  return `<span class="av ${cls}" style="background:${memberColor(m)}" title="${esc(m.name)}">${esc((m.name||'?').trim().charAt(0).toUpperCase())}</span>`;
}
const avatars = ids => ids.length ? `<span class="avs">${ids.map(id=>avatar(id)).join('')}</span>` : `<span class="avs">${avatar(null)}</span>`;
const checkIc = () => icon('check', 16, 'stroke-width="3"');

let toastT;
function toast(msg){ const el = document.getElementById('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=>el.hidden=true, 2800); }

function topbar(){
  const ms = sorted(S.members).slice(0,5);
  return `<div class="topbar">
    <button class="wordmark" data-act="tab" data-v="today" aria-label="CoTribu, accueil"><span class="name">Co<b>Tribu</b></span><span class="tagline">Le quotidien se partage</span></button>
    <div class="people">${ms.map(m=>avatar(m.id)).join('')}<button class="plus" data-act="addMemberSheet" aria-label="Ajouter un membre">${icon('plus',18)}</button></div>
  </div>`;
}
function ptitle(title, sub, right=''){
  return `<div class="ptitle"><div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:''}</div>${right}</div>`;
}
function syncBadge(){ return `<span class="sync ${S.live?'':'local'}"><i></i>${S.live ? 'En direct' : 'Reconnexion…'}</span>`; }
function renderHeaderStatus(){
  document.querySelectorAll('.sync').forEach(el => { el.className = 'sync' + (S.live ? '' : ' local'); el.lastChild.textContent = S.live ? 'En direct' : 'Reconnexion…'; });
}
function seg(name, cur, options, uni){
  return `<div class="seg ${uni||''}" role="group">${options.map(([v,l]) => `<button data-act="${name}" data-v="${v}" aria-pressed="${cur===v}">${l}</button>`).join('')}</div>`;
}

/* ---------- rendu ---------- */
function render(){
  const tabs = document.querySelector('.tabs');
  tabs.hidden = S.mode !== 'app';
  tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.v === S.tab ? 'page' : 'false'));
  const v = document.getElementById('view');
  const a = document.activeElement, keep = a && a.id && v.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') ? {id:a.id, val:a.value, s:a.selectionStart} : null;
  if (S.mode === 'welcome') v.innerHTML = VIEWS.welcome();
  else if (S.mode === 'error') v.innerHTML = `<div class="empty" style="margin-top:40px"><h3>Impossible de charger le foyer</h3><span class="muted">${esc(S.errMsg ? explain({message:S.errMsg}) : 'Vérifie ta connexion puis réessaie.')}</span>${S.errMsg ? `<code class="small muted" style="overflow-wrap:anywhere">${esc(S.errMsg)}</code>` : ''}<button class="btn primary" data-act="retry">Réessayer</button></div>`;
  else if (S.mode !== 'app' || !S.loaded) v.innerHTML = '<div class="loading">Chargement de la tribu…</div>';
  else {
    if (S.me && !S.members.has(S.me)) S.me = null;
    v.innerHTML = topbar() + (VIEWS[S.tab] || VIEWS.today)();
    afterRender();
  }
  if (keep) { const f = document.getElementById(keep.id); if (f) { f.value = keep.val; f.focus(); try { f.setSelectionRange(keep.s, keep.s); } catch(e){} } }
  if (S.sheet) renderSheet();
}
const AFTER = [];
function afterRender(){ AFTER.forEach(fn => { try { fn(); } catch(e){ console.warn(e); } }); }

/* ---------- feuilles (panneaux du bas) ---------- */
function openSheet(kind){
  S.sheet = kind; S.armed = null; renderSheet(); document.getElementById('sheet').hidden = false;
  if (!(history.state && history.state.sheet)) history.pushState({sheet:1}, '');
}
function closeSheet(fromPop){
  S.sheet = null; S.draft = null; S.armed = null; document.getElementById('sheet').hidden = true;
  if (!fromPop && history.state && history.state.sheet) { ignorePop = true; history.back(); }
}
let ignorePop = false;
function renderSheet(){
  const el = document.getElementById('sheetBody');
  const a = document.activeElement, focused = a && a.id, val = a && a.value, sel = a && a.selectionStart;
  el.innerHTML = '<div class="grab"></div>' + (SHEETS[S.sheet] ? SHEETS[S.sheet]() : '');
  if (focused) { const f = document.getElementById(focused); if (f && el.contains(f)) { if ((f.tagName==='INPUT' && f.type!=='file')||f.tagName==='TEXTAREA') f.value = val; f.focus(); try { f.setSelectionRange(sel, sel); } catch(e){} } }
  afterRender();
}
function goSub(fn){ fn(); if (!(history.state && history.state.sub)) history.pushState({sub:1}, ''); render(); window.scrollTo(0,0); }
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; return; }
  if (S.sheet) { closeSheet(true); return; }
  if (S.roomOpen) { S.roomOpen = null; render(); return; }
  if (S.aisleOpen) { S.aisleOpen = null; render(); return; }
  if (S.tab === 'plus' && S.sub.plus) { S.sub.plus = null; render(); return; }
});
function back(){ if (history.state && history.state.sub) history.back(); else { S.roomOpen = null; S.aisleOpen = null; S.sub.plus = null; render(); } }
const backBtn = label => `<button class="back" data-act="back">${icon('chevron-left',20)}${esc(label)}</button>`;

/* ---------- actions communes ---------- */
Object.assign(H, {
  tab: el => { S.tab = el.dataset.v; S.armed = null; S.roomOpen = null; S.aisleOpen = null; if (S.tab !== 'plus') S.sub.plus = null; render(); window.scrollTo(0,0); },
  close: () => closeSheet(),
  back: () => back(),
  retry: () => { S.mode = 'loading'; S.errMsg = null; render(); safeBoot(); },
  me: el => setMe(el.dataset.id),
  dismiss: el => { S.dismissed[el.dataset.v] = true; LS.set('cotribu-dismiss-'+el.dataset.v, localToday()); render(); },
  install: async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch(e){} installEvt = null; render(); },
  later: () => { LS.set('cotribu-install-later', String(Date.now() + 3*DAY)); render(); },
  share: () => shareInvite(),
  addMemberSheet: () => { S.draft = {name:''}; openSheet('member'); },
  saveMember: () => {
    const n = (S.draft.name||'').trim(); if (!n) { toast('Écris un prénom.'); return; }
    const ms = sorted(S.members);
    put('members', {id:uid('m'), name:n, color: ms.length % COLORS.length, order:(Math.max(-1,...ms.map(x=>x.order||0))+1)});
    closeSheet(); render(); toast(n + ' fait partie de la tribu');
  },
});
SHEETS.member = () => `<h2>Ajouter un membre</h2>
  <label class="f" for="mb-name">Prénom<input type="text" id="mb-name" data-ch="mbName" value="${esc(S.draft.name)}" placeholder="Ex. Léa" autocomplete="off"></label>
  <span class="info">Pas besoin de compte ni de téléphone : les enfants peuvent avoir des tâches à leur nom.</span>
  <div class="actions"><button class="btn primary" data-act="saveMember">Ajouter</button><button class="btn soft" data-act="close">Annuler</button></div>`;
CH.mbName = el => { S.draft.name = el.value; }; LIVE.add('mbName');

/* ---------- délégation d'événements ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const h = H[el.dataset.act]; if (h) { e.preventDefault(); h(el, e); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); H[e.target.dataset.act](e.target); }
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); H[e.target.dataset.enter](e.target); }
  if (e.key === 'Escape' && S.sheet) closeSheet();
});
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.ch; if (k && LIVE.has(k) && CH[k]) CH[k](e.target); });
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.ch; if (k && !LIVE.has(k) && CH[k]) CH[k](e.target); });

let lastDay = localToday();
setInterval(() => { if (localToday() !== lastDay) { lastDay = localToday(); render(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && localToday() !== lastDay) { lastDay = localToday(); render(); } });
