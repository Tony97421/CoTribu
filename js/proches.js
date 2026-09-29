/* CoTribu — cercle de proches et demandes de garde */

const procheLink = () => location.origin + location.pathname + '?proche=' + (S.hh && S.hh.proche_code || '');
function notifyPush(kind, id){
  return sb.functions.invoke('cotribu-push', {body:{mode:'notify', kind, household:S.hh.id, id}}).catch(() => {});
}
function reqWhen(r){
  return cap(fmt(r.date,{weekday:'long', day:'numeric', month:'long'})) + (r.allDay || !r.start ? ' · toute la journée' : ` · ${hm(r.start)}${r.end ? ' - ' + hm(r.end) : ''}`);
}
function reqStatus(r){
  if (r.status === 'accepted') return `<span class="status ok">${esc(nameOf(r.acceptedBy))} a accepté</span>`;
  if (r.status === 'declined') return `<span class="status no">Personne n’est disponible</span>`;
  if (r.status === 'cancelled') return `<span class="status">Annulée</span>`;
  const counters = Object.values(r.responses || {}).filter(x => x.answer === 'counter').length;
  return `<span class="status wait">En attente${counters ? ' · ' + counters + ' proposition' + (counters>1?'s':'') : ''}</span>`;
}
const stColor = r => r.status === 'accepted' ? 'var(--done)' : r.status === 'declined' ? 'var(--late)' : r.status === 'cancelled' ? 'var(--faint)' : 'var(--shop)';
function reqResponses(r){
  return (r.to||[]).map(pid => {
    const x = (r.responses||{})[pid];
    const label = !x ? 'n’a pas encore répondu' : x.answer === 'accept' ? 'accepte' : x.answer === 'decline' ? 'ne peut pas' : 'propose autre chose';
    return `<div class="resp">${avatar(pid)}<span><b>${esc(nameOf(pid))}</b> ${label}${x && x.note ? ` : « ${esc(x.note)} »` : ''}</span></div>`;
  }).join('');
}
function reqCard(r, forFamily=true){
  const kids = (r.children||[]).filter(id => S.members.has(id)).map(nameOf);
  return `<div class="req" style="--st:${stColor(r)}" ${forFamily?`data-act="openRequest" data-id="${r.id}" role="button" tabindex="0"`:''}>
    <div class="row"><span class="t" style="flex:1">${esc(r.title)}</span>${forFamily ? reqStatus(r) : ''}</div>
    <span class="s">${esc(reqWhen(r))}${r.place ? ' · ' + esc(r.place) : ''}</span>
    ${kids.length ? `<span class="s">${icon('baby',14,'style="display:inline;vertical-align:-2px"')} ${esc(kids.join(', '))}</span>` : ''}
    ${r.note ? `<span class="s">« ${esc(r.note)} »</span>` : ''}
    ${forFamily ? reqResponses(r) : ''}
  </div>`;
}
const openRequests = () => [...S.requests.values()].filter(r => r.status !== 'cancelled' && r.date >= localToday()).sort((a,b) => a.date.localeCompare(b.date));

