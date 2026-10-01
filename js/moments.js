/* CoTribu — petits moments : mode vacances, compte à rebours, « il y a un an », diaporama, confettis */

/* ---------- Mode vacances ---------- */
const dLong = ds => fmt(ds, {day:'numeric', month:'long'});
function pauseCard(where){
  const p = familyPause(), today = localToday();
  const active = p && p.from <= today && today <= p.to;
  const upcoming = p && p.from > today;
  if (active) return `<div class="ucard u-plan pausecard"><div class="row"><span class="bubble sm">${icon('plane',16)}</span><h3 style="flex:1">Mode vacances jusqu’au ${esc(dLong(p.to))}</h3></div>
    <span class="small">Les routines sont en pause : rien ne s’accumule pendant votre absence. Elles reprennent le ${esc(dLong(addDays(p.to,1)))}.</span>
    <div class="row"><button class="btn upri sm" data-act="pauseEdit">Modifier</button><button class="btn soft sm" data-act="pauseStop">On est rentrés</button></div></div>`;
  if (upcoming && (where !== 'today' || idx(p.from) - idx(today) <= 14)) return `<div class="ucard u-plan pausecard"><div class="row"><span class="bubble sm">${icon('plane',16)}</span><h3 style="flex:1">Vacances du ${esc(dLong(p.from))} au ${esc(dLong(p.to))}</h3></div>
    <span class="small">Les routines se mettront en pause toutes seules.</span><div class="row"><button class="btn upri sm" data-act="pauseEdit">Modifier</button><button class="btn soft sm" data-act="pauseStop">Annuler</button></div></div>`;
  if (where === 'routines') return `<button class="lrow u-plan pauseline" data-act="pauseEdit"><span class="bubble sm">${icon('plane',16)}</span><span class="body"><span class="t">Mode vacances</span><span class="s">Mettre les routines en pause pendant une absence</span></span>${icon('chevron-right',18)}</button>`;
  return '';
}
SHEETS.pause = () => {
  const d = S.draft;
  const n = d.from && d.to && d.to >= d.from ? idx(d.to) - idx(d.from) + 1 : 0;
  return `<h2>Mode vacances</h2>
    <span class="muted">Pendant ces dates, les routines de la maison sont en pause pour toute la famille : pas de rappel, rien « en retard » au retour. Le planning, les courses et les repas continuent normalement.</span>
    <div class="frow"><label class="f" for="pa-from">Départ<input type="date" id="pa-from" data-ch="paFrom" value="${esc(d.from)}"></label>
      <label class="f" for="pa-to">Retour (dernier jour d’absence)<input type="date" id="pa-to" data-ch="paTo" value="${esc(d.to)}" min="${esc(d.from)}"></label></div>
    ${n ? `<span class="muted small">${n} jour${n>1?'s':''} de pause · les routines reprennent le ${esc(dLong(addDays(d.to,1)))}</span>` : ''}
    <div class="actions"><button class="btn primary" data-act="pauseSave">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>`;
};
function setPause(p){
  const list = [...S.members.values()].map(m => ({...clone(m), pause: p}));
  if (list.length) putMany('members', list);
}
Object.assign(H, {
  pauseEdit: () => { const p = familyPause(), today = localToday(); S.draft = p && p.to >= today ? {from:p.from, to:p.to} : {from:today, to:addDays(today,7)}; openSheet('pause'); },
  pauseSave: () => {
    const d = S.draft;
    if (!d.from || !d.to) { toast('Choisis les deux dates.'); return; }
    if (d.to < d.from) { toast('Le retour est avant le départ.'); return; }
    setPause({from:d.from, to:d.to, at:new Date().toISOString(), by:S.me||null});
    closeSheet(); render(); toast(d.from <= localToday() ? 'Bonnes vacances ! Les routines sont en pause.' : 'Vacances enregistrées');
  },
  pauseStop: () => {
    const p = familyPause(), today = localToday(), y = addDays(today,-1);
    // les jours déjà passés restent en pause (rien ne devient « en retard »), la suite reprend dès aujourd'hui
    setPause(p && p.from <= y ? {...p, to:y, at:new Date().toISOString()} : null);
    render(); toast(p && p.from <= today ? 'Bon retour ! Les routines reprennent.' : 'Vacances annulées');
  },
});
Object.assign(CH, {
  paFrom: el => { S.draft.from = el.value; if (S.draft.to < el.value) S.draft.to = el.value; renderSheet(); },
  paTo: el => { S.draft.to = el.value; renderSheet(); },
});

