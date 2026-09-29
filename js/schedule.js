/* CoTribu — emploi du temps de chaque personne (travail, école, activités), rangé sur sa fiche membre.
   m.schedule = [{id, kind, label, days:[0..6 (0 = dimanche)], start:'09:00', end:'18:00', weeks:'all'|'A'|'B', abAnchor:'lundi d'une semaine A', cantine}] */

const SKINDS = {
  travail:  {icon: 'briefcase',       label: 'Travail'},
  ecole:    {icon: 'backpack',        label: 'École'},
  activite: {icon: 'volleyball',      label: 'Activité'},
  autre:    {icon: 'clock',           label: 'Autre'},
};
const DAY1 = ['D','L','M','M','J','V','S'];
const DAY3 = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

function slotWeekOk(s, ds){
  if (!s.weeks || s.weeks === 'all' || !s.abAnchor) return true;
  const even = mod(Math.round((idx(mondayOf(ds)) - idx(s.abAnchor)) / 7), 2) === 0;
  return s.weeks === 'A' ? even : !even;
}
function slotsOn(memberId, ds){
  const m = S.members.get(memberId); if (!m || !Array.isArray(m.schedule)) return [];
  const d = dow(ds);
  return m.schedule.filter(s => (s.days||[]).includes(d) && slotWeekOk(s, ds))
    .map(s => s.times && s.times[d] ? {...s, start: s.times[d].start || s.start, end: s.times[d].end || s.end} : s) // horaires propres à ce jour
    .sort((a,b) => (a.start||'').localeCompare(b.start||''));
}
// créneaux qui chevauchent [start, end[ ce jour-là (journée entière si pas d'heures)
function busyBetween(memberId, ds, start, end){
  return slotsOn(memberId, ds).filter(s => !start ? true : end && end > start ? (s.start < end && s.end > start) : (s.start <= start && s.end > start));
}
const slotName = s => s.label || (SKINDS[s.kind] || SKINDS.autre).label;
const hShort = t => { if (!t) return ''; const [h, m] = t.split(':'); return `${+h}h${m === '00' ? '' : m}`; };
const slotHours = s => `${hShort(s.start)}–${hShort(s.end)}`;
function slotDaysLabel(s){
  const d = WEEK_ORDER.filter(x => (s.days||[]).includes(x));
  const txt = d.join() === '1,2,3,4,5' ? 'Lun → Ven' : d.join() === '1,2,3,4,5,6,0' ? 'Tous les jours' : d.map(x => DAY3[x]).join(', ');
  const per = s.perDay && s.times ? ' · ' + d.map(x => `${DAY3[x]} ${slotHours({start: (s.times[x]||s).start, end: (s.times[x]||s).end})}`).join(', ') : '';
  return (s.perDay ? '' : txt) + per.replace(/^ · /, '') + (s.weeks === 'A' || s.weeks === 'B' ? ' · une semaine sur deux' : '');
}

/* ---------- affichage dans le planning ---------- */
function busyStrip(ds){
  const rows = sorted(S.members).map(m => ({m, sl: slotsOn(m.id, ds)})).filter(x => x.sl.length);
  if (!rows.length) return '';
  return `<div class="busy"><span class="eyebrow">Emplois du temps</span>${rows.map(({m, sl}) => `<div class="busyrow">${avatar(m.id)}<span class="chips">${sl.map(s => `<span class="bchip">${icon((SKINDS[s.kind]||SKINDS.autre).icon, 13)}${esc(slotName(s))} ${esc(slotHours(s))}${s.kind === 'ecole' && s.cantine ? ' · cantine' : ''}</span>`).join('')}</span></div>`).join('')}</div>`;
}
// « Qui est dispo ? » pour un créneau donné
function availLine(ds, start, end, opts={}){
  if (!ds) return '';
  const ms = sorted(S.members).filter(m => !opts.adults || !m.kid); if (ms.length < 2 && !ms.some(m => (m.schedule||[]).length)) return '';
  if (!ms.some(m => (m.schedule||[]).length)) return `<span class="muted small">Astuce : ajoute l’emploi du temps de chacun (touche son rond en haut) pour voir ici qui est disponible.</span>`;
  const busy = [], free = [];
  for (const m of ms) { const b = busyBetween(m.id, ds, start, end)[0]; if (b) busy.push({m, b}); else free.push(m); }
  return `<div class="avail">${free.length ? `<span class="small"><b>Disponibles :</b> ${free.map(m => esc(m.name)).join(', ')}</span>` : `<span class="small"><b>Personne n’est libre</b> à ce moment-là.</span>`}
    ${busy.length ? `<span class="small muted">Occupés : ${busy.map(({m, b}) => `${esc(m.name)} (${esc(slotName(b))} jusqu’à ${esc(hShort(b.end))})`).join(', ')}</span>` : ''}</div>`;
}