/* ---------- côté famille ---------- */
function viewProches(){
  let h = backBtn('Plus') + ptitle('Proches', 'Grands-parents, nounou, voisins : ceux qui donnent un coup de main.');
  const ps = sorted(S.proches);
  h += `<div class="card u-lav"><div class="row"><span class="bubble">${icon('users',18)}</span><h3>Le cercle de proches</h3></div>
    ${ps.length ? ps.map(p => `<div class="mrow">${avatar(p.id,'lg')}<span style="flex:1;font-weight:600">${esc(p.name)}</span><button class="btn danger sm ${S.armed==='p'+p.id?'armed':''}" data-act="removeProche" data-id="${p.id}">${S.armed==='p'+p.id?'Confirmer':'Retirer'}</button></div>`).join('') : '<span class="muted small">Personne pour l’instant.</span>'}
    <span class="small">Un proche ne voit ni vos tâches, ni vos courses, ni vos souvenirs : seulement les demandes que vous lui envoyez et les moments où il est attendu.</span>
    <div class="code num" style="background:var(--lav-soft);color:var(--lav-text)">${esc(S.hh.proche_code||'······')}</div>
    <div class="linkbox"><input type="text" id="proche-link" readonly value="${esc(procheLink())}" aria-label="Lien pour les proches"></div>
    <button class="btn upri" data-act="shareProche">${icon('share-2',18)}Inviter un proche</button></div>`;
  h += `<div class="row"><h2 style="flex:1">Demandes</h2><button class="btn upri sm u-lav" data-act="newRequest">${icon('plus',16)}Nouvelle demande</button></div>`;
  const list = [...S.requests.values()].sort((a,b) => (a.date < localToday()) - (b.date < localToday()) || a.date.localeCompare(b.date));
  h += list.length ? list.slice(0,30).map(r => reqCard(r)).join('') : `<div class="empty"><span class="muted">Besoin que Mamie garde les enfants samedi ? Crée une demande : elle reçoit une notification et répond en un geste.</span></div>`;
  return h;
}
async function shareProche(){
  const text = `Bonjour ! Pour nous donner un coup de main facilement (gardes, sorties d’école…), rejoins notre cercle sur CoTribu : ${procheLink()}`;
  if (navigator.share) { try { await navigator.share({title:'CoTribu', text}); return; } catch(e){ if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Invitation copiée'); } catch(e) { const i = document.getElementById('proche-link'); if (i) i.select(); toast('Sélectionne le lien pour le copier'); }
}
function draftRequest(){
  const kids = [];
  return {id:null, type:'garde', title:'', children:kids, date:addDays(localToday(),1), allDay:false, start:'14:00', end:'18:00', place:'À la maison', note:'', to:sorted(S.proches).slice(0,1).map(p=>p.id)};
}
function autoTitle(d){
  const names = d.children.filter(id => S.members.has(id)).map(nameOf);
  if (d.type === 'garde') return names.length ? 'Garder ' + (names.length > 1 ? names.slice(0,-1).join(', ') + ' et ' + names.at(-1) : names[0]) : 'Garder les enfants';
  return d.title || '';
}
SHEETS.request = () => {
  const d = S.draft, ms = sorted(S.members), ps = sorted(S.proches);
  if (!ps.length) return `<h2>Nouvelle demande</h2><span class="info">Invite d’abord un proche (Plus → Proches), puis envoie-lui ta demande.</span><button class="btn soft" data-act="close">Fermer</button>`;
  return `<h2>Nouvelle demande</h2>
    ${seg('rqType', d.type, [['garde','Garde d’enfants'],['autre','Autre coup de main']], 'u-lav')}
    ${d.type === 'garde' ? `<div class="sect"><span class="eyebrow">Qui garder</span><div class="chips u-lav">${ms.map(m => `<button class="chip" data-act="rqChild" data-id="${m.id}" aria-pressed="${d.children.includes(m.id)}">${avatar(m.id)}${esc(m.name)}</button>`).join('')}</div></div>`
      : `<label class="f" for="rq-title">Ce dont tu as besoin<input type="text" id="rq-title" data-ch="rqTitle" value="${esc(d.title)}" placeholder="Ex. Récupérer les enfants à l’école"></label>`}
    <div class="frow"><label class="f" for="rq-date">Date<input type="date" id="rq-date" data-ch="rqDate" value="${esc(d.date)}"></label></div>
    <label class="toggle"><input type="checkbox" id="rq-all" data-ch="rqAll" ${d.allDay?'checked':''}>Toute la journée</label>
    ${d.allDay ? '' : `<div class="frow"><label class="f" for="rq-start">De<input type="time" id="rq-start" data-ch="rqStart" value="${esc(d.start)}"></label><label class="f" for="rq-end">À<input type="time" id="rq-end" data-ch="rqEnd" value="${esc(d.end)}"></label></div>`}
    ${typeof availLine === 'function' ? availLine(d.date, d.allDay ? '' : d.start, d.allDay ? '' : d.end, {adults: true}) : ''}
    <label class="f" for="rq-place">Où<input type="text" id="rq-place" data-ch="rqPlace" value="${esc(d.place)}" data-ac="place" autocomplete="off" autocorrect="off" spellcheck="false"></label>
    <label class="f" for="rq-note">Petit mot<textarea id="rq-note" data-ch="rqNote" placeholder="Ex. Le goûter est dans le placard, sieste vers 14h">${esc(d.note)}</textarea></label>
    <div class="sect"><span class="eyebrow">À qui demander</span><div class="chips u-lav">${ps.map(p => `<button class="chip" data-act="rqTo" data-id="${p.id}" aria-pressed="${d.to.includes(p.id)}">${avatar(p.id)}${esc(p.name)}</button>`).join('')}</div>
      <span class="info">Si tu choisis plusieurs personnes, la première qui accepte prend la garde.</span></div>
    <div class="actions"><button class="btn upri u-lav" data-act="sendRequest">${icon('bell',18)}Envoyer la demande</button><button class="btn soft" data-act="close">Annuler</button></div>`;
};
SHEETS.requestView = () => {
  const r = S.requests.get(S.viewId); if (!r) return '';
  return `<h2>${esc(r.title)}</h2>${reqStatus(r)}
    <span class="muted">${esc(reqWhen(r))}${r.place ? ' · ' + placeLink(r.place) : ''}</span>
    ${r.note ? `<span>« ${esc(r.note)} »</span>` : ''}
    <div class="sect"><span class="eyebrow">Réponses</span>${reqResponses(r)}</div>
    ${r.status !== 'cancelled' ? `<div class="actions"><button class="btn soft" data-act="remindRequest">${icon('bell',18)}Relancer</button>
      <button class="btn danger ${S.armed==='rq'?'armed':''}" data-act="cancelRequest">${S.armed==='rq'?'Confirmer l’annulation':'Annuler la demande'}</button></div>` : ''}
    <button class="btn soft" data-act="close">Fermer</button>`;
};

/* ---------- côté proche (vue simplifiée) ---------- */
VIEWS.proche = () => {
  const me = S.proches.get(S.me) || {name:''};
  const today = localToday();
  let h = ptitle(`Bonjour ${esc(me.name)} !`, `Proche de la famille ${esc(S.meta.name || '')}`);
  const reqs = [...S.requests.values()].filter(r => r.status !== 'cancelled' && r.date >= today).sort((a,b) => a.date.localeCompare(b.date));
  h += `<h2>Demandes</h2>`;
  h += reqs.length ? reqs.map(r => {
    const mine = (r.responses||{})[S.me] || {};
    let foot;
    if (r.status === 'accepted' && r.acceptedBy === S.me) foot = `<span class="status ok">Tu as accepté, merci !</span><button class="btn soft sm" data-act="answer" data-v="decline" data-id="${r.id}">Finalement, je ne peux pas</button>`;
    else if (r.status === 'accepted') foot = `<span class="status">Déjà pris en charge par ${esc(nameOf(r.acceptedBy))}</span>`;
    else if (mine.answer === 'decline') foot = `<span class="status no">Tu as répondu que tu ne pouvais pas</span><button class="btn soft sm" data-act="answer" data-v="accept" data-id="${r.id}">Finalement, je peux</button>`;
    else foot = `${mine.answer === 'counter' ? `<span class="status wait">Tu as proposé : « ${esc(mine.note)} »</span>` : ''}
      <div class="actions"><button class="btn deep" data-act="answer" data-v="accept" data-id="${r.id}">${icon('check',18)}Accepter</button><button class="btn soft" data-act="answer" data-v="decline" data-id="${r.id}">Pas possible</button></div>
      <button class="btn ghost sm" data-act="counter" data-id="${r.id}">Proposer un autre créneau</button>`;
    return `<div class="req" style="--st:${stColor(r)}">${reqCard(r, false).replace(/^<div class="req"[^>]*>/, '').replace(/<\/div>\s*$/, '')}<span class="s">De la part de ${esc(nameOf(r.by))}</span>${foot}</div>`;
  }).join('') : `<div class="empty"><span class="muted">Aucune demande pour l’instant. Tu recevras une notification quand la famille aura besoin de toi.</span></div>`;
  const evs = [];
  for (let i=0;i<60;i++){ const ds = addDays(today,i); eventsOn(ds).forEach(e => evs.push([ds,e])); }
  h += `<h2>Mes prochains moments avec la famille</h2>`;
  h += evs.length ? `<div style="display:flex;flex-direction:column;gap:10px">${evs.map(([ds,e]) => `<div class="ev" style="--evc:${catOf(e).c};--evs:${catOf(e).soft}"><span class="bubble">${icon(catOf(e).icon,18)}</span><span class="body"><span class="tm">${esc(cap(fmt(ds,{weekday:'long',day:'numeric',month:'long'})))} · ${esc(evTime(e))}</span><span class="t">${esc(e.title)}</span>${e.place?`<span class="loc">${icon('map-pin',13)}${placeLink(e.place)}</span>`:''}</span></div>`).join('')}</div>` : '<span class="muted">Rien de prévu.</span>';
  h += pushCard() + installCard(false);
  h += `<div class="card"><span class="muted small">Tu ne vois que ce que la famille partage avec toi.</span><button class="btn danger ${S.armed==='leave'?'armed':''}" data-act="leave">${S.armed==='leave'?'Confirmer : quitter ce cercle':'Quitter ce cercle sur ce téléphone'}</button></div>`;
  return h;
};
SHEETS.counter = () => `<h2>Proposer autre chose</h2>
  <label class="f" for="co-note">Ta proposition<textarea id="co-note" data-ch="coNote" placeholder="Ex. Je peux à partir de 15h, ou dimanche matin">${esc(S.draft.note||'')}</textarea></label>
  <div class="actions"><button class="btn deep" data-act="sendCounter">Envoyer</button><button class="btn soft" data-act="close">Annuler</button></div>`;

async function answerRequest(id, answer, note=''){
  try {
    const {error} = await sb.rpc('respond_request', {p_household:S.hh.id, p_request:id, p_answer:answer, p_note:note});
    if (error) throw error;
    await loadAll();
    notifyPush('response', id);
    toast(answer === 'accept' ? 'Merci ! La famille est prévenue.' : answer === 'decline' ? 'C’est noté, la famille est prévenue.' : 'Proposition envoyée');
  } catch(e) { toast(explain(e)); }
}

Object.assign(H, {
  shareProche: () => shareProche(),
  removeProche: async el => {
    const k = 'p'+el.dataset.id; if (S.armed !== k) { S.armed = k; render(); return; }
    S.armed = null; const {error} = await sb.rpc('remove_proche', {p_household:S.hh.id, p_proche:el.dataset.id});
    if (error) toast(explain(error)); else { S.proches.delete(el.dataset.id); render(); toast('Proche retiré'); }
  },
  newRequest: () => { S.draft = draftRequest(); openSheet('request'); },
  rqType: el => { S.draft.type = el.dataset.v; renderSheet(); },
  rqChild: el => { const d = S.draft, id = el.dataset.id; d.children = d.children.includes(id) ? d.children.filter(x=>x!==id) : [...d.children, id]; renderSheet(); },
  rqTo: el => { const d = S.draft, id = el.dataset.id; d.to = d.to.includes(id) ? d.to.filter(x=>x!==id) : [...d.to, id]; renderSheet(); },
  sendRequest: async () => {
    const d = S.draft;
    const title = autoTitle(d).trim();
    if (!title) { toast('Dis ce dont tu as besoin.'); return; }
    if (!d.date) { toast('Choisis une date.'); return; }
    if (!d.to.length) { toast('Choisis au moins un proche.'); return; }
    const r = {id:uid('q'), type:d.type, title, children:d.children, date:d.date, allDay:!!d.allDay, start:d.allDay?'':d.start, end:d.allDay?'':d.end,
      place:(d.place||'').trim(), note:(d.note||'').trim(), to:d.to, status:'pending', responses:{}, by:S.me||null, createdAt:new Date().toISOString()};
    closeSheet(); render();
    await put('requests', r); if (typeof thinkCredit === 'function') thinkCredit('requests');
    notifyPush('request', r.id);
    toast(`Demande envoyée à ${d.to.map(nameOf).join(', ')}`);
  },
  openRequest: el => { S.viewId = el.dataset.id; openSheet('requestView'); },
  remindRequest: () => { notifyPush('request', S.viewId); toast('Relance envoyée'); },
  cancelRequest: () => {
    if (S.armed !== 'rq') { S.armed = 'rq'; renderSheet(); return; }
    const r = clone(S.requests.get(S.viewId)); r.status = 'cancelled';
    put('requests', r); if (r.eventId && S.events.has(r.eventId)) del('events', r.eventId);
    closeSheet(); render(); toast('Demande annulée');
  },
  answer: el => answerRequest(el.dataset.id, el.dataset.v),
  counter: el => { S.draft = {id:el.dataset.id, note:''}; openSheet('counter'); },
  sendCounter: () => { const n = (S.draft.note||'').trim(); if (!n) { toast('Écris ta proposition.'); return; } const id = S.draft.id; closeSheet(); answerRequest(id, 'counter', n); },
  pJoin: () => joinAsProche(),
});
Object.assign(CH, {
  rqTitle: el => { S.draft.title = el.value; }, rqDate: el => { S.draft.date = el.value; renderSheet(); }, rqAll: el => { S.draft.allDay = el.checked; renderSheet(); },
  rqStart: el => { S.draft.start = el.value; renderSheet(); }, rqEnd: el => { S.draft.end = el.value; renderSheet(); }, rqPlace: el => { S.draft.place = el.value; }, rqNote: el => { S.draft.note = el.value; },
  coNote: el => { S.draft.note = el.value; },
  pCode: el => { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if (v !== el.value) el.value = v; S.procheCode = v; },
  pName: el => { S.procheName = el.value; },
});
['rqTitle','rqPlace','rqNote','coNote','pCode','pName'].forEach(k => LIVE.add(k));