/* ---------- Compte à rebours ---------- */
function nextOn(e, from, max=400){ for (let i=0;i<=max;i++){ const ds = addDays(from,i); if (eventOn(e,ds)) return ds; } return null; }
function countdowns(){
  const today = localToday();
  return [...S.events.values()].filter(e => e.countdown).map(e => { const ds = nextOn(e, today); return ds ? {e, ds, n: idx(ds) - idx(today)} : null; })
    .filter(Boolean).sort((a,b) => a.n - b.n).slice(0,3);
}
function countdownCard(){
  const list = countdowns(); if (!list.length) return '';
  return `<div class="ucard u-plan"><div class="row"><span class="bubble sm">${icon('hourglass',16)}</span><h3 style="flex:1">Compte à rebours</h3></div>
    ${list.map(x => `<button class="cd" data-act="editEvent" data-id="${x.e.id}" data-day="${x.ds}"><span class="cdn">${x.n === 0 ? icon('party-popper',26) : `<b class="num">${x.n}</b><small>${x.n>1?'jours':'jour'}</small>`}</span>
      <span class="body"><strong>${esc(x.e.title)}</strong><span class="muted small">${x.n === 0 ? 'C’est aujourd’hui !' : x.n === 1 ? 'C’est demain !' : esc(cap(fmt(x.ds,{weekday:'long', day:'numeric', month:'long'})))}</span></span></button>`).join('')}</div>`;
}

/* ---------- Il y a un an ---------- */
function throwbackHero(){
  const tb = throwback(); if (!tb) return '';
  if (S.dismissed.tb || LS.get('cotribu-dismiss-tb') === localToday()) return '';
  const exact = tb.date.slice(5) === localToday().slice(5), ph = tb.photos || [];
  return `<div class="ucard u-mem tbhero">
    <div class="row"><span class="bubble sm">${icon('heart',16)}</span><span class="kicker" style="flex:1">${esc(agoLabel(tb))}${exact ? ', jour pour jour' : ''}</span><button class="x" style="border:0;background:none;color:var(--muted)" data-act="dismiss" data-v="tb" aria-label="Masquer">${icon('x',18)}</button></div>
    ${ph[0] ? `<button class="tbimg" data-act="openMemory" data-id="${tb.id}" aria-label="Revoir ce souvenir">${photoImg(ph[0])}${ph.length > 1 ? `<span class="tbcount">${ph.length} photos</span>` : ''}</button>` : ''}
    <div><strong>${esc(tb.title)}</strong><br><span class="muted small">${esc(cap(fmt(tb.date,{weekday:'long', day:'numeric', month:'long', year:'numeric'})))}</span></div>
    <div class="row">${ph.length ? `<button class="btn upri sm" data-act="slidesMemory" data-id="${tb.id}">${icon('play',16)}Diaporama</button>` : ''}<button class="btn soft sm" data-act="openMemory" data-id="${tb.id}">Revoir</button></div></div>`;
}

