/* CoTribu — mode cuisine : ingrédients à cocher, une étape à la fois en grand, minuteurs, lecture à voix haute.
   L'écran reste allumé pendant qu'on cuisine. */

let CK = null;
function cookOpen(){ return !!CK; }
function startCook(r){
  if (!r || !(r.steps || []).length) { toast('Ajoute les étapes de la recette pour utiliser le mode cuisine.'); return; }
  if (CK) closeCook();
  const el = document.createElement('div');
  el.className = 'cook'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Mode cuisine');
  document.body.appendChild(el);
  CK = {el, r, i: -1, got: new Set(), timer: null};
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { if (CK) CK.lock = l; }).catch(() => {}); } catch(_){}
  el.addEventListener('click', ev => { const b = ev.target.closest('[data-ck]'); if (b) cookCmd(b.dataset.ck, b.dataset.v); });
  cookRender();
}
// « cuire 10 min », « 1 h 30 », « 45 secondes » → minuteurs proposés
function timersIn(text){
  const out = [], re = /(\d+(?:[.,]\d+)?)\s*(?:à\s*(\d+)\s*)?(heures?|h|minutes?|min|mn|secondes?|sec|s)(?![a-zà-ü])(?:\s*(\d+))?/gi; let m;
  while ((m = re.exec(text)) && out.length < 3) {
    const n = parseFloat(m[2] || m[1].replace(',', '.')), u = m[3].toLowerCase();
    let sec = u.startsWith('h') ? n * 3600 + (m[4] ? +m[4] * 60 : 0) : u.startsWith('m') ? n * 60 + (m[4] && +m[4] < 60 ? +m[4] : 0) : n;
    if (sec >= 10 && sec <= 6 * 3600) out.push({sec: Math.round(sec), label: m[0].trim()});
  }
  return out;
}
const fmtSec = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}` : `${m}:${String(x).padStart(2,'0')}`; };
function cookRender(){
  if (!CK) return;
  const {r, i} = CK, n = r.steps.length;
  let body;
  if (i < 0) {
    body = `<div class="ck-intro">${r.image ? `<img class="ck-img" src="${esc(r.image)}" alt="" referrerpolicy="no-referrer">` : ''}
      <h1>${esc(r.name || 'Recette')}</h1><span class="muted">${n} étape${n>1?'s':''}${r.time ? ` · ${r.time} min` : ''}${r.servings ? ` · ${esc(r.servings)}` : ''}</span>
      ${(r.ingredients||[]).length ? `<h3>Ingrédients <span class="muted small">(touche ce que tu as sorti)</span></h3><div class="ck-ingr">${r.ingredients.map((g,k) => `<button data-ck="got" data-v="${k}" class="${CK.got.has(k)?'on':''}">${icon(CK.got.has(k)?'check':'circle-check',18)}<span>${esc([g.qty, g.name].filter(Boolean).join(' '))}</span></button>`).join('')}</div>` : ''}</div>`;
  } else if (i >= n) {
    body = `<div class="ck-end">${icon('party-popper',64)}<h1>Bon appétit !</h1><span class="muted">${esc(r.name || '')}</span></div>`;
  } else {
    const t = r.steps[i], tm = timersIn(t);
    body = `<div class="ck-step"><span class="kicker">Étape ${i+1} sur ${n}</span><p>${esc(t)}</p>
      <div class="ck-tools u-shop">${tm.map(x => `<button class="btn upri sm" data-ck="timer" data-v="${x.sec}">${icon('clock',16)}Minuteur ${esc(x.label)}</button>`).join('')}
        ${'speechSynthesis' in window ? `<button class="btn soft sm" data-ck="speak">${icon('mic',16)}Lire à voix haute</button>` : ''}</div></div>`;
  }
  const bar = CK.timer ? `<div class="ck-timer ${CK.timer.left <= 0 ? 'ring' : ''}">${icon('clock',18)}<b class="num">${CK.timer.left <= 0 ? 'Terminé !' : fmtSec(CK.timer.left)}</b><button data-ck="stopTimer">${CK.timer.left <= 0 ? 'OK' : 'Arrêter'}</button></div>` : '';
  CK.el.innerHTML = `<div class="ck-top"><span class="ck-dots">${i >= 0 && i < n ? r.steps.map((_,k) => `<i class="${k<=i?'on':''}"></i>`).join('') : ''}</span><button class="ck-x" data-ck="close" aria-label="Fermer">${icon('x',22)}</button></div>
    <div class="ck-body">${body}</div>${bar}
    <div class="ck-nav">${i >= 0 ? `<button class="btn soft" data-ck="prev">${icon('chevron-left',20)}${i === 0 ? 'Ingrédients' : 'Précédent'}</button>` : ''}
      ${i < n ? `<button class="btn deep" data-ck="next">${i < 0 ? 'Commencer' : i === n - 1 ? 'Terminer' : 'Suivant'}${icon('chevron-right',20)}</button>` : `<button class="btn deep" data-ck="close">Fermer</button>`}</div>`;
}
function cookBeep(){
  try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch(_){}
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .35, .7].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.25, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .3); o.start(a.currentTime + t); o.stop(a.currentTime + t + .3); }); } catch(_){}
  try { if (Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification('⏰ Minuteur terminé', {body: CK && CK.r.name || 'CoTribu', tag: 'cook-timer', icon: 'icons/icon-192.png', badge: 'icons/badge.png'})); } catch(_){}
}
function cookCmd(c, v){
  if (!CK) return;
  const n = CK.r.steps.length;
  if (c === 'close') return closeCook();
  if (c === 'next') { CK.i = Math.min(n, CK.i + 1); try { speechSynthesis.cancel(); } catch(_){} }
  else if (c === 'prev') { CK.i = Math.max(-1, CK.i - 1); try { speechSynthesis.cancel(); } catch(_){} }
  else if (c === 'got') { const k = +v; CK.got.has(k) ? CK.got.delete(k) : CK.got.add(k); }
  else if (c === 'speak') { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(CK.r.steps[CK.i]); u.lang = 'fr-FR'; speechSynthesis.speak(u); } catch(_){} return; }
  else if (c === 'timer') {
    if (CK.timer) clearInterval(CK.timer.h);
    const end = Date.now() + (+v) * 1000;
    CK.timer = {end, left: +v, h: setInterval(() => { if (!CK || !CK.timer) return; const was = CK.timer.left; CK.timer.left = (CK.timer.end - Date.now()) / 1000;
      if (was > 0 && CK.timer.left <= 0) { clearInterval(CK.timer.h); cookBeep(); }
      const b = CK.el.querySelector('.ck-timer b'); if (b && CK.timer.left > 0) b.textContent = fmtSec(CK.timer.left); else cookRender(); }, 500)};
  }
  else if (c === 'stopTimer') { if (CK.timer) clearInterval(CK.timer.h); CK.timer = null; }
  cookRender();
}
function closeCook(fromPop){
  if (!CK) return;
  if (CK.timer) clearInterval(CK.timer.h);
  try { speechSynthesis.cancel(); } catch(_){}
  try { if (CK.lock) CK.lock.release(); } catch(_){}
  CK.el.remove(); CK = null;
}
document.addEventListener('keydown', e => { if (!CK) return; if (e.key === 'Escape') closeCook(); else if (e.key === 'ArrowRight') cookCmd('next'); else if (e.key === 'ArrowLeft') cookCmd('prev'); });
Object.assign(H, {
  cook: el => {
    const m = S.meals.get(el.dataset.id); if (!m) return;
    const rec = typeof mealRecipe === 'function' && mealRecipe(m); if (rec && (rec.steps||[]).length) { cookRecipe(rec); return; }
    if ((m.steps||[]).length) { startCook(m); return; }
    H.editMeal({dataset:{id: m.id}}); toast('Écris les étapes de la recette (une par ligne), puis touche « Cuisiner ce plat ».');
    setTimeout(() => { const t = document.getElementById('me-steps'); if (t) { t.scrollIntoView({block:'center'}); t.focus(); } }, 250);
  },
  cookFromDraft: () => { const d = S.draft;
    if (!String(d.stepsText||'').trim()) { toast('Écris d’abord les étapes de la recette, une par ligne, juste en dessous.'); const t = document.getElementById('me-steps'); if (t) { t.scrollIntoView({block:'center'}); t.focus(); } return; }
    startCook({name: d.name, ingredients: parseIngredients(d.ingrText), steps: String(d.stepsText||'').split('\n').map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean), image: d.image, time: d.time, servings: d.servings}); },
});
