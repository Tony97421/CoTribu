/* CoTribu — univers Planning : jour, semaine, mois, liste */

const catOf = e => CATS[e.cat] || CATS.autre;
function evTime(e){ return e.allDay || !e.start ? 'Toute la journée' : hm(e.start) + (e.end ? ' - ' + hm(e.end) : ''); }
function evCard(e, ds){
  const c = catOf(e);
  return `<button class="ev" style="--evc:${c.c};--evs:${c.soft}" data-act="editEvent" data-id="${e.id}" data-day="${ds}">
    <span class="bubble">${icon(c.icon,18)}</span>
    <span class="body"><span class="tm">${esc(evTime(e))}</span><span class="t">${esc(e.title)}</span>${e.place?`<span class="loc maplink" role="link" tabindex="0" data-act="maps" data-place="${esc(e.place)}" aria-label="Ouvrir ${esc(e.place)} dans Google Maps">${icon('map-pin',13)}${esc(e.place)}</span>`:''}</span>
    ${(e.members||[]).length ? avatars(e.members.filter(id=>S.members.has(id))) : ''}</button>`;
}
function dayDots(ds, max=3){
  return eventsOn(ds).slice(0,max).map(e => `<i style="background:${catOf(e).c}"></i>`).join('');
}

VIEWS.planning = () => {
  const s = S.sub.planning;
  S.planDay = S.planDay || localToday();
  let h = ptitle('Planning', 'Toute la semaine en un coup d’œil.', `<button class="fab" data-act="newEvent" aria-label="Ajouter un événement">${icon('plus',26)}</button>`);
  h += seg('psub', s, [['jour','Aujourd’hui'],['semaine','Semaine'],['mois','Mois'],['liste','Liste']], 'u-plan');
  if (s === 'jour') h += planDayView();
  else if (s === 'mois') h += planMonthView();
  else if (s === 'liste') h += planListView();
  else h += planWeekView();
  return h;
};