/* ---------- Diaporama ---------- */
let SL = null;
const SL_MS = 5000;
function slidesOpen(){ return !!SL; }
function memSlides(m){ return (m.photos||[]).map(p => ({path:p, title:m.title, date:m.date})); }
async function startSlides(items){
  items = items.filter(x => x.path).slice(0, 200);
  if (!items.length) { toast('Pas encore de photos à montrer.'); return; }
  if (SL) closeSlides();
  const el = document.createElement('div');
  el.className = 'slides'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Diaporama');
  el.innerHTML = `<div class="sl-stage"><img class="sl-img" alt=""><img class="sl-img" alt=""></div>
    <div class="sl-bar"><b></b></div>
    <div class="sl-cap"><strong></strong><span></span></div>
    <div class="sl-ctl"><button data-sl="prev" aria-label="Photo précédente">${icon('chevron-left',24)}</button><button data-sl="play" aria-label="Pause">${icon('pause',22)}</button><button data-sl="next" aria-label="Photo suivante">${icon('chevron-right',24)}</button></div>
    <button class="sl-x" data-sl="close" aria-label="Fermer">${icon('x',22)}</button>
    <div class="sl-load">Chargement des photos…</div>`;
  document.body.appendChild(el);
  SL = {el, items, i:0, playing:true, timer:null, front:0};
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-sl]'); if (b) { slideCmd(b.dataset.sl); return; }
    const x = ev.clientX / window.innerWidth; slideCmd(x < .3 ? 'prev' : x > .7 ? 'next' : 'play');
  });
  try { if (navigator.wakeLock) SL.lock = await navigator.wakeLock.request('screen'); } catch(e){}
  try { await photoUrls(items.map(x => x.path)); } catch(e){ console.warn(e); }
  if (!SL || SL.el !== el) return;
  const ld = el.querySelector('.sl-load'); if (ld) ld.remove();
  showSlide(0);
}
function showSlide(i, tries=0){
  if (!SL) return;
  const n = SL.items.length; SL.i = ((i % n) + n) % n;
  const it = SL.items[SL.i], url = photoUrl(it.path);
  clearTimeout(SL.timer);
  if (!url) { if (tries < n) showSlide(SL.i + 1, tries + 1); else closeSlides(); return; }
  const imgs = SL.el.querySelectorAll('.sl-img'), next = imgs[1 - SL.front], cur = imgs[SL.front];
  next.onload = () => { if (!SL) return; next.classList.add('on'); cur.classList.remove('on'); SL.front = 1 - SL.front; };
  next.src = url;
  SL.el.querySelector('.sl-cap strong').textContent = it.title || '';
  SL.el.querySelector('.sl-cap span').textContent = `${cap(fmt(it.date,{day:'numeric', month:'long', year:'numeric'}))} · ${SL.i+1}/${n}`;
  const bar = SL.el.querySelector('.sl-bar b'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
  const nx = SL.items[(SL.i + 1) % n]; if (nx && photoUrl(nx.path)) { const pre = new Image(); pre.src = photoUrl(nx.path); }
  if (SL.playing && n > 1) SL.timer = setTimeout(() => showSlide(SL.i + 1), SL_MS);
}
function slideCmd(c){
  if (!SL) return;
  if (c === 'close') return closeSlides();
  if (c === 'prev') return showSlide(SL.i - 1);
  if (c === 'next') return showSlide(SL.i + 1);
  if (c === 'play') {
    SL.playing = !SL.playing; SL.el.classList.toggle('paused', !SL.playing);
    const b = SL.el.querySelector('[data-sl="play"]'); b.innerHTML = icon(SL.playing ? 'pause' : 'play', 22); b.setAttribute('aria-label', SL.playing ? 'Pause' : 'Lecture');
    if (SL.playing) showSlide(SL.i); else clearTimeout(SL.timer);
  }
}
function closeSlides(fromPop){
  if (!SL) return;
  clearTimeout(SL.timer); SL.el.remove();
  try { if (SL.lock) SL.lock.release(); } catch(e){}
  SL = null;
}
document.addEventListener('keydown', e => {
  if (!SL) return;
  if (e.key === 'ArrowLeft') slideCmd('prev'); else if (e.key === 'ArrowRight') slideCmd('next');
  else if (e.key === 'Escape') slideCmd('close'); else if (e.key === ' ') { e.preventDefault(); slideCmd('play'); }
});
Object.assign(H, {
  slidesMemory: el => { const m = S.memories.get(el.dataset.id); if (m) startSlides(memSlides(m)); },
  slidesAll: () => {
    const f = S.memFilter || 'all';
    const list = [...S.memories.values()].filter(m => f === 'all' || (m.members||[]).includes(f)).sort((a,b) => a.date.localeCompare(b.date));
    startSlides(list.flatMap(memSlides));
  },
});

/* ---------- Confettis ---------- */
function confetti(){
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch(e){}
  const c = document.createElement('canvas'), W = window.innerWidth, Hh = window.innerHeight, dpr = window.devicePixelRatio || 1;
  c.className = 'confetti'; c.width = W * dpr; c.height = Hh * dpr; document.body.appendChild(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#789985','#E9A46A','#F2C94C','#9C8BC9','#E88A8A','#6FA8C9','#A3C48A'];
  const P = Array.from({length:150}, () => ({x: W/2 + (Math.random()-.5)*120, y: Hh*.4, vx: (Math.random()-.5)*14, vy: -Math.random()*15 - 5,
    w: Math.random()*7 + 5, c: cols[Math.random()*cols.length|0], a: Math.random()*6, va: (Math.random()-.5)*.35}));
  const t0 = performance.now(); let last = t0;
  (function frame(t){
    const dt = Math.min(40, t - last) / 16; last = t;
    g.clearRect(0, 0, W, Hh);
    for (const p of P) { p.vy += .38*dt; p.vx *= .985; p.x += p.vx*dt; p.y += p.vy*dt; p.a += p.va*dt;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.w/2, -p.w/4, p.w, p.w/2); g.restore(); }
    if (t - t0 < 2800) requestAnimationFrame(frame); else c.remove();
  })(t0);
}
const CHEERED = new Set();
function cheerOnce(key, today, msg){
  const k = key + '|' + today;
  if (CHEERED.has(k) || LS.get('cotribu-cheer-' + key) === today) return false;
  CHEERED.add(k); LS.set('cotribu-cheer-' + key, today);
  confetti(); setTimeout(() => toast(msg), 60); return true; // après le toast des points
}
// appelé quand une tâche vient d'être cochée
function celebrate(who, today){
  const all = todayItems(today).filter(x => !x.st.late);
  if (all.length > 1 && all.every(x => x.st.done)) { cheerOnce('all', today, 'Tout est fait aujourd’hui, bravo la tribu !'); return; }
  const m = who && S.members.get(who);
  if (m && m.kid) {
    const mine = all.filter(x => assigneesOn(x.t, today).includes(who));
    if (mine.length && mine.every(x => x.st.done)) cheerOnce('k-' + who, today, `Bravo ${m.name} ! Toutes tes tâches du jour sont faites`);
  }
}
