/* CoTribu — Premium par foyer, codes cadeaux, lien Google Agenda */

const isPremium = () => !!(S.hh && S.hh.premium_until && new Date(S.hh.premium_until) > new Date());
function premiumUntilLabel(){
  if (!isPremium()) return '';
  const d = new Date(S.hh.premium_until);
  if (d.getFullYear() >= 2090) return S.hh.premium_source === 'offert' ? 'Offert à vie' : 'À vie';
  return 'Jusqu’au ' + d.toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'}) + (S.hh.premium_source === 'cadeau' ? ' (code cadeau)' : S.hh.premium_source === 'offert' ? ' (offert)' : '');
}
const PREMIUM_FEATURES = [
  ['sparkles','Ajouter en une phrase','« Rafaël a judo mercredi à 17h30 », « lait, œufs, lessive » : c’est rangé tout seul.'],
  ['camera','Photo du mot de l’école','Les dates vont au planning, les ingrédients d’une recette aux courses.'],
  ['chef-hat','Menus de la semaine','Des idées de repas selon vos goûts, et la liste de courses qui va avec.'],
  ['users','Répartition plus juste','L’IA repère qui en fait trop et propose des tours de rôle.'],
  ['book-open','Album de l’année','Vos souvenirs racontés mois par mois.'],
];
function requirePremium(){
  if (isPremium()) return true;
  openSheet('premiumGate'); return false;
}
SHEETS.premiumGate = () => `<div class="prem"><span class="badge">Premium</span><h2>Une fonction CoTribu Premium</h2>
    <span>L’IA de CoTribu fait gagner du temps chaque jour. Elle est incluse dans l’abonnement Premium du foyer : un seul paiement pour toute la famille.</span></div>
  <label class="f" for="gift-code2">Tu as un code cadeau ?<input type="text" id="gift-code2" class="codein" data-ch="giftCode" value="${esc(S.giftCode||'')}" autocomplete="off" autocapitalize="characters" placeholder="CODE"></label>
  <button class="btn deep" data-act="redeem">Utiliser le code</button>
  <button class="btn soft" data-act="goPremium">Découvrir Premium</button>`;

function viewPremium(){
  const on = isPremium();
  let h = backBtn('Plus') + ptitle('CoTribu Premium', 'Pour toute la famille, un seul abonnement.');
  h += `<div class="prem"><span class="badge">${on ? 'Actif' : 'Premium'}</span>
    <h2>${on ? 'Votre foyer est Premium' : 'Moins penser, encore plus'}</h2>
    <span>${on ? esc(premiumUntilLabel()) : 'Tout ce qui est essentiel reste gratuit. Premium ajoute l’IA qui fait le travail à votre place.'}</span>
    ${on && S.aiUsage != null ? `<span class="small">Demandes à l’IA ce mois-ci : <b class="num">${S.aiUsage}</b> sur 300</span>` : ''}</div>`;
  h += `<div class="card">${PREMIUM_FEATURES.map(([ic,t,s]) => `<div class="feat"><span class="bubble" style="background:${on?'var(--done)':'#343532'};color:#fff">${icon(on?'check':ic,16)}</span><div><strong>${esc(t)}</strong><div class="muted small">${esc(s)}</div></div></div>`).join('')}</div>`;
  if (!on) h += `<div class="card"><h3>S’abonner</h3><span class="muted small">L’abonnement (5 € par mois ou 39,99 € par an pour tout le foyer) arrivera avec la version Play Store.</span><button class="btn soft" disabled>Bientôt disponible</button></div>`;
  h += `<div class="card"><h3>Code cadeau</h3><span class="muted small">Quelqu’un t’a offert CoTribu Premium ? Entre ton code ici.</span>
    <input type="text" id="gift-code" class="codein" data-ch="giftCode" value="${esc(S.giftCode||'')}" autocomplete="off" autocapitalize="characters" placeholder="CODE">
    <button class="btn deep" data-act="redeem" ${S.busy?'disabled':''}>Utiliser le code</button></div>`;
  return h;
}
async function loadAiUsage(){
  if (!isPremium()) return;
  const {data} = await sb.from('ai_usage').select('calls').eq('household_id', S.hh.id).eq('month', new Date().toISOString().slice(0,7)).maybeSingle();
  S.aiUsage = data ? data.calls : 0; render();
}