/* ---------- sur la fiche membre ---------- */
function scheduleSection(d){
  const list = Array.isArray(d.schedule) ? d.schedule : [];
  return `<div class="sect"><span class="eyebrow">Emploi du temps</span>
    ${list.length ? `<div class="menu">${list.map(s => `<button class="lrow" data-act="slotEdit" data-id="${s.id}"><span class="bubble sm">${icon((SKINDS[s.kind]||SKINDS.autre).icon,16)}</span><span class="body"><span class="t">${esc(slotName(s))} · ${s.perDay ? 'horaires selon le jour' : esc(slotHours(s))}</span><span class="s">${esc(slotDaysLabel(s))}${s.kind === 'ecole' && s.cantine ? ' · cantine' : ''}</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>` : `<span class="muted small">Travail, école, activités : CoTribu saura qui est disponible, et évitera de déranger pendant ces moments.</span>`}
    <button class="btn soft sm" data-act="slotNew">${icon('plus',16)}Ajouter un créneau</button></div>`;
}
SHEETS.slot = () => {
  const s = S.slotDraft, who = S.draft && S.draft.name ? S.draft.name : '';
  return `<h2>${s.id ? 'Modifier le créneau' : 'Nouveau créneau'}${who ? ` · ${esc(who)}` : ''}</h2>
    <div class="chips">${Object.entries(SKINDS).map(([k, v]) => `<button class="chip" data-act="slKind" data-v="${k}" aria-pressed="${s.kind===k}">${icon(v.icon,16)}${v.label}</button>`).join('')}</div>
    <label class="f" for="sl-label">Nom<input type="text" id="sl-label" data-ch="slLabel" value="${esc(s.label)}" placeholder="${esc((SKINDS[s.kind]||SKINDS.autre).label)}"></label>
    <div class="sect"><span class="eyebrow">Jours</span><div class="daypick">${WEEK_ORDER.map(x => `<button class="daychip" data-act="slDay" data-v="${x}" aria-pressed="${s.days.includes(x)}"><b>${DAY1[x]}</b></button>`).join('')}</div></div>
    ${s.days.length > 1 ? `<label class="toggle"><input type="checkbox" id="sl-perday" data-ch="slPerDay" ${s.perDay?'checked':''}>Des horaires différents selon le jour</label>` : ''}
    ${s.perDay && s.days.length > 1
      ? `<div class="perday">${WEEK_ORDER.filter(x => s.days.includes(x)).map(x => { const t = s.times[x] || {start: s.start, end: s.end}; return `<div class="pdrow"><b>${DAY3[x]}</b><input type="time" aria-label="${DAY3[x]} début" data-ch="slDayStart" data-v="${x}" value="${esc(t.start)}"><span class="muted">à</span><input type="time" aria-label="${DAY3[x]} fin" data-ch="slDayEnd" data-v="${x}" value="${esc(t.end)}"></div>`; }).join('')}</div>`
      : `<div class="frow"><label class="f" for="sl-start">De<input type="time" id="sl-start" data-ch="slStart" value="${esc(s.start)}"></label><label class="f" for="sl-end">À<input type="time" id="sl-end" data-ch="slEnd" value="${esc(s.end)}"></label></div>`}
    <div class="sect"><span class="eyebrow">Semaines</span><div class="chips">
      <button class="chip" data-act="slWeeks" data-v="all" aria-pressed="${s.weeks==='all'}">Toutes</button>
      <button class="chip" data-act="slWeeks" data-v="A" aria-pressed="${s.weeks==='A'}">Une sur deux, dont cette semaine</button>
      <button class="chip" data-act="slWeeks" data-v="B" aria-pressed="${s.weeks==='B'}">Une sur deux, pas cette semaine</button></div></div>
    ${s.kind === 'ecole' ? `<label class="toggle"><input type="checkbox" id="sl-cantine" data-ch="slCantine" ${s.cantine?'checked':''}>Mange à la cantine</label>` : ''}
    <div class="actions"><button class="btn primary" data-act="slSave">Enregistrer</button><button class="btn soft" data-act="slBack">Retour</button></div>
    ${s.id ? `<button class="btn danger ${S.armed==='slot'?'armed':''}" data-act="slDel">${S.armed==='slot'?'Confirmer la suppression':'Supprimer ce créneau'}</button>` : ''}`;
};
function slotDefaults(kind){
  return {travail: {days:[1,2,3,4,5], start:'09:00', end:'18:00'}, ecole: {days:[1,2,4,5], start:'08:30', end:'16:30'},
    activite: {days:[3], start:'14:00', end:'16:00'}, autre: {days:[], start:'09:00', end:'12:00'}}[kind] || {};
}
function saveSchedule(){ // enregistre tout de suite l'emploi du temps sur la fiche du membre
  const d = S.draft, m0 = S.members.get(d.id); if (!m0) return;
  put('members', {...clone(m0), schedule: d.schedule});
}
function backToMember(){ S.slotDraft = null; S.sheet = 'memberEdit'; S.armed = null; renderSheet(); }
Object.assign(H, {
  slotNew: () => { const kid = S.draft && S.draft.kid; const k = kid ? 'ecole' : 'travail'; S.slotDraft = {id:null, kind:k, label:'', weeks:'all', cantine:false, perDay:false, times:{}, ...slotDefaults(k)}; S.sheet = 'slot'; S.armed = null; renderSheet(); },
  slotEdit: el => {
    const s = (S.draft.schedule||[]).find(x => x.id === el.dataset.id); if (!s) return;
    const shown = !s.weeks || s.weeks === 'all' ? 'all' : (slotWeekOk(s, localToday()) ? 'A' : 'B');
    S.slotDraft = {...clone(s), days:[...(s.days||[])], times: clone(s.times || {}), perDay: !!s.perDay, weeks: shown, _weeksAtOpen: shown, _orig: {weeks: s.weeks, abAnchor: s.abAnchor}, _touched: true};
    S.sheet = 'slot'; S.armed = null; renderSheet();
  },
  slKind: el => { const s = S.slotDraft, k = el.dataset.v; const fresh = !s.id && !s._touched; s.kind = k; if (fresh) Object.assign(s, slotDefaults(k)); renderSheet(); },
  slDay: el => { const s = S.slotDraft, v = +el.dataset.v; s._touched = true; s.days = s.days.includes(v) ? s.days.filter(x => x !== v) : [...s.days, v]; renderSheet(); },
  slWeeks: el => { S.slotDraft.weeks = el.dataset.v; renderSheet(); },
  slBack: () => backToMember(),
  slSave: () => {
    const s = S.slotDraft, d = S.draft;
    if (!s.days.length) { toast('Choisis au moins un jour.'); return; }
    const perDay = !!(s.perDay && s.days.length > 1);
    if (perDay) {
      for (const x of s.days) { const t = s.times[x] || {start: s.start, end: s.end}; if (!t.start || !t.end || t.end <= t.start) { toast(`Vérifie les heures du ${DAYN[x]} : la fin doit être après le début.`); return; } }
    } else if (!s.start || !s.end || s.end <= s.start) { toast('Vérifie les heures : la fin doit être après le début.'); return; }
    let weeks = 'all', abAnchor = null;
    if (s.weeks !== 'all') {
      if (s._orig && s.weeks === s._weeksAtOpen && s._orig.abAnchor) { weeks = s._orig.weeks; abAnchor = s._orig.abAnchor; }
      else { weeks = 'A'; abAnchor = s.weeks === 'A' ? mondayOf(localToday()) : addDays(mondayOf(localToday()), 7); } // « pas cette semaine » : la semaine A commence la semaine prochaine
    }
    let times = null, start = s.start, end = s.end;
    if (perDay) { times = {}; s.days.forEach(x => { times[x] = {...(s.times[x] || {start: s.start, end: s.end})}; }); const all = Object.values(times); start = all.map(t => t.start).sort()[0]; end = all.map(t => t.end).sort().at(-1); }
    const slot = {id: s.id || uid('sl'), kind: s.kind, label: (s.label||'').trim(), days: s.days.slice().sort(), start, end, perDay, times, weeks, abAnchor, cantine: s.kind === 'ecole' ? !!s.cantine : false};
    d.schedule = [...(d.schedule||[]).filter(x => x.id !== slot.id), slot];
    saveSchedule(); backToMember(); render(); toast('Emploi du temps enregistré');
  },
  slDel: () => {
    if (S.armed !== 'slot') { S.armed = 'slot'; renderSheet(); return; }
    const d = S.draft; d.schedule = (d.schedule||[]).filter(x => x.id !== S.slotDraft.id);
    saveSchedule(); backToMember(); render(); toast('Créneau supprimé');
  },
});
Object.assign(CH, {
  slLabel: el => { S.slotDraft.label = el.value; },
  slStart: el => { S.slotDraft.start = el.value; },
  slEnd: el => { S.slotDraft.end = el.value; },
  slCantine: el => { S.slotDraft.cantine = el.checked; },
  slPerDay: el => { const s = S.slotDraft; s.perDay = el.checked; if (s.perDay) s.days.forEach(x => { if (!s.times[x]) s.times[x] = {start: s.start, end: s.end}; }); renderSheet(); },
  slDayStart: el => { const s = S.slotDraft, x = +el.dataset.v; s.times[x] = {...(s.times[x] || {start: s.start, end: s.end}), start: el.value}; },
  slDayEnd: el => { const s = S.slotDraft, x = +el.dataset.v; s.times[x] = {...(s.times[x] || {start: s.start, end: s.end}), end: el.value}; },
});
LIVE.add('slLabel');
