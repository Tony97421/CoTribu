/* CoTribu — IA (Premium) : phrase/dictée/photo, menus, répartition, maison auto, album de l'année */

function aiContext(members){
  const today = localToday();
  return {today, todayLabel: fmt(today,{weekday:'long', day:'numeric', month:'long', year:'numeric'}),
    members: (members || sorted(S.members)).map(m => ({id:m.id, name:m.name})),
    rooms: sorted(S.rooms).map(r => ({id:r.id, name:r.name})), people: Math.max(2, S.members.size)};
}
async function aiCall(mode, input, extra={}, householdId){
  const {data, error} = await sb.functions.invoke('cotribu-ai', {body:{mode, household: householdId || S.hh.id, input, context: extra.context || aiContext(), image: extra.image, imageType: extra.imageType}});
  if (error) {
    let code = 'ia_erreur';
    let detail = '';
    try { const j = await error.context.json(); code = j.error || code; detail = j.detail || ''; } catch(e) { if (!navigator.onLine) code = 'hors_ligne'; }
    if (detail) console.warn('IA :', detail);
    throw Object.assign(new Error(code), {code, detail});
  }
  if (data && data.used != null) S.aiUsage = data.used;
  return data.result;
}
function aiError(e){
  const c = e && (e.code || e.message);
  if (c === 'premium_requis') { S.ai && (S.ai.busy = false); openSheet('premiumGate'); return; }
  const msg = {
    ia_non_configuree: 'L’IA n’est pas encore activée (clé Anthropic à ajouter dans Supabase).',
    limite_mensuelle: 'Limite de 300 demandes atteinte ce mois-ci.',
    ia_occupee: 'L’IA est très demandée, réessaie dans une minute.',
    ia_credit: 'Crédit IA épuisé : recharge-le sur la Claude Console.',
    ia_quota: 'Quota Gemini atteint ou non disponible pour ce modèle (version gratuite). Réessaie plus tard.',
    ia_cle: 'La clé Gemini est refusée : vérifie GEMINI_API_KEY dans Supabase.',
    hors_ligne: 'Pas de connexion internet.',
  }[c] || 'L’IA n’a pas pu répondre. Réessaie dans un instant.';
  const detail = e && e.detail ? ` [${String(e.detail).slice(0, 140)}]` : '';
  toast(msg + (['ia_erreur','ia_quota','ia_occupee'].includes(c) ? detail : ''));
}
async function fileToBase64(file){
  const blob = await resizeImage(file, 1400, 0.8);
  return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
}