function dayNav(ds, act){
  return `<div class="dayhead"><button class="navb" data-act="${act}" data-v="-1" aria-label="Précédent">${icon('chevron-left',20)}</button><h2>${esc(cap(fmt(ds,{weekday:'long', day:'numeric', month:'long', year:'numeric'})))}</h2><button class="navb" data-act="${act}" data-v="1" aria-label="Suivant">${icon('chevron-right',20)}</button></div>`;
}
function planWeekView(){
  const today = localToday(), day = S.planDay, mon = mondayOf(day);
  let h = `<div class="wstrip u-plan">${[0,1,2,3,4,5,6].map(i => { const ds = addDays(mon,i);
    return `<button class="wday ${ds===today?'today':''}" data-act="pickDay" data-v="${ds}" aria-pressed="${ds===day}"><small>${esc(cap(fmt(ds,{weekday:'short'}).replace('.','')))}</small><b>${ymd(ds)[2]}</b><span class="dots">${dayDots(ds)}</span></button>`; }).join('')}</div>`;
  h += dayNav(day, 'shiftDay');
  const evs = eventsOn(day);
  h += evs.length ? `<div style="display:flex;flex-direction:column;gap:10px">${evs.map(e => evCard(e, day)).join('')}</div>` : `<div class="empty"><span class="muted">Rien de prévu ce jour-là.</span></div>`;
  h += `<div class="u-plan"><button class="addline" data-act="newEvent">${icon('plus',20)}Ajouter un événement</button></div>`;
  h += `<div class="u-lav"><button class="addline" data-act="newRequest">${icon('hand-heart',20)}Demander une garde à un proche</button></div>`;
  return h;
}
function planDayView(){
  const day = S.planDay;
  const evs = eventsOn(day);
  const allDay = evs.filter(e => e.allDay || !e.start);
  const timed = evs.filter(e => !(e.allDay || !e.start));
  let h = dayNav(day, 'shiftDay');
  if (allDay.length) h += `<div style="display:flex;flex-direction:column;gap:8px">${allDay.map(e => evCard(e, day)).join('')}</div>`;
  const first = Math.min(7, ...timed.map(e => +e.start.slice(0,2)));
  const last = Math.max(21, ...timed.map(e => +(e.end||e.start).slice(0,2)));
  h += `<div class="tl">`;
  for (let hr = first; hr <= last; hr++){
    const here = timed.filter(e => +e.start.slice(0,2) === hr);
    h += `<div class="tlh"><span class="h">${hr}h</span><div class="slot">${here.map(e => evCard(e, day)).join('')}</div></div>`;
  }
  h += `</div><div class="u-plan"><button class="addline" data-act="newEvent">${icon('plus',20)}Ajouter un événement</button></div>`;
  return h;
}
function planMonthView(){
  const today = localToday();
  const ym = S.planMonth || today.slice(0,7);
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`, start = mondayOf(first);
  const n = dim(y, m);
  const cells = Math.ceil((idx(first) - idx(start) + n) / 7) * 7;
  let h = `<div class="dayhead"><button class="navb" data-act="shiftMonth" data-v="-1" aria-label="Mois précédent">${icon('chevron-left',20)}</button><h2>${esc(cap(MON[m-1]))} ${y}</h2><button class="navb" data-act="shiftMonth" data-v="1" aria-label="Mois suivant">${icon('chevron-right',20)}</button></div>`;
  h += `<div class="card" style="padding:10px"><div class="mgrid">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>`<span class="dh">${d}</span>`).join('')}
    ${Array.from({length:cells}, (_,i) => { const ds = addDays(start,i); const out = ds.slice(0,7) !== ym;
      return `<button class="mcell ${out?'out':''} ${ds===today?'today':''}" data-act="pickDay" data-v="${ds}" aria-pressed="${ds===S.planDay}"><b>${ymd(ds)[2]}</b><span class="dots">${dayDots(ds,4)}</span></button>`; }).join('')}</div></div>`;
  h += `<div class="card"><div class="row"><h3 style="flex:1">${S.planDay===today?'Aujourd’hui':esc(cap(fmt(S.planDay,{weekday:'long',day:'numeric',month:'long'})))}</h3><button class="btn ghost sm" data-act="newEvent">${icon('plus',16)}Ajouter</button></div>
    ${eventsOn(S.planDay).map(e => evCard(e, S.planDay)).join('') || '<span class="muted small">Rien de prévu.</span>'}</div>`;
  h += `<div class="legend">${Object.values(CATS).map(c => `<span><i style="background:${c.c}"></i>${esc(c.label)}</span>`).join('')}</div>`;
  return h;
}
function upcoming(days=30, from=localToday()){
  const out = [];
  for (let i=0;i<days;i++){ const ds = addDays(from,i); const evs = eventsOn(ds); if (evs.length) out.push([ds, evs]); }
  return out;
}
function planListView(){
  const up = upcoming(45);
  if (!up.length) return `<div class="empty"><h3>Rien de prévu</h3><span class="muted">Ajoute les rendez-vous, activités et anniversaires : toute la famille les verra.</span></div>`;
  return up.map(([ds, evs]) => `<div class="upc"><span class="d">${esc(cap(fmt(ds,{weekday:'long',day:'numeric',month:'long'})))}</span><div style="display:flex;flex-direction:column;gap:8px">${evs.map(e => evCard(e, ds)).join('')}</div></div>`).join('');
}

/* ---------- feuille événement ---------- */
function draftEvent(e, day){
  if (e) return {...clone(e), members:[...(e.members||[])], _day: day || e.date};
  return {id:null, title:'', cat:'famille', date: day || S.planDay || localToday(), allDay:false, start:'09:00', end:'10:00', members:[], place:'', note:'', repeat:'none'};
}
SHEETS.event = () => {
  const d = S.draft, ms = sorted(S.members);
  const past = (d._day || d.date) <= localToday();
  return `<h2>${d.id ? 'Modifier l’événement' : 'Nouvel événement'}</h2>
    <label class="f" for="e-title">Titre<input type="text" id="e-title" data-ch="eTitle" value="${esc(d.title)}" placeholder="Ex. Judo, dentiste, anniversaire de Léa"></label>
    <div class="sect"><span class="eyebrow">Catégorie</span><div class="chips">${Object.entries(CATS).map(([k,c]) => `<button class="chip" data-act="eCat" data-v="${k}" aria-pressed="${d.cat===k}" style="${d.cat===k?`background:${c.c};border-color:${c.c};color:#2b2b2b`:''}">${icon(c.icon,16)}${esc(c.label)}</button>`).join('')}</div></div>
    <div class="frow"><label class="f" for="e-date">Date<input type="date" id="e-date" data-ch="eDate" value="${esc(d.date)}"></label>
      <label class="f" for="e-rep">Répéter<select id="e-rep" data-ch="eRep">${REPEATS.map(([v,l]) => `<option value="${v}" ${d.repeat===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
    <label class="toggle"><input type="checkbox" id="e-all" data-ch="eAll" ${d.allDay?'checked':''}>Toute la journée</label>
    <label class="toggle"><input type="checkbox" id="e-cd" data-ch="eCd" ${d.countdown?'checked':''}>Compte à rebours sur l’accueil</label>
    ${d.allDay ? '' : `<div class="frow"><label class="f" for="e-start">Début<input type="time" id="e-start" data-ch="eStart" value="${esc(d.start||'')}"></label><label class="f" for="e-end">Fin<input type="time" id="e-end" data-ch="eEnd" value="${esc(d.end||'')}"></label></div>`}
    <div class="sect"><span class="eyebrow">Qui est concerné</span><div class="chips u-plan">${ms.map(m => `<button class="chip" data-act="eMember" data-id="${m.id}" aria-pressed="${d.members.includes(m.id)}">${avatar(m.id)}${esc(m.name)}</button>`).join('')}</div></div>
    <label class="f" for="e-place">Lieu<input type="text" id="e-place" data-ch="ePlace" value="${esc(d.place||'')}" placeholder="Ex. Piscine Petit-Port, Nantes" list="known-places" autocomplete="off"></label>
    <datalist id="known-places">${knownPlaces().map(p => `<option value="${esc(p)}"></option>`).join('')}</datalist>
    <div class="maprow"><button class="btn soft sm" data-act="mapsDraft">${icon('map-pin',16)}Voir sur la carte</button><button class="btn soft sm" data-act="mapsDraft" data-dir="1">${icon('car',16)}Itinéraire</button></div>
    <label class="f" for="e-note">Note<textarea id="e-note" data-ch="eNote" placeholder="Ex. Prévoir les jeux et le goûter">${esc(d.note||'')}</textarea></label>
    <div class="actions"><button class="btn primary" data-act="saveEvent">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>
    ${d.id && past ? `<button class="btn soft u-mem" style="background:var(--mem-soft);color:var(--mem-text)" data-act="eventMemory">${icon('heart',18)}Ajouter des photos de ce moment</button>` : ''}
    ${d.id && d.repeat && d.repeat !== 'none' ? `<button class="btn soft" data-act="skipEvent">Pas cette fois (${esc(fmtShort(d._day))})</button>` : ''}
    ${d.id ? `<button class="btn danger ${S.armed==='event'?'armed':''}" data-act="delEvent">${S.armed==='event'?'Confirmer la suppression':(d.repeat&&d.repeat!=='none'?'Supprimer toute la série':'Supprimer')}</button>` : ''}`;
};

/* Google Maps : on ouvre l'appli Maps (ou le site) sur le lieu, sans clé ni abonnement */
function mapsUrl(place, dir){ const q = encodeURIComponent(place); return dir ? `https://www.google.com/maps/dir/?api=1&destination=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`; }
function openMaps(place, dir){ place = String(place||'').trim(); if (!place) { toast('Indique d’abord le lieu.'); return; } window.open(mapsUrl(place, dir), '_blank', 'noopener'); }
// lien Maps sur un lieu (sauf « À la maison »)
const placeLink = p => /^(à|a) la maison$/i.test(String(p).trim()) ? esc(p) : `<span class="maplink" role="link" tabindex="0" data-act="maps" data-place="${esc(p)}">${esc(p)}</span>`;
function knownPlaces(){ // les lieux déjà utilisés, les plus récents d'abord
  const seen = new Map();
  for (const e of [...S.events.values(), ...S.requests.values()]) { const p = (e.place||'').trim(); if (p && p !== 'À la maison') { const k = norm(p), d = e.date || ''; if (!seen.has(k) || seen.get(k).d < d) seen.set(k, {p, d}); } }
  return [...seen.values()].sort((a,b) => b.d.localeCompare(a.d)).slice(0, 30).map(x => x.p);
}
Object.assign(H, {
  maps: el => openMaps(el.dataset.place, el.dataset.dir),
  mapsDraft: el => { const i = document.getElementById('e-place') || document.getElementById('rq-place'); openMaps(i ? i.value : (S.draft && S.draft.place), el.dataset.dir); },
  psub: el => { S.sub.planning = el.dataset.v; if (el.dataset.v === 'jour') S.planDay = localToday(); render(); },
  pickDay: el => { S.planDay = el.dataset.v; if (S.sub.planning === 'mois') S.planMonth = el.dataset.v.slice(0,7); render(); },
  shiftDay: el => { S.planDay = addDays(S.planDay, +el.dataset.v); render(); },
  shiftMonth: el => { const [y,m] = (S.planMonth || localToday().slice(0,7)).split('-').map(Number); const d = new Date(Date.UTC(y, m-1 + (+el.dataset.v), 1)); S.planMonth = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`; S.planDay = S.planMonth + '-01'; render(); },
  newEvent: () => { S.draft = draftEvent(null, S.tab === 'planning' ? S.planDay : localToday()); openSheet('event'); },
  editEvent: el => { const e = S.events.get(el.dataset.id); if (!e) return; S.draft = draftEvent(e, el.dataset.day); openSheet('event'); },
  eCat: el => { S.draft.cat = el.dataset.v; renderSheet(); },
  eMember: el => { const d = S.draft, id = el.dataset.id; d.members = d.members.includes(id) ? d.members.filter(x=>x!==id) : [...d.members, id]; renderSheet(); },
  saveEvent: () => {
    const d = S.draft; const title = (d.title||'').trim();
    if (!title) { toast('Donne un titre à l’événement.'); return; }
    if (!d.date) { toast('Choisis une date.'); return; }
    if (!d.allDay && d.start && d.end && d.end < d.start) { toast('La fin est avant le début.'); return; }
    const e = {id: d.id || uid('e'), title, cat:d.cat, date:d.date, allDay:!!d.allDay, start: d.allDay ? '' : (d.start||''), end: d.allDay ? '' : (d.end||''),
      members:d.members, place:(d.place||'').trim(), note:(d.note||'').trim(), repeat:d.repeat||'none', skip:d.skip||[], countdown:!!d.countdown, by:S.me||null};
    put('events', e); if (!d.id) { if (typeof thinkCredit === 'function') thinkCredit('events'); } S.planDay = d.date; closeSheet(); render(); toast(d.id ? 'Événement modifié' : 'Événement ajouté');
  },
  skipEvent: () => { const e = clone(S.events.get(S.draft.id)); e.skip = [...(e.skip||[]), S.draft._day]; put('events', e); closeSheet(); render(); toast('Retiré pour ce jour-là'); },
  delEvent: () => { if (S.armed !== 'event') { S.armed = 'event'; renderSheet(); return; } del('events', S.draft.id); closeSheet(); render(); toast('Événement supprimé'); },
  eventMemory: () => { const d = S.draft; S.draft = draftMemory(null, {title:d.title, date:d._day||d.date, members:d.members, eventId:d.id}); S.sheet = 'memory'; renderSheet(); },
});
Object.assign(CH, {
  eTitle: el => { S.draft.title = el.value; },
  eDate: el => { S.draft.date = el.value; },
  eRep: el => { S.draft.repeat = el.value; },
  eAll: el => { S.draft.allDay = el.checked; renderSheet(); },
  eCd: el => { S.draft.countdown = el.checked; },
  eStart: el => { S.draft.start = el.value; if (S.draft.end && S.draft.end < el.value) { const [h,m] = el.value.split(':').map(Number); S.draft.end = pad(Math.min(23,h+1))+':'+pad(m); renderSheet(); } },
  eEnd: el => { S.draft.end = el.value; },
  ePlace: el => { S.draft.place = el.value; },
  eNote: el => { S.draft.note = el.value; },
});
['eTitle','ePlace','eNote'].forEach(k => LIVE.add(k));