/* ---------- Google Agenda ---------- */
const icsBase = () => `${SUPABASE_URL}/functions/v1/cotribu-ics?t=${S.icsToken}`;
function icsCard(){
  if (!S.icsToken) return `<div class="card u-plan"><div class="row"><span class="bubble">${icon('calendar',18)}</span><h3>Google Agenda</h3></div>
    <span class="small">Affiche le planning de la famille dans Google Agenda (ou l’agenda de ton téléphone), à côté de tes rendez-vous perso.</span>
    <button class="btn upri" data-act="icsGet">Obtenir le lien</button></div>`;
  const mine = S.me ? `${icsBase()}&m=${encodeURIComponent(S.me)}` : '';
  return `<div class="card u-plan"><div class="row"><span class="bubble">${icon('calendar',18)}</span><h3>Google Agenda</h3></div>
    <span class="small"><b>Tout le planning de la famille :</b></span>
    <div class="linkbox"><input type="text" id="ics-all" readonly value="${esc(icsBase())}" aria-label="Lien agenda de la famille"><button class="btn soft sm" data-act="copy" data-target="ics-all">Copier</button></div>
    ${mine ? `<span class="small"><b>Seulement mes événements (${esc(nameOf(S.me))}) :</b></span>
    <div class="linkbox"><input type="text" id="ics-me" readonly value="${esc(mine)}" aria-label="Lien agenda personnel"><button class="btn soft sm" data-act="copy" data-target="ics-me">Copier</button></div>` : ''}
    <ol class="steps small"><li>Copie un lien.</li><li>Sur un ordinateur, ouvre <b>calendar.google.com</b>.</li><li>À gauche, à côté de « Autres agendas », clique sur <b>+</b> puis <b>À partir de l’URL</b>.</li><li>Colle le lien et valide. L’agenda apparaît aussi sur ton téléphone.</li></ol>
    <span class="info">Google met à jour ce type d’agenda toutes les quelques heures. Ce lien est privé : ne le partage qu’avec ta famille.</span>
    <button class="btn danger sm ${S.armed==='ics'?'armed':''}" data-act="icsReset">${S.armed==='ics'?'Confirmer : l’ancien lien ne marchera plus':'Changer le lien (si il a été partagé par erreur)'}</button></div>`;
}
async function icsGet(reset=false){
  const {data, error} = await sb.rpc('get_ics_token', {p_household:S.hh.id, p_reset:reset});
  if (error) { toast(explain(error)); return; }
  S.icsToken = data; render(); if (reset) toast('Nouveau lien créé');
}

Object.assign(H, {
  goPremium: () => { if (S.sheet) closeSheet(); S.tab = 'plus'; goSub(() => { S.sub.plus = 'premium'; }); loadAiUsage(); },
  redeem: async () => {
    const code = (S.giftCode||'').trim().toUpperCase(); if (!code) { toast('Entre ton code.'); return; }
    S.busy = true; render();
    const {data, error} = await sb.rpc('redeem_gift', {p_household:S.hh.id, p_code:code});
    S.busy = false;
    if (error) { render(); toast(explain(error)); return; }
    S.hh = {...S.hh, ...data}; S.giftCode = ''; if (S.sheet) closeSheet(); render(); toast('Bienvenue dans CoTribu Premium !');
  },
  icsGet: () => icsGet(false),
  icsReset: () => { if (S.armed !== 'ics') { S.armed = 'ics'; render(); return; } S.armed = null; icsGet(true); },
  copy: async el => {
    const i = document.getElementById(el.dataset.target); if (!i) return;
    try { await navigator.clipboard.writeText(i.value); toast('Lien copié'); } catch(e) { i.select(); toast('Sélectionne le lien pour le copier'); }
  },
});
Object.assign(CH, { giftCode: el => { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if (v !== el.value) el.value = v; S.giftCode = v; } });
LIVE.add('giftCode');