/* ---------- conversion des propositions en éléments de l'app ---------- */
function recFromAI(a){
  const today = localToday(), mon = mondayOf(today);
  if (a.rec_type === 'interval') return {type:'interval', days: Math.max(1, +a.interval_days || 7), anchor: today};
  if (a.rec_type === 'monthly') return {type:'monthly', mode:'nth', nth: [1,2,3,4,-1].includes(+a.month_nth) ? +a.month_nth : 1, weekday: (+a.month_weekday >= 0 && +a.month_weekday <= 6) ? +a.month_weekday : 6, every:1, months:[], anchor: today.slice(0,7)};
  const days = (a.weekdays || []).map(Number).filter(d => d >= 0 && d <= 6);
  return {type:'weekly', days: days.length ? [...new Set(days)] : [dow(today)], every: Math.max(1, Math.min(4, +a.every_weeks || 1)), anchor: mon};
}
function assignFromAI(a, validIds){
  const ids = (a.member_ids || []).filter(id => validIds.has(id));
  const mode = ['fixed','rotation','anyone'].includes(a.assign_mode) ? a.assign_mode : 'anyone';
  if (mode === 'anyone' || !ids.length) return {mode:'anyone', members:[], anchor: mondayOf(localToday())};
  return {mode: mode === 'rotation' && ids.length < 2 ? 'fixed' : mode, members: ids, anchor: mondayOf(localToday())};
}
const timeFromAI = a => /^\d\d:\d\d$/.test(a.time || '') ? {mode: a.time_mode === 'before' ? 'before' : 'at', at: a.time} : null;
const validDate = d => /^\d{4}-\d\d-\d\d$/.test(d || '') ? d : null;
const validTime = t => /^\d\d:\d\d$/.test(t || '') ? t : '';
function describeAction(a){
  const who = (a.member_ids || []).filter(id => S.members.has(id)).map(nameOf).join(', ');
  if (a.kind === 'event') { const e = {date: validDate(a.date) || localToday(), start: validTime(a.start), end: validTime(a.end), allDay: !!a.all_day || !validTime(a.start), repeat: a.repeat || 'none'};
    return {ic: CATS[a.category] ? CATS[a.category].icon : 'calendar', u:'u-plan', t: a.title, s: [cap(fmt(e.date,{weekday:'long', day:'numeric', month:'long'})), evTime(e), e.repeat !== 'none' ? (REPEATS.find(r => r[0] === e.repeat)||[])[1] : '', who, a.place].filter(Boolean).join(' · ')}; }
  if (a.kind === 'item') { const ai = aisleOf(AISLES.some(x => x.id === a.aisle) ? a.aisle : guessAisle(a.title)); return {ic: ai.icon, u:'u-shop', t: cap(a.title), s: [a.qty, ai.name].filter(Boolean).join(' · ')}; }
  if (a.kind === 'task') { const r = S.rooms.get(a.room_id); return {ic: r ? (r.icon||'house') : 'circle-check', u:'u-home', t: a.title, s: [r ? r.name : 'Toute la maison', recLabel(recFromAI(a)), timeLabel(timeFromAI(a)), who].filter(Boolean).join(' · ')}; }
  if (a.kind === 'meal') { const d = validDate(a.date) || localToday(); return {ic:'utensils', u:'u-shop', t: a.title, s: `${cap(fmt(d,{weekday:'long', day:'numeric'}))} ${a.slot === 'midi' ? 'midi' : 'soir'} · ${(a.ingredients||[]).length} ingrédients`}; }
  return {ic:'sparkles', u:'', t: a.title, s:''};
}
function applyAction(a){
  const ids = new Set(S.members.keys());
  if (a.kind === 'event') {
    const start = validTime(a.start), date = validDate(a.date) || localToday();
    put('events', {id:uid('e'), title:a.title, cat: CATS[a.category] ? a.category : 'famille', date, allDay: !!a.all_day || !start, start, end: validTime(a.end),
      members:(a.member_ids||[]).filter(id => ids.has(id)), place:a.place||'', note:a.note||'', repeat: REPEATS.some(r => r[0] === a.repeat) ? a.repeat : 'none', skip:[], by:S.me||null});
  } else if (a.kind === 'item') {
    addIngredient({name:a.title, qty:a.qty||'', aisle: AISLES.some(x => x.id === a.aisle) ? a.aisle : guessAisle(a.title)});
  } else if (a.kind === 'task') {
    const roomId = S.rooms.has(a.room_id) ? a.room_id : (sorted(S.rooms)[0]||{}).id; if (!roomId) return;
    const siblings = [...S.tasks.values()].filter(t => t.roomId === roomId);
    const rec = recFromAI(a);
    put('tasks', {id:uid('t'), roomId, name:a.title, rec, carry: rec.type === 'interval' || rec.type === 'monthly', time: timeFromAI(a), assign: assignFromAI(a, ids),
      order: Math.max(0, ...siblings.map(s => s.order||0)) + 1, createdAt: localToday(), lastDone:null, lastBy:null, done:{}});
  } else if (a.kind === 'meal') {
    put('meals', {id:uid('r'), name:a.title, date: validDate(a.date) || localToday(), slot: a.slot === 'midi' ? 'midi' : 'soir',
      ingredients:(a.ingredients||[]).map(g => ({name:cap(g.name), qty:g.qty||'', aisle:guessAisle(g.name)})), by:S.me||null});
  }
}

