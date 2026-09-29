/* CoTribu — demande de note sur le Play Store / l'App Store, au bon moment.
   Règles : pas avant 7 jours ni 5 jours d'utilisation, seulement après un moment positif, jamais pour les proches,
   « Plus tard » repousse d'un mois, 3 refus = on ne redemande plus. Les deux choix (noter / signaler un souci)
   sont toujours proposés ensemble : pas de filtrage des avis (règles Google Play et Apple). */

// À REMPLIR AU LANCEMENT : identifiant Play Store (ex. 'fr.cotribu.app') et lien App Store.
const STORE = { play: '', apple: '' };

function storeUrl(){
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua) && STORE.play) return `https://play.google.com/store/apps/details?id=${STORE.play}`;
  if (/iPhone|iPad|iPod/i.test(ua) && STORE.apple) return STORE.apple;
  return '';
}
const storeName = () => /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ? 'l’App Store' : 'le Play Store';

// jours d'utilisation (comptés sur ce téléphone)
(function trackUse(){
  try {
    const today = localToday(), u = JSON.parse(LS.get('cotribu-use') || 'null') || {first: today, days: 0, last: ''};
    if (u.last !== today) { u.days++; u.last = today; LS.set('cotribu-use', JSON.stringify(u)); }
  } catch(_){}
})();
const rateState = () => { try { return JSON.parse(LS.get('cotribu-rate') || '{}'); } catch(_) { return {}; } };
const setRate = o => LS.set('cotribu-rate', JSON.stringify({...rateState(), ...o}));

// un moment positif (confettis, merci reçu) rend la demande possible pendant cette session
if (typeof cheerOnce === 'function') { const _cheer = cheerOnce; cheerOnce = function(...a){ const r = _cheer.apply(this, a); if (r) S.happy = true; return r; }; }

function rateCard(){
  if (S.role === 'proche' || !S.me) return '';
  const st = rateState(), today = localToday();
  if (st.done || (st.dismiss || 0) >= 3 || (st.next && today < st.next)) return '';
  let u; try { u = JSON.parse(LS.get('cotribu-use') || 'null'); } catch(_) {}
  if (!u || u.days < 5 || idx(today) - idx(u.first) < 7) return '';
  const doneToday = todayItems(today).some(x => x.st.done);
  const thanked = typeof unseenThanks === 'function' && unseenThanks().length > 0;
  if (!S.happy && !doneToday && !thanked) return '';
  const url = storeUrl();
  if (url) return `<div class="ucard u-warm ratecard"><div class="row"><span class="stars" aria-hidden="true">★★★★★</span><button class="x" style="margin-left:auto;border:0;background:none;color:var(--muted)" data-act="rateLater" aria-label="Plus tard">${icon('x',18)}</button></div>
    <h3>Tu aimes CoTribu ?</h3><span class="small">Une note sur ${storeName()} prend 10 secondes et aide d’autres familles à nous trouver. Merci !</span>
    <div class="row"><button class="btn upri sm" data-act="rateGo">${icon('star',16)}Noter CoTribu</button><button class="btn soft sm" data-act="rateLater">Plus tard</button></div>
    <button class="linkbtn small" data-act="rateIssue">Un souci ? Dis-le-nous directement</button></div>`;
  // pas encore sur les stores (ou version web) : on propose de recommander CoTribu
  return `<div class="ucard u-warm ratecard"><div class="row"><span class="bubble sm">${icon('heart-handshake',16)}</span><h3 style="flex:1">Tu aimes CoTribu ?</h3><button class="x" style="border:0;background:none;color:var(--muted)" data-act="rateLater" aria-label="Plus tard">${icon('x',18)}</button></div>
    <span class="small">Parle-en à une famille autour de toi : c’est comme ça que CoTribu grandit.</span>
    <div class="row"><button class="btn upri sm" data-act="recommend">${icon('share-2',16)}Recommander CoTribu</button><button class="btn soft sm" data-act="rateLater">Plus tard</button></div>
    <button class="linkbtn small" data-act="rateIssue">Un souci ? Dis-le-nous directement</button></div>`;
}
async function recommendApp(){
  const url = location.origin + location.pathname.replace(/index\.html$/, '');
  const text = 'On utilise CoTribu pour organiser la maison : tâches, courses, planning et souvenirs, partagés avec toute la famille. C’est gratuit, essaie !';
  try { if (navigator.share) { await navigator.share({title: 'CoTribu', text, url}); return true; } } catch(e) { if (e && e.name === 'AbortError') return false; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Lien copié : colle-le dans un message.'); return true; } catch(_) { toast(url); return false; }
}
Object.assign(H, {
  rateGo: () => { const url = storeUrl(); setRate({done: true, at: localToday()}); if (url) window.open(url, '_blank', 'noopener'); render(); toast('Merci beaucoup ! 💛'); },
  rateLater: () => { const st = rateState(); setRate({dismiss: (st.dismiss || 0) + 1, next: addDays(localToday(), 30)}); render(); },
  rateIssue: () => { setRate({next: addDays(localToday(), 30)}); H.feedbackOpen(); S.draft.kind = 'probleme'; renderSheet(); render(); },
  recommend: async () => { const ok = await recommendApp(); if (ok) { setRate({next: addDays(localToday(), 90)}); render(); } },
  rateMenu: () => { const url = storeUrl(); if (url) { setRate({done: true, at: localToday()}); window.open(url, '_blank', 'noopener'); } else recommendApp(); },
});
