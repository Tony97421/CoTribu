/* CoTribu — charge mentale visible, entretien des équipements, météo de la famille */

/* =================== 1. Charge mentale : qui y pense, qui le fait =================== */
const monthKey = (d = localToday()) => d.slice(0,7);
const THINK_KINDS = {
  tasks:   ['circle-check', 'tâches créées'],
  events:  ['calendar', 'rendez-vous notés'],
  items:   ['shopping-cart', 'articles ajoutés'],
  meals:   ['utensils', 'repas prévus'],
  requests:['hand-heart', 'demandes aux proches'],
  memories:['heart', 'souvenirs gardés'],
};
function bumpMental(memberId, fn){
  const m0 = S.members.get(memberId); if (!m0) return;
  const m = clone(m0);
  m.mental = m.mental || {};
  const k = monthKey();
  m.mental[k] = m.mental[k] || {a:{}, f:0};
  fn(m.mental[k]);
  const keys = Object.keys(m.mental).sort(); while (keys.length > 12) delete m.mental[keys.shift()];
  put('members', m);
}
function thinkCredit(kind){ if (S.me && S.members.has(S.me)) bumpMental(S.me, x => { x.a[kind] = (x.a[kind]||0) + 1; }); }
function doneCredit(who, delta){ if (who && S.members.has(who)) bumpMental(who, x => { x.f = Math.max(0, (x.f||0) + delta); }); }
const thinkTotal = (m, k) => Object.values(((m.mental||{})[k]||{}).a || {}).reduce((a,b)=>a+b,0);
const doneTotal = (m, k) => ((m.mental||{})[k]||{}).f || 0;
function prevMonthKey(){ const [y,mo] = monthKey().split('-').map(Number); const d = new Date(Date.UTC(y, mo-2, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`; }
const monthName = k => MON[+k.slice(5)-1] + ' ' + k.slice(0,4);

function chargeInsight(k){
  const ms = sorted(S.members).filter(m => !m.kid);
  const rows = ms.map(m => ({m, t: thinkTotal(m,k), f: doneTotal(m,k)}));
  const T = rows.reduce((a,r)=>a+r.t,0);
  if (T < 5 || rows.length < 2) return 'Le bilan se construit au fil des jours : chaque tâche, rendez-vous ou article ajouté depuis un téléphone compte.';
  rows.sort((a,b) => b.t - a.t);
  const top = rows[0], pct = Math.round(top.t / T * 100);
  if (pct < 60) return `Belle répartition : l’organisation est bien partagée entre ${rows.map(r=>r.m.name).join(' et ')}. Bravo la tribu !`;
  const kinds = (top.m.mental[k]||{}).a || {};
  const [bestKind] = Object.entries(kinds).sort((a,b)=>b[1]-a[1])[0] || [];
  const other = rows[rows.length-1].m.name;
  const idea = {items:'penser aux courses', events:'noter les rendez-vous', tasks:'organiser le ménage', meals:'prévoir les repas', requests:'organiser les gardes', memories:'garder les souvenirs'}[bestKind] || 'une partie de l’organisation';
  return `${top.m.name} a porté ${pct} % de l’anticipation ce mois-ci. Et si ${other} prenait en charge « ${idea} » le mois prochain ?`;
}
function viewCharge(){
  const k = S.chargeMonth || monthKey();
  let h = backBtn('Plus') + ptitle('Charge mentale', 'Qui pense à quoi, et qui le fait. Le travail invisible, enfin visible.');
  h += seg('chargeMonth', k, [[monthKey(), 'Ce mois-ci'], [prevMonthKey(), cap(MON[+prevMonthKey().slice(5)-1])]], 'u-lav');
  const ms = sorted(S.members).filter(m => !m.kid); // la charge mentale, c'est une affaire d'adultes
  const T = ms.reduce((a,m)=>a+thinkTotal(m,k),0), F = ms.reduce((a,m)=>a+doneTotal(m,k),0);
  const bars = (val, tot) => ms.map(m => { const v = val(m); const p = tot ? Math.round(v/tot*100) : 0;
    return `<div class="barrow"><span class="n">${esc(m.name)}</span><span class="track"><b style="width:${p}%;background:${memberColor(m)}"></b></span><span class="v">${p}%</span></div>`; }).join('');
  h += `<div class="prem" style="background:linear-gradient(135deg,var(--lav-soft),var(--home-soft))"><span class="badge">${esc(cap(monthName(k)))}</span><p style="margin:0;font-size:17px">${esc(chargeInsight(k))}</p></div>`;
  h += `<div class="card u-lav"><div class="row"><span class="bubble">${icon('brain',18)}</span><div style="flex:1"><h3>Qui y pense</h3><span class="muted small">Tâches créées, rendez-vous notés, courses ajoutées, repas prévus…</span></div><span class="pill num">${T}</span></div><div class="bars">${bars(m => thinkTotal(m,k), T)}</div></div>`;
  h += `<div class="card u-home"><div class="row"><span class="bubble">${icon('circle-check',18)}</span><div style="flex:1"><h3>Qui le fait</h3><span class="muted small">Tâches cochées et articles achetés</span></div><span class="pill num">${F}</span></div><div class="bars">${bars(m => doneTotal(m,k), F)}</div></div>`;
  h += `<h2>Le détail</h2>` + ms.map(m => { const a = ((m.mental||{})[k]||{}).a || {};
    const parts = Object.entries(THINK_KINDS).filter(([kk]) => a[kk]).map(([kk,[ic,l]]) => `<span class="chip" style="cursor:default">${icon(ic,14)}<b class="num">${a[kk]}</b> ${l}</span>`);
    return `<div class="card" style="gap:8px"><div class="row">${avatar(m.id)}<strong style="flex:1">${esc(m.name)}</strong><span class="muted small num">${thinkTotal(m,k)} anticipations · ${doneTotal(m,k)} faites</span></div>${parts.length ? `<div class="chips">${parts.join('')}</div>` : '<span class="muted small">Rien ce mois-ci.</span>'}</div>`; }).join('');
  h += `<span class="info">Compté depuis chaque téléphone selon « Sur ce téléphone, je suis… ». Les enfants ne sont pas comptés : pour eux, il y a les points et récompenses.</span>`;
  return h;
}

/* =================== 2. Entretien des équipements =================== */
const EQUIP = [
  {k:'chaudiere', name:'Chaudière gaz ou fioul', icon:'flame', tasks:[['Entretien annuel de la chaudière', 365, 'Obligatoire chaque année par un professionnel. Gardez l’attestation.']]},
  {k:'pac', name:'Pompe à chaleur / clim', icon:'fan', tasks:[['Nettoyer les filtres de la clim / PAC', 90, ''], ['Entretien de la pompe à chaleur', 730, 'Obligatoire tous les 2 ans pour les pompes à chaleur de 4 à 70 kW.']]},
  {k:'cheminee', name:'Cheminée / poêle à bois', icon:'flame', tasks:[['Ramonage', 365, 'Obligatoire, 1 à 2 fois par an selon votre département. Certificat à garder pour l’assurance.']]},
  {k:'detecteur', name:'Détecteur de fumée', icon:'siren', tasks:[['Tester le détecteur de fumée', 30, 'Appuyer sur le bouton test.'], ['Changer la pile du détecteur', 365, '']]},
  {k:'hotte', name:'Hotte de cuisine', icon:'wind', tasks:[['Nettoyer le filtre de la hotte', 60, '']]},
  {k:'lv', name:'Lave-vaisselle', icon:'droplets', tasks:[['Nettoyer le filtre du lave-vaisselle', 30, ''], ['Ajouter du sel régénérant', 45, '']]},
  {k:'ll', name:'Lave-linge', icon:'washing-machine', tasks:[['Nettoyer le filtre et le joint du lave-linge', 60, ''], ['Lavage à vide d’entretien', 90, 'Un cycle chaud à vide avec du vinaigre blanc ou un produit dédié.']]},
  {k:'seche', name:'Sèche-linge', icon:'wind', tasks:[['Nettoyer le condenseur du sèche-linge', 30, '']]},
  {k:'frigo', name:'Réfrigérateur / congélateur', icon:'refrigerator', tasks:[['Dégivrer le congélateur', 180, ''], ['Dépoussiérer la grille arrière du frigo', 180, '']]},
  {k:'vmc', name:'VMC', icon:'fan', tasks:[['Nettoyer les bouches de VMC', 180, '']]},
  {k:'cumulus', name:'Chauffe-eau / cumulus', icon:'thermometer', tasks:[['Actionner le groupe de sécurité du chauffe-eau', 30, 'Recommandé chaque mois pour limiter le calcaire.']]},
  {k:'adoucisseur', name:'Adoucisseur d’eau', icon:'droplet', tasks:[['Ajouter du sel dans l’adoucisseur', 30, '']]},
  {k:'robot', name:'Aspirateur robot', icon:'bot', tasks:[['Vider et nettoyer l’aspirateur robot', 7, ''], ['Changer le filtre de l’aspirateur robot', 90, '']]},
  {k:'voiture', name:'Voiture', icon:'car-front', tasks:[['Vérifier la pression des pneus', 30, ''], ['Révision / vidange', 365, ''], ['Contrôle technique', 730, 'Tous les 2 ans à partir des 4 ans du véhicule.']]},
  {k:'piscine', name:'Piscine', icon:'waves', tasks:[['Analyser et traiter l’eau de la piscine', 7, '']]},
  {k:'gouttieres', name:'Toiture / gouttières', icon:'house', tasks:[['Nettoyer les gouttières', 365, '']]},
];
const equipDone = k => [...S.tasks.values()].some(t => t.equip === k);
function equipCard(){
  const n = new Set([...S.tasks.values()].map(t => t.equip).filter(Boolean)).size;
  return `<div class="card u-warm"><div class="row"><span class="bubble">${icon('wrench',18)}</span><div style="flex:1"><h3>Entretien des équipements</h3>
    <span class="muted small">${n ? `${n} équipement${n>1?'s':''} suivi${n>1?'s':''}` : 'Chaudière, ramonage, détecteur de fumée, hotte, voiture…'}</span></div></div>
    <span class="small">Coche ce que tu as à la maison : CoTribu crée les rappels, y compris les entretiens obligatoires.</span>
    <button class="btn upri" data-act="equipOpen">${icon('plus',18)}${n ? 'Ajouter un équipement' : 'Choisir mes équipements'}</button></div>`;
}
SHEETS.equip = () => {
  const d = S.draft;
  return `<h2>Mes équipements</h2><span class="muted small">Indique la dernière fois si tu la connais : le prochain rappel sera calculé à partir de cette date.</span>
    <div class="chips u-warm">${EQUIP.map(e => `<button class="chip" data-act="equipPick" data-v="${e.k}" aria-pressed="${d.picked.includes(e.k)}" ${equipDone(e.k)?'disabled style="opacity:.5"':''}>${icon(e.icon,16)}${esc(e.name)}${equipDone(e.k)?' · suivi':''}</button>`).join('')}</div>
    ${d.picked.map(k => { const e = EQUIP.find(x => x.k === k); return `<div class="card" style="gap:8px"><div class="row"><span class="bubble sm u-warm">${icon(e.icon,16)}</span><strong>${esc(e.name)}</strong></div>
      ${e.tasks.map(([name, days, note], i) => `<div style="display:flex;flex-direction:column;gap:4px"><span style="font-weight:600">${esc(name)}</span><span class="muted small">${esc(recLabel({type:'interval', days}))}${note ? ' · ' + esc(note) : ''}</span>
        <label class="f" for="eq-${k}-${i}" style="font-weight:500">Dernière fois (facultatif)<input type="date" id="eq-${k}-${i}" data-ch="equipDate" data-k="${k}-${i}" value="${esc(d.dates[k+'-'+i]||'')}" max="${localToday()}"></label></div>`).join('')}</div>`; }).join('')}
    <div class="actions"><button class="btn upri u-warm" data-act="equipSave" ${d.picked.length?'':'disabled'}>Créer les rappels</button><button class="btn soft" data-act="close">Annuler</button></div>`;
};
function equipSave(){
  const d = S.draft, today = localToday();
  let room = S.rooms.get('r-entretien');
  if (!room) { room = {id:'r-entretien', name:'Entretien', icon:'wrench', order: Math.max(0, ...[...S.rooms.values()].map(r => r.order||0)) + 1}; put('rooms', room); }
  let n = 0, order = [...S.tasks.values()].filter(t => t.roomId === room.id).length;
  const list = [];
  d.picked.forEach(k => { const e = EQUIP.find(x => x.k === k); e.tasks.forEach(([name, days, note], i) => {
    const last = d.dates[k+'-'+i] || null;
    list.push({id:uid('t'), roomId:room.id, name, note, equip:k, rec:{type:'interval', days, anchor: last ? addDays(last, days) : addDays(today, days >= 90 ? 14 : 0)},
      carry:true, time:null, points:2, assign:{mode:'anyone', members:[], anchor:mondayOf(today)}, order: ++order, createdAt:today, lastDone:last, lastBy:null, done:{}, by:S.me||null});
    n++; }); });
  putMany('tasks', list);
  closeSheet(); render(); toast(`${n} rappel${n>1?'s':''} d’entretien créé${n>1?'s':''} dans « Entretien »`);
}

/* =================== 3. Météo de la famille =================== */
const MOODS = [
  ['top', 'En forme', 'sun', '#E5C77A'],
  ['ok', 'Ça va', 'cloud-sun', '#9DB9C8'],
  ['fatigue', 'Fatigué', 'cloud', '#9AA7B0'],
  ['deborde', 'Débordé', 'cloud-lightning', '#E07A5F'],
];
const moodOf = m => m && m.mood && m.mood.d === localToday() ? MOODS.find(x => x[0] === m.mood.v) : null;
function meteoCard(){
  const ms = sorted(S.members), today = localToday();
  const cells = ms.map(m => { const md = moodOf(m);
    return `<button class="meteo" data-act="moodOpen" data-id="${m.id}" aria-label="Météo de ${esc(m.name)}">${avatar(m.id)}<span class="mdot" style="background:${md ? md[3] : 'var(--surface2)'};color:${md ? '#343532' : 'var(--muted)'}">${icon(md ? md[2] : 'plus', 13)}</span><span class="small">${esc(m.name)}</span></button>`; }).join('');
  const help = ms.filter(m => m.id !== S.me && moodOf(m) && moodOf(m)[0] === 'deborde').map(m => {
    const mine = todayItems(today).filter(x => !x.st.done && assigneesOn(x.t, today).includes(m.id));
    return mine.length ? `<div class="row" style="background:var(--late-soft);border-radius:14px;padding:10px 12px"><span style="flex:1" class="small"><b>${esc(m.name)}</b> est débordé${m.kid?'':'(e)'} aujourd’hui et a ${mine.length} tâche${mine.length>1?'s':''} à faire.</span><button class="btn deep sm" data-act="helpOpen" data-id="${m.id}">Aider</button></div>` : '';
  }).join('');
  const my = S.me ? moodOf(S.members.get(S.me)) : null;
  return `<div class="ucard u-plan"><div class="row" style="flex-wrap:wrap"><span class="bubble sm">${icon('cloud-sun',16)}</span><h3 style="flex:1;min-width:0">Météo de la tribu</h3>${!my && S.me ? '<span class="muted small">Et toi, ça va ?</span>' : ''}</div>
    <div class="meteos">${cells}</div>${help}</div>`;
}
SHEETS.mood = () => { const m = S.members.get(S.draft.mid); if (!m) return ''; const cur = moodOf(m);
  return `<h2>${m.id === S.me ? 'Comment tu te sens aujourd’hui ?' : `Et ${esc(m.name)} aujourd’hui ?`}</h2>
    <div class="moods">${MOODS.map(([v,l,ic,c]) => `<button class="moodbtn" data-act="moodSet" data-v="${v}" aria-pressed="${cur && cur[0]===v}" style="--mc:${c}"><span>${icon(ic,30)}</span>${l}</button>`).join('')}</div>
    <label class="f" for="mood-note">Un petit mot (facultatif)<input type="text" id="mood-note" data-ch="moodNote" value="${esc(S.draft.note||'')}" placeholder="Ex. grosse journée au travail"></label>
    <span class="info">La météo s’efface chaque soir à minuit.</span>
    ${cur ? `<button class="btn ghost" data-act="moodClear">Effacer</button>` : ''}`; };
SHEETS.help = () => { const m = S.members.get(S.draft.mid), today = localToday(); if (!m) return '';
  const list = todayItems(today).filter(x => !x.st.done && assigneesOn(x.t, today).includes(m.id));
  return `<h2>Aider ${esc(m.name)}</h2><span class="muted small">Prends une ou plusieurs de ses tâches du jour : elles passent à ton nom pour aujourd’hui seulement.</span>
    <div class="card" style="padding:4px 16px">${list.map(x => `<div class="lrow" style="padding-left:0;padding-right:0"><span class="body"><span class="t">${esc(x.t.name)}</span><span class="s">${esc(x.r.name)}${x.t.time && x.t.time.at ? ' · ' + esc(timeLabel(x.t.time)) : ''}</span></span><button class="btn deep sm" data-act="takeTask" data-id="${x.t.id}">Je m’en occupe</button></div>`).join('') || '<span class="muted">Plus rien à prendre, merci !</span>'}</div>
    <button class="btn soft" data-act="close">Fermer</button>`; };

/* =================== actions =================== */
Object.assign(H, {
  chargeMonth: el => { S.chargeMonth = el.dataset.v; render(); },
  equipOpen: () => { S.draft = {picked:[], dates:{}}; openSheet('equip'); },
  equipPick: el => { const d = S.draft, k = el.dataset.v; d.picked = d.picked.includes(k) ? d.picked.filter(x => x !== k) : [...d.picked, k]; renderSheet(); },
  equipSave: () => equipSave(),
  moodOpen: el => { const m = S.members.get(el.dataset.id); S.draft = {mid: el.dataset.id, note: (moodOf(m) && m.mood.note) || ''}; openSheet('mood'); },
  moodSet: el => { const d = S.draft, m = clone(S.members.get(d.mid)); m.mood = {d: localToday(), v: el.dataset.v, note: (d.note||'').trim(), by: S.me||null}; put('members', m); closeSheet(); render();
    if (el.dataset.v === 'deborde' && typeof notifyPush === 'function') { /* la famille le voit sur l'accueil */ } },
  moodClear: () => { const m = clone(S.members.get(S.draft.mid)); delete m.mood; put('members', m); closeSheet(); render(); },
  helpOpen: el => { if (!S.me) { toast('Choisis d’abord qui tu es sur ce téléphone.'); return; } S.draft = {mid: el.dataset.id}; openSheet('help'); },
  takeTask: el => { const t = clone(S.tasks.get(el.dataset.id)); if (!t || !S.me) return; const today = localToday();
    t.swap = Object.fromEntries(Object.entries(t.swap || {}).filter(([d]) => d >= today)); t.swap[today] = S.me;
    put('tasks', t); renderSheet(); render(); toast(`Merci ! « ${t.name} » est pour toi aujourd’hui`); },
});
Object.assign(CH, {
  equipDate: el => { S.draft.dates[el.dataset.k] = el.value; },
  moodNote: el => { S.draft.note = el.value; },
});
LIVE.add('moodNote');