/* ---------- 1. Écrire, dicter ou photographier ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
function toggleDictation(){
  if (!SR) { toast('La dictée n’est pas disponible ici : utilise le micro du clavier.'); return; }
  if (recog) { recog.stop(); return; }
  recog = new SR(); recog.lang = 'fr-FR'; recog.interimResults = true; recog.continuous = false;
  const base = (S.ai.text || '').trim();
  recog.onresult = ev => { const t = [...ev.results].map(r => r[0].transcript).join(''); S.ai.text = (base ? base + ' ' : '') + t; const el = document.getElementById('ai-text'); if (el) el.value = S.ai.text; };
  recog.onend = () => { recog = null; renderSheet(); };
  recog.onerror = () => { recog = null; renderSheet(); toast('Micro indisponible : vérifie l’autorisation du micro.'); };
  recog.start(); renderSheet();
}
SHEETS.ai = () => {
  const a = S.ai;
  if (a.busy) return `<h2>${icon('sparkles',22,'style="display:inline;vertical-align:-3px"')} Un instant…</h2><div class="thinking"><i></i>${a.image ? 'L’IA lit la photo' : 'L’IA prépare les ajouts'}</div>`;
  if (a.result) {
    const acts = a.result.actions || [];
    return `<h2>Voici ce que j’ai compris</h2><span class="muted">${esc(a.result.message || '')}</span>
      ${acts.length ? `<div class="card" style="padding:4px 16px">${acts.map((x,i) => { const d = describeAction(x); return `<label class="act ${d.u}"><input type="checkbox" data-ch="aiPick" data-i="${i}" ${a.picked.has(i)?'checked':''}><span class="bubble sm">${icon(d.ic,16)}</span><span class="body"><span class="t">${esc(d.t)}</span><br><span class="s">${esc(d.s)}</span></span></label>`; }).join('')}</div>
        <div class="actions"><button class="btn deep" data-act="aiApply" ${a.picked.size?'':'disabled'}>Ajouter (${a.picked.size})</button><button class="btn soft" data-act="aiRetry">Modifier</button></div>`
      : `<button class="btn soft" data-act="aiRetry">Reformuler</button>`}`;
  }
  return `<h2>${icon('sparkles',22,'style="display:inline;vertical-align:-3px"')} Dis-le simplement</h2>
    <div class="ai-box">
      <textarea id="ai-text" data-ch="aiText" placeholder="Ex. Rafaël a judo tous les mercredis à 17h30. Racheter du lait, 6 œufs et de la lessive. Dîner chez mamie samedi soir.">${esc(a.text||'')}</textarea>
      ${a.imagePreview ? `<div class="uploads"><span class="ph"><img src="${a.imagePreview}" alt=""><button data-act="aiNoImage" aria-label="Retirer la photo">${icon('x',14)}</button></span></div>` : ''}
      <div class="ai-row"><button class="btn soft mic ${recog?'on':''}" data-act="aiMic">${icon('mic',18)}${recog ? 'J’écoute… (toucher pour arrêter)' : 'Dicter'}</button>
        <label class="btn soft filebtn">${icon('camera',18)}Photo<input type="file" id="ai-photo" accept="image/*" data-ch="aiPhoto"></label></div>
      <span class="info">Une photo du mot de l’école, d’un calendrier ou d’une recette marche aussi.</span>
      <button class="btn deep" data-act="aiSend">${icon('sparkles',18)}Envoyer à l’IA</button>
    </div>${isPremium() ? '' : '<span class="lock">Premium</span>'}`;
};
async function aiSend(){
  const a = S.ai; const text = (a.text||'').trim();
  if (!text && !a.image) { toast('Écris, dicte ou ajoute une photo.'); return; }
  if (!requirePremium()) return;
  if (recog) recog.stop();
  a.busy = true; renderSheet();
  try {
    const res = await aiCall('parse', text || 'Extrais les informations utiles de cette photo.', {image:a.image, imageType:'image/jpeg'});
    a.result = res; a.picked = new Set((res.actions||[]).map((_,i) => i));
  } catch(e) { aiError(e); }
  a.busy = false; if (S.sheet === 'ai') renderSheet();
}

/* ---------- 2. Menus de la semaine ---------- */
SHEETS.aiMenus = () => {
  const m = S.aiM;
  if (m.busy) return `<h2>Un instant…</h2><div class="thinking"><i></i>L’IA compose vos menus</div>`;
  if (m.result) {
    const meals = m.result.meals || [];
    return `<h2>Menus proposés</h2><span class="muted">${esc(m.result.message||'')}</span>
      <div class="card" style="padding:4px 16px">${meals.map((x,i) => `<label class="act u-shop"><input type="checkbox" data-ch="menuPick" data-i="${i}" ${m.picked.has(i)?'checked':''}><span class="bubble sm">${icon('utensils',16)}</span><span class="body"><span class="t">${esc(x.name)}</span><br><span class="s">${esc(cap(fmt(validDate(x.date)||localToday(),{weekday:'long', day:'numeric'})))} ${x.slot==='midi'?'midi':'soir'} · ${(x.ingredients||[]).length} ingrédients</span></span></label>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="menu-shop" data-ch="menuShop" ${m.shop?'checked':''}>Ajouter aussi les ingrédients aux courses</label>
      <div class="actions"><button class="btn upri u-shop" data-act="menuApply" ${m.picked.size?'':'disabled'}>Ajouter au menu (${m.picked.size})</button><button class="btn soft" data-act="menuRetry">Autres idées</button></div>`;
  }
  return `<h2>${icon('chef-hat',22,'style="display:inline;vertical-align:-3px"')} Menus de la semaine</h2>
    <label class="f" for="menu-prefs">Vos envies et contraintes<textarea id="menu-prefs" data-ch="menuPrefs" placeholder="Ex. rapide en semaine, pas de poisson, un plat végétarien, les enfants n’aiment pas les épinards">${esc(m.prefs||'')}</textarea></label>
    <div class="sect"><span class="eyebrow">Quels repas</span><div class="chips u-shop">${[['midi','Midis'],['soir','Soirs']].map(([v,l]) => `<button class="chip" data-act="menuSlot" data-v="${v}" aria-pressed="${m.slots.includes(v)}">${l}</button>`).join('')}</div></div>
    <label class="toggle"><input type="checkbox" id="menu-free" data-ch="menuFree" ${m.onlyFree?'checked':''}>Seulement les repas pas encore prévus</label>
    <button class="btn upri u-shop" data-act="menuSend">${icon('sparkles',18)}Proposer des menus</button>
    ${isPremium() ? '' : '<span class="lock">Premium</span>'}`;
};
async function menuSend(){
  if (!requirePremium()) return;
  const m = S.aiM, mon = S.mealWeek || mondayOf(localToday()), today = localToday();
  const wanted = [];
  for (let i=0;i<7;i++){ const ds = addDays(mon,i); if (ds < today) continue; for (const slot of m.slots) { if (m.onlyFree && mealsOn(ds).some(x => x.slot === slot)) continue; wanted.push(`${ds} ${slot}`); } }
  if (!wanted.length) { toast('Tous les repas de la semaine sont déjà prévus.'); return; }
  m.busy = true; renderSheet();
  try {
    const res = await aiCall('menus', `Repas à proposer : ${wanted.join(', ')}.\nPréférences : ${m.prefs || 'aucune en particulier'}.\nDéjà prévus cette semaine : ${[...S.meals.values()].filter(x => x.date >= mon && x.date <= addDays(mon,6)).map(x => x.name).join(', ') || 'rien'}.`);
    m.result = res; m.picked = new Set((res.meals||[]).map((_,i) => i));
  } catch(e) { aiError(e); }
  m.busy = false; if (S.sheet === 'aiMenus') renderSheet();
}

/* ---------- 3. Répartition des tâches ---------- */
function doneStats(days=30){
  const from = addDays(localToday(), -days), counts = {};
  sorted(S.members).forEach(m => counts[m.id] = 0);
  for (const t of S.tasks.values()) for (const [d, who] of Object.entries(t.done||{})) if (d >= from && counts[who] != null) counts[who]++;
  return counts;
}
function balanceCard(){
  const c = doneStats(), total = Object.values(c).reduce((a,b)=>a+b,0);
  const max = Math.max(1, ...Object.values(c));
  return `<div class="card u-home"><div class="row"><span class="bubble soft">${icon('users',18)}</span><h3 style="flex:1">Qui fait quoi (30 jours)</h3>${isPremium() || !AI_ON ?'':'<span class="lock">Premium</span>'}</div>
    ${total ? `<div class="bars">${sorted(S.members).map(m => `<div class="barrow"><span class="n">${esc(m.name)}</span><span class="track"><b style="width:${Math.round(c[m.id]/max*100)}%;background:${memberColor(m)}"></b></span><span class="v">${c[m.id]}</span></div>`).join('')}</div>`
      : '<span class="muted small">Les statistiques apparaîtront quand des tâches auront été cochées (en choisissant « Je suis… » sur chaque téléphone).</span>'}
    ${AI_ON ? `<button class="btn upri" data-act="balanceAsk">${icon('sparkles',18)}Conseils de l’IA pour mieux répartir</button>` : ''}</div>`;
}
SHEETS.aiBalance = () => {
  const b = S.aiB;
  if (b.busy) return `<h2>Un instant…</h2><div class="thinking"><i></i>L’IA regarde qui fait quoi</div>`;
  if (!b.result) return '';
  const ch = (b.result.changes||[]).filter(x => S.tasks.has(x.task_id));
  return `<h2>Pour mieux répartir</h2><p style="margin:0">${esc(b.result.message||'')}</p>
    ${ch.length ? `<div class="card" style="padding:4px 16px">${ch.map((x,i) => { const t = S.tasks.get(x.task_id); const ids = (x.member_ids||[]).filter(id => S.members.has(id));
      const who = x.assign_mode === 'anyone' ? 'Qui veut' : (x.assign_mode === 'rotation' ? 'Chacun son tour : ' : '') + ids.map(nameOf).join(x.assign_mode === 'rotation' ? ' → ' : ', ');
      return `<label class="act u-home"><input type="checkbox" data-ch="balPick" data-i="${i}" ${b.picked.has(i)?'checked':''}><span class="body"><span class="t">${esc(t.name)} · ${esc((S.rooms.get(t.roomId)||{}).name||'')}</span><br><span class="s">${esc(who)} — ${esc(x.reason||'')}</span></span></label>`; }).join('')}</div>
      <div class="actions"><button class="btn deep" data-act="balApply" ${b.picked.size?'':'disabled'}>Appliquer (${b.picked.size})</button><button class="btn soft" data-act="close">Plus tard</button></div>`
    : '<button class="btn soft" data-act="close">Fermer</button>'}`;
};
async function balanceAsk(){
  if (!requirePremium()) return;
  const c = doneStats(), today = localToday();
  const tasks = [...S.tasks.values()].filter(t => S.rooms.has(t.roomId)).map(t => {
    const a = t.assign || {mode:'anyone', members:[]};
    const by = {}; for (const [d, who] of Object.entries(t.done||{})) if (d >= addDays(today,-30)) by[nameOf(who)] = (by[nameOf(who)]||0)+1;
    return `${t.id} | ${t.name} | ${S.rooms.get(t.roomId).name} | ${recLabel(t.rec)} | attribution: ${a.mode}${(a.members||[]).length ? ' (' + a.members.map(nameOf).join(', ') + ')' : ''} | fait par: ${Object.entries(by).map(([n,k]) => n+' ×'+k).join(', ') || 'personne'}`;
  });
  S.aiB = {busy:true, result:null, picked:new Set()}; openSheet('aiBalance');
  try {
    const res = await aiCall('balance', `Totaux sur 30 jours : ${sorted(S.members).map(m => m.name+' '+c[m.id]).join(', ')}.\nTâches :\n${tasks.join('\n')}`);
    S.aiB.result = res; S.aiB.picked = new Set((res.changes||[]).map((_,i) => i));
  } catch(e) { closeSheet(); aiError(e); }
  S.aiB.busy = false; if (S.sheet === 'aiBalance') renderSheet();
}

/* ---------- 4. Maison créée par l'IA (à l'inscription, gratuit) ---------- */
async function aiSetupTemplate(householdId, members, description){
  const ctx = {...aiContext(members), rooms:[]};
  const res = await aiCall('setup', `Description du foyer : ${description}\nMembres : ${members.map(m => m.id + ' = ' + m.name).join(', ')}.`, {context:ctx}, householdId);
  if (!res || !(res.rooms||[]).length) return null;
  const today = localToday();
  const ids = new Set(members.map(m => m.id));
  const rooms = res.rooms.slice(0, 14).map((r,i) => ({id:'r-' + (String(r.key||i).toLowerCase().replace(/[^a-z0-9-]/g,'') || i) + '-' + i, key:r.key, name:r.name, icon: ROOM_ICONS.includes(r.icon) ? r.icon : 'house', order:i}));
  const byKey = new Map(rooms.map(r => [r.key, r.id]));
  const counters = {};
  const tasks = (res.tasks||[]).slice(0, 80).filter(t => byKey.has(t.room_key)).map(t => {
    const roomId = byKey.get(t.room_key); counters[roomId] = (counters[roomId]||0) + 1;
    const rec = recFromAI(t);
    return {id:`t-${roomId}-${counters[roomId]}`, roomId, name:t.name, rec, carry: !!t.carry || rec.type === 'interval', time: timeFromAI(t),
      assign: assignFromAI(t, ids), order: counters[roomId], createdAt: today, lastDone:null, done:{}};
  });
  rooms.forEach(r => delete r.key);
  return tasks.length ? {members, rooms, tasks} : null;
}

/* ---------- 5. Album de l'année ---------- */
function viewAlbum(){
  const y = S.albumYear || localToday().slice(0,4);
  const a = S.albums.get('a-' + y);
  let h = backBtn('Souvenirs');
  const years = [...new Set([...S.memories.values()].map(m => m.date.slice(0,4)))].sort().reverse();
  if (years.length > 1) h += `<div class="chips u-mem">${years.map(yy => `<button class="chip" data-act="albumYear" data-v="${yy}" aria-pressed="${yy===y}">${yy}</button>`).join('')}</div>`;
  const mems = [...S.memories.values()].filter(m => m.date.slice(0,4) === y);
  if (S.albumBusy) return h + `<div class="thinking" style="padding:40px 0"><i></i>L’IA écrit votre album ${esc(y)}…</div>`;
  if (!a) return h + `<div class="prem" style="background:linear-gradient(135deg,var(--mem-soft),#FAF0D8)"><span class="badge">Album ${esc(y)}</span><h2>Votre année racontée</h2>
    <span>${mems.length} souvenir${mems.length>1?'s':''} cette année. L’IA les rassemble en un petit album, mois par mois.</span>
    <button class="btn upri u-mem" data-act="albumMake" ${mems.length?'':'disabled'}>${icon('sparkles',18)}Créer l’album ${esc(y)}</button>${isPremium()?'':'<span class="lock">Premium</span>'}</div>`;
  h += `<div class="album" style="display:flex;flex-direction:column;gap:18px"><h1>${esc(a.title)}</h1><p style="margin:0;font-size:17px">${esc(a.intro)}</p>`;
  for (const c of (a.chapters||[]).sort((p,q) => p.month - q.month)) {
    const ms = (c.memory_ids||[]).map(id => S.memories.get(id)).filter(Boolean);
    const photos = ms.flatMap(m => (m.photos||[]).slice(0,2)).slice(0,6);
    h += `<div class="ch"><span class="mo">${esc(cap(MON[(c.month||1)-1]||''))} · ${esc(c.title)}</span><p style="margin:0">${esc(c.text)}</p>
      ${photos.length ? `<div class="photos">${photos.map(p => `<button class="ph" data-act="viewPhoto" data-path="${esc(p)}">${photoImg(p)}</button>`).join('')}</div>` : ''}
      ${ms.length ? `<div class="chips">${ms.map(m => `<button class="chip" data-act="openMemory" data-id="${m.id}">${icon('heart',14)}${esc(m.title)}</button>`).join('')}</div>` : ''}</div>`;
  }
  h += `<p style="margin:0;font-style:italic">${esc(a.ending||'')}</p><button class="btn soft" data-act="albumMake">${icon('rotate-ccw',18)}Réécrire l’album</button></div>`;
  return h;
}
async function albumMake(){
  if (!requirePremium()) return;
  const y = S.albumYear || localToday().slice(0,4);
  const mems = [...S.memories.values()].filter(m => m.date.slice(0,4) === y).sort((a,b) => a.date.localeCompare(b.date));
  if (!mems.length) return;
  S.albumBusy = true; render();
  try {
    const res = await aiCall('album', `Année ${y}. Souvenirs :\n` + mems.map(m => `${m.id} | ${m.date} | ${m.title} | ${m.text||''} | avec : ${(m.members||[]).map(nameOf).join(', ')} | ${(m.photos||[]).length} photos`).join('\n'));
    put('albums', {id:'a-' + y, year:y, ...res, createdAt:new Date().toISOString()});
  } catch(e) { aiError(e); }
  S.albumBusy = false; render();
}

Object.assign(H, {
  aiOpen: () => { S.ai = {text:'', busy:false, result:null, picked:new Set(), image:null, imagePreview:null}; if (S.sheet) { S.sheet = 'ai'; renderSheet(); } else openSheet('ai'); },
  aiMic: () => toggleDictation(),
  aiSend: () => aiSend(),
  aiNoImage: () => { S.ai.image = null; S.ai.imagePreview = null; renderSheet(); },
  aiRetry: () => { S.ai.result = null; renderSheet(); },
  aiApply: () => { const acts = S.ai.result.actions || []; let n = 0; acts.forEach((a,i) => { if (S.ai.picked.has(i)) { applyAction(a); n++; } }); closeSheet(); render(); toast(`${n} ajout${n>1?'s':''} fait${n>1?'s':''}`); },
  menuOpen: () => { S.aiM = {prefs: LS.get('cotribu-menu-prefs') || '', slots:['soir'], onlyFree:true, shop:true, busy:false, result:null, picked:new Set()}; openSheet('aiMenus'); },
  menuSlot: el => { const m = S.aiM, v = el.dataset.v; m.slots = m.slots.includes(v) ? m.slots.filter(x => x !== v) : [...m.slots, v]; if (!m.slots.length) m.slots = [v]; renderSheet(); },
  menuSend: () => { LS.set('cotribu-menu-prefs', S.aiM.prefs || ''); menuSend(); },
  menuRetry: () => { S.aiM.result = null; menuSend(); },
  menuApply: () => {
    const m = S.aiM; let n = 0, g = 0;
    (m.result.meals||[]).forEach((x,i) => { if (!m.picked.has(i)) return;
      const meal = {id:uid('r'), name:x.name, date: validDate(x.date) || localToday(), slot: x.slot === 'midi' ? 'midi' : 'soir', ingredients:(x.ingredients||[]).map(k => ({name:cap(k.name), qty:k.qty||'', aisle:guessAisle(k.name)})), by:S.me||null};
      put('meals', meal); n++;
      if (m.shop) meal.ingredients.forEach(k => { if (addIngredient(k)) g++; });
    });
    closeSheet(); render(); toast(`${n} repas ajouté${n>1?'s':''}${g ? `, ${g} ingrédients dans les courses` : ''}`);
  },
  balanceAsk: () => balanceAsk(),
  balApply: () => {
    const b = S.aiB, ch = (b.result.changes||[]).filter(x => S.tasks.has(x.task_id)); const ids = new Set(S.members.keys()); let n = 0;
    ch.forEach((x,i) => { if (!b.picked.has(i)) return; const t = clone(S.tasks.get(x.task_id)); t.assign = assignFromAI(x, ids); put('tasks', t); n++; });
    closeSheet(); render(); toast(`${n} changement${n>1?'s':''} appliqué${n>1?'s':''}`);
  },
  goAlbum: () => goSub(() => { S.sub.plus = 'album'; }),
  albumYear: el => { S.albumYear = el.dataset.v; render(); },
  albumMake: () => albumMake(),
});
Object.assign(CH, {
  aiText: el => { S.ai.text = el.value; },
  aiPick: el => { const s = S.ai.picked, i = +el.dataset.i; el.checked ? s.add(i) : s.delete(i); renderSheet(); },
  aiPhoto: async el => { const f = el.files && el.files[0]; if (!f) return; try { S.ai.image = await fileToBase64(f); S.ai.imagePreview = 'data:image/jpeg;base64,' + S.ai.image; renderSheet(); } catch(e) { toast('Impossible de lire cette photo.'); } },
  menuPrefs: el => { S.aiM.prefs = el.value; },
  menuFree: el => { S.aiM.onlyFree = el.checked; },
  menuShop: el => { S.aiM.shop = el.checked; },
  menuPick: el => { const s = S.aiM.picked, i = +el.dataset.i; el.checked ? s.add(i) : s.delete(i); renderSheet(); },
  balPick: el => { const s = S.aiB.picked, i = +el.dataset.i; el.checked ? s.add(i) : s.delete(i); renderSheet(); },
});
['aiText','menuPrefs'].forEach(k => LIVE.add(k));
