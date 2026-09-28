/* CoTribu — univers Maison : tâches du jour, semaine, pièces, routines */

function todayItems(today, opts={}){
  const out = [];
  for (const t of S.tasks.values()){
    const r = S.rooms.get(t.roomId); if (!r) continue;
    const st = todayStatus(t, today); if (!st.show) continue;
    if (opts.mine && S.me){
      const a = assigneesOn(t, today);
      const mine = !a.length || a.includes(S.me) || (st.done && t.done && t.done[today] === S.me);
      if (!mine) continue;
    }
    out.push({t, st, r});
  }
  const tkey = x => x.t.time && x.t.time.at ? x.t.time.at : '99:99';
  out.sort((a,b) => (b.st.late - a.st.late) || tkey(a).localeCompare(tkey(b)) || ((a.r.order??0)-(b.r.order??0)) || ((a.t.order??0)-(b.t.order??0)));
  return out;
}
function whenLabel(x){
  if (x.st.late) return `<span class="tag late">En retard</span>`;
  return esc(timeLabel(x.t.time) || 'Aujourd’hui');
}
function taskRow(x, today, opts={}){
  const {t, st, r} = x;
  const who = st.done ? [ (t.done && t.done[today]) || t.lastBy ].filter(id => S.members.has(id)) : assigneesOn(t, today);
  const sub = st.done ? `Fait par ${esc(nameOf(who[0]))}` : esc(r.name) + (!isRoutine(t.rec) && !opts.noFreq ? ` · ${esc(recLabel(t.rec))}` : '');
  return `<div class="task ${st.done?'done':''}">
    <button class="check" data-act="toggle" data-id="${t.id}" aria-pressed="${st.done}" aria-label="${st.done?'Décocher':'Cocher'} ${esc(t.name)}">${checkIc()}</button>
    <div class="body" data-act="editTask" data-id="${t.id}" role="button" tabindex="0"><span class="name">${esc(t.name)}</span><span class="meta">${sub}</span></div>
    ${avatars(who)}
    ${opts.noWhen ? '' : `<span class="when">${whenLabel(x)}</span>`}
  </div>`;
}
function toggleTask(id){
  const today = localToday();
  const t = clone(S.tasks.get(id)); if (!t) return;
  t.done = t.done || {};
  const st = todayStatus(t, today);
  const a = assigneesOn(t, today);
  // qui reçoit le mérite (et les points) : moi si la tâche est à moi ; l'enfant si c'est sa tâche (il n'a pas forcément de téléphone)
  const kidOwner = a.length === 1 && (S.members.get(a[0]) || {}).kid;
  const who = (S.me && a.includes(S.me)) ? S.me : kidOwner ? a[0] : (S.me || a[0] || null);
  if (st.done){
    const prev = t.done[today];
    delete t.done[today];
    const past = Object.keys(t.done).sort();
    t.lastDone = past.at(-1) || null; t.lastBy = t.lastDone ? t.done[t.lastDone] : null;
    if (typeof removeTaskPoints === 'function') removeTaskPoints(prev, t, today);
    if (typeof doneCredit === 'function' && prev) doneCredit(prev, -1);
  } else {
    t.done[today] = who || 'x'; t.lastDone = today; t.lastBy = who;
    const keys = Object.keys(t.done).sort(); while (keys.length > 40) delete t.done[keys.shift()];
    if (who && typeof addTaskPoints === 'function') addTaskPoints(who, t, today);
    if (who && typeof doneCredit === 'function') doneCredit(who, 1);
  }
  put('tasks', t); render();
  if (!st.done && typeof celebrate === 'function') celebrate(who, today);
}
function whoAmICard(){
  if (S.me) return '';
  return `<div class="card"><h3>Qui utilise ce téléphone ?</h3><div class="chips">${sorted(S.members).map(m=>`<button class="chip" data-act="me" data-id="${m.id}">${avatar(m.id)}${esc(m.name)}</button>`).join('')}</div>
    <span class="muted small">Ton prénom n’est pas là ? Touche + en haut à droite.</span></div>`;
}
function cheer(done, total){
  if (!total) return 'Rien de prévu aujourd’hui';
  if (done === total) return 'Tout est fait, bravo la tribu !';
  const p = done/total;
  if (p >= .5) return 'On avance bien !';
  if (done > 0) return 'C’est parti !';
  return 'La journée commence';
}
function weekDots(){
  const today = localToday(), mon = mondayOf(today);
  return `<div class="wstrip">${[0,1,2,3,4,5,6].map(i => {
    const ds = addDays(mon, i);
    const n = [...S.tasks.values()].filter(t => S.rooms.has(t.roomId) && onDay(t, ds, today)).length;
    const cls = ds === today ? 'today' : '';
    return `<button class="wday ${cls}" data-act="maisonWeek" aria-pressed="${ds===today}"><small>${esc(cap(fmt(ds,{weekday:'short'}).replace('.','')))}</small><b>${ymd(ds)[2]}</b><span class="dots">${n?`<i style="background:${ds===today?'#fff':n>6?'var(--warm)':'var(--home)'}"></i>`:''}</span></button>`;
  }).join('')}</div>`;
}

VIEWS.maison = () => {
  const s = S.sub.maison;
  if (S.roomOpen && S.rooms.has(S.roomOpen)) return roomDetail(S.roomOpen);
  let h = ptitle('Maison', 'Des espaces bien gérés, une tribu plus sereine.');
  h += seg('msub', s, [['jour','Aujourd’hui'],['semaine','Semaine'],['pieces','Pièces'],['routines','Routines']], 'u-home');
  if (s === 'semaine') h += maisonWeek();
  else if (s === 'pieces') h += maisonRooms();
  else if (s === 'routines') h += maisonRoutines();
  else h += maisonToday();
  return h;
};

function maisonToday(){
  const today = localToday();
  const all = todayItems(today, {mine: S.filter === 'me'});
  const list = all.filter(x => !x.st.late), late = all.filter(x => x.st.late);
  const done = list.filter(x => x.st.done).length, total = list.length;
  let h = whoAmICard() + pauseCard('maison');
  h += `<div class="summary"><div class="ring" style="--p:${total?Math.round(done/total*100):0}"><span class="num">${done}/${total}</span></div>
    <div class="txt"><strong>Tâches du jour</strong><span class="muted">${cheer(done,total)}</span></div></div>`;
  h += seg('filter', S.filter === 'me' ? 'me' : 'all', [['me','Mes tâches'],['all','Tout le foyer']], 'u-home');
  if (late.length) h += `<section class="group late"><div class="ghead"><h3>En retard</h3><span class="pill late num">${late.length}</span></div>${late.map(x => taskRow(x, today)).join('')}</section>`;
  h += `<section class="group">${list.length ? list.map(x => taskRow(x, today)).join('') : `<div class="task"><span class="muted">${S.filter==='me' ? 'Aucune tâche à ton nom aujourd’hui.' : 'Rien de prévu aujourd’hui. Profitez-en.'}</span></div>`}</section>`;
  h += `<div class="u-home"><button class="addline" data-act="newTask">${icon('plus',20)}Ajouter une tâche</button></div>`;
  h += `<div class="card u-home"><button class="chead" data-act="maisonWeek"><span class="bubble soft">${icon('calendar-days',20)}</span><h3>Routine de la semaine</h3><span class="spacer"></span><span class="go">${icon('chevron-right',20)}</span></button>${weekDots()}</div>`;
  return h;
}

function maisonWeek(){
  const today = localToday(); let h = '';
  const rooms = sorted(S.rooms);
  for (let i=0;i<7;i++){
    const ds = addDays(today,i);
    const lines = [];
    rooms.forEach(r => [...S.tasks.values()].filter(t=>t.roomId===r.id).sort((a,b)=>(a.order??0)-(b.order??0)).forEach(t => { if (onDay(t,ds,today)) lines.push({t,r}); }));
    const roomNames = [...new Set(lines.map(l=>l.r.name))];
    h += `<section class="group"><div class="ghead"><div style="flex:1"><h3>${esc(cap(fmt(ds,{weekday:'long', day:'numeric', month:'long'})))}</h3>
      <span class="muted small">${i===0?'Aujourd’hui · ':''}${lines.length} ${lines.length>1?'tâches':'tâche'}${roomNames.length?' · '+esc(roomNames.join(', ')):''}</span></div></div>
      ${lines.map(l => { const a = assigneesOn(l.t, ds); return `<div class="task" data-act="editTask" data-id="${l.t.id}" role="button" tabindex="0"><div class="body"><span class="name">${esc(l.t.name)}</span><span class="meta">${esc(l.r.name)}${isRoutine(l.t.rec)?'':' · '+esc(recLabel(l.t.rec))}</span></div>${avatars(a)}${l.t.time&&l.t.time.at?`<span class="when">${esc(timeLabel(l.t.time))}</span>`:''}</div>`; }).join('') || '<div class="task"><span class="muted">Journée libre</span></div>'}
    </section>`;
  }
  return h;
}

function roomProgress(r, today){
  const items = [...S.tasks.values()].filter(t => t.roomId === r.id).map(t => todayStatus(t, today)).filter(s => s.show && !s.late);
  return {done: items.filter(s=>s.done).length, total: items.length, all: [...S.tasks.values()].filter(t=>t.roomId===r.id).length};
}
function maisonRooms(){
  const today = localToday();
  return `<div class="tiles u-home">${sorted(S.rooms).map(r => {
    const p = roomProgress(r, today);
    const pct = p.total ? Math.round(p.done/p.total*100) : 0;
    return `<button class="tile" data-act="openRoom" data-id="${r.id}"><span class="art">${icon(r.icon||'house',46)}</span>
      <span class="tb"><span class="tn"><span class="bubble soft sm">${icon(r.icon||'house',16)}</span>${esc(r.name)}</span>
      ${p.total ? `<span class="pbar"><b style="width:${pct}%"></b></span><span class="tc"><span class="num">${p.done}/${p.total} aujourd’hui</span>${icon('chevron-right',16)}</span>`
                : `<span class="tc"><span>${p.all} ${p.all>1?'tâches':'tâche'} · rien aujourd’hui</span>${icon('chevron-right',16)}</span>`}</span></button>`;
  }).join('')}<button class="tile addt" data-act="newRoom">${icon('plus',28)}Nouvelle pièce</button></div>` + equipCard();
}
function nextLabel(t, today){
  if (t.rec.type === 'interval'){ const due = intervalDue(t); return due <= today ? (due < today ? 'En retard' : 'Aujourd’hui') : fmtShort(due); }
  const n = nextOcc(t.rec, today)[0]; return n ? (n === today ? 'Aujourd’hui' : fmtShort(n)) : '—';
}
function roomDetail(id){
  const r = S.rooms.get(id), today = localToday();
  const p = roomProgress(r, today);
  const tasks = [...S.tasks.values()].filter(t => t.roomId === id).sort((a,b)=>(a.order??0)-(b.order??0));
  let h = `<div class="row">${backBtn('Pièces')}<span class="spacer"></span><button class="iconbtn" data-act="editRoom" data-id="${id}" aria-label="Modifier la pièce">${icon('pencil',18)}</button></div>`;
  h += `<div class="row u-home"><span class="bubble">${icon(r.icon||'house',22)}</span><h1 style="font-size:30px">${esc(r.name)}</h1></div>`;
  if (p.total) h += `<div class="u-home" style="display:flex;flex-direction:column;gap:6px"><span class="pbar"><b style="width:${Math.round(p.done/p.total*100)}%"></b></span><span class="muted small num">${p.done}/${p.total} tâches faites aujourd’hui</span></div>`;
  h += `<section class="group">${tasks.map(t => {
    const st = todayStatus(t, today);
    const a = assigneesOn(t, today);
    const checkBtn = st.show ? `<button class="check" data-act="toggle" data-id="${t.id}" aria-pressed="${!!st.done}" aria-label="Cocher ${esc(t.name)}">${checkIc()}</button>` : `<span class="check" style="border-style:dashed;opacity:.5" aria-hidden="true"></span>`;
    return `<div class="task ${st.done?'done':''}">${checkBtn}
      <div class="body" data-act="editTask" data-id="${t.id}" role="button" tabindex="0"><span class="name">${esc(t.name)}</span>
      <span class="meta"><span>${esc(recLabel(t.rec))}${t.time&&t.time.at?' · '+esc(timeLabel(t.time)):''}</span><span class="tag ${st.late?'late':''}">${st.late?'En retard':esc(nextLabel(t,today))}</span></span>${t.note?`<span class="meta">${esc(t.note)}</span>`:''}</div>${avatars(a)}</div>`;
  }).join('') || '<div class="task"><span class="muted">Aucune tâche dans cette pièce.</span></div>'}</section>`;
  h += `<div class="u-home"><button class="addline" data-act="newTask" data-room="${id}">${icon('plus',20)}Ajouter une tâche</button></div>`;
  return h;
}

function maisonRoutines(){
  const groups = {jour:[], semaine:[], mois:[]};
  for (const t of S.tasks.values()){
    if (!S.rooms.has(t.roomId)) continue;
    const r = t.rec;
    if ((r.type==='weekly' && r.days.length===7 && (r.every||1)===1) || (r.type==='interval' && r.days<=1)) groups.jour.push(t);
    else if (r.type==='weekly' || (r.type==='interval' && r.days<=14)) groups.semaine.push(t);
    else groups.mois.push(t);
  }
  const block = (key, title, sub, ic, uni) => {
    const list = groups[key].sort((a,b)=> (S.rooms.get(a.roomId).order - S.rooms.get(b.roomId).order) || (a.order-b.order));
    return `<section class="group ${uni}"><div class="ghead" style="background:var(--u-soft)"><span class="bubble sm">${icon(ic,16)}</span><div style="flex:1"><h3>${title}</h3><span class="muted small">${sub}</span></div><span class="pill num">${list.length}</span></div>
      ${list.map(t => `<button class="lrow" data-act="editTask" data-id="${t.id}"><span class="body"><span class="t">${esc(t.name)}</span><span class="s">${esc(S.rooms.get(t.roomId).name)} · ${esc(recLabel(t.rec))}${t.time&&t.time.at?' · '+esc(timeLabel(t.time)):''}</span></span>${avatars(assigneesOn(t, localToday()))}</button>`).join('') || '<div class="lrow"><span class="muted">Aucune</span></div>'}</section>`;
  };
  return pauseCard('routines') + balanceCard() + block('jour','Quotidiennes','Les indispensables du jour','sun','u-shop')
       + block('semaine','Hebdomadaires','Ce qu’on fait chaque semaine','calendar-days','u-home')
       + block('mois','Mensuelles et plus','Les grands entretiens','calendar','u-lav')
       + `<div class="u-home"><button class="addline" data-act="newTask">${icon('plus',20)}Nouvelle routine</button></div>`;
}

/* ---------- feuilles tâche / pièce ---------- */
function draftFromTask(t, roomId){
  const today = localToday(), mon = mondayOf(today);
  const firstRoom = roomId || S.roomOpen || (sorted(S.rooms)[0]||{}).id;
  const base = t ? clone(t) : {id:null, name:'', roomId:firstRoom, rec:{type:'weekly',days:[dow(today)],every:1,anchor:mon}, carry:false, assign:{mode:'anyone',members:[]}, time:null};
  const recs = {
    weekly:{type:'weekly', days:[dow(today)], every:1, anchor:mon},
    monthly:{type:'monthly', mode:'nth', nth:1, weekday:dow(today), day:1, every:1, months:[], anchor:today.slice(0,7)},
    interval:{type:'interval', days:14, anchor:today},
  };
  recs[base.rec.type] = {...recs[base.rec.type], ...clone(base.rec)};
  if (!recs.monthly.months) recs.monthly.months = [];
  const ivUnit = base.rec.type==='interval' ? (base.rec.days%30===0?30:base.rec.days%7===0?7:1) : 7;
  return {...base, rtype:base.rec.type, recs, ivUnit, ivN: base.rec.type==='interval' ? base.rec.days/ivUnit : 2,
    mfreq: (recs.monthly.months.length ? 'months' : String(recs.monthly.every||1)),
    tmode: base.time && base.time.at ? base.time.mode : 'none', tat: base.time && base.time.at ? base.time.at : '18:00',
    assign:{mode:base.assign?.mode||'anyone', members:[...(base.assign?.members||[])], anchor:base.assign?.anchor||mon}};
}
function draftRec(d){
  const today = localToday();
  if (d.rtype === 'interval') return {type:'interval', days:Math.max(1, Math.round((+d.ivN||1)*d.ivUnit)), anchor: d.recs.interval.anchor || today};
  if (d.rtype === 'monthly'){
    const m = d.recs.monthly;
    const r = {type:'monthly', mode:m.mode, anchor:m.anchor||today.slice(0,7), every: d.mfreq==='months' ? 1 : +d.mfreq, months: d.mfreq==='months' ? [...m.months] : []};
    if (m.mode === 'day') r.day = Math.min(31, Math.max(1, +m.day||1)); else { r.nth = +m.nth; r.weekday = +m.weekday; }
    return r;
  }
  const w = d.recs.weekly; return {type:'weekly', days:[...w.days], every:+w.every||1, anchor:w.anchor||mondayOf(today)};
}
SHEETS.task = () => {
  const d = S.draft, today = localToday();
  const rec = draftRec(d);
  const sg = (name, v, label, cur) => `<button data-act="${name}" data-v="${v}" aria-pressed="${cur===v}">${label}</button>`;
  let recFields = '';
  if (d.rtype === 'weekly'){
    const w = d.recs.weekly;
    recFields = `<div class="chips">${WEEK_ORDER.map(i=>`<button class="chip sq" data-act="wday" data-v="${i}" aria-pressed="${w.days.includes(i)}" aria-label="${DAYN[i]}">${DAYL[i]}</button>`).join('')}</div>
      <div class="frow"><label class="f" for="w-every">Rythme<select id="w-every" data-ch="wEvery">
        ${[[1,'Toutes les semaines'],[2,'Une semaine sur deux'],[3,'Toutes les 3 semaines'],[4,'Toutes les 4 semaines']].map(([v,l])=>`<option value="${v}" ${+w.every===v?'selected':''}>${l}</option>`).join('')}</select></label>
      ${+w.every>1 ? `<label class="f" for="w-start">À partir de<select id="w-start" data-ch="wStart">
        <option value="0" ${w.anchor===mondayOf(today)?'selected':''}>Cette semaine</option>
        <option value="7" ${w.anchor===addDays(mondayOf(today),7)?'selected':''}>La semaine prochaine</option></select></label>` : ''}</div>`;
  } else if (d.rtype === 'monthly'){
    const m = d.recs.monthly;
    recFields = `<div class="frow"><label class="f" for="mo-mode">Quel jour<select id="mo-mode" data-ch="moMode">
        <option value="nth" ${m.mode!=='day'?'selected':''}>Un jour de la semaine</option><option value="day" ${m.mode==='day'?'selected':''}>Une date du mois</option></select></label>
      ${m.mode==='day' ? `<label class="f" for="mo-day">Date<input type="number" id="mo-day" data-ch="moDay" min="1" max="31" value="${m.day||1}" inputmode="numeric"></label>`
      : `<label class="f" for="mo-nth">Lequel<select id="mo-nth" data-ch="moNth">${[[1,'1er'],[2,'2e'],[3,'3e'],[4,'4e'],[-1,'Dernier']].map(([v,l])=>`<option value="${v}" ${+m.nth===v?'selected':''}>${l}</option>`).join('')}</select></label>
         <label class="f" for="mo-wd">Jour<select id="mo-wd" data-ch="moWd">${WEEK_ORDER.map(i=>`<option value="${i}" ${+m.weekday===i?'selected':''}>${DAYN[i]}</option>`).join('')}</select></label>`}</div>
      <label class="f" for="mo-freq">Quels mois<select id="mo-freq" data-ch="moFreq">
        ${[['1','Tous les mois'],['2','Tous les 2 mois'],['3','Tous les 3 mois'],['6','Tous les 6 mois'],['months','Choisir les mois…']].map(([v,l])=>`<option value="${v}" ${d.mfreq===v?'selected':''}>${l}</option>`).join('')}</select></label>
      ${d.mfreq==='months' ? `<div class="chips">${MONS.map((l,i)=>`<button class="chip sq" data-act="mmonth" data-v="${i+1}" aria-pressed="${m.months.includes(i+1)}">${l}</button>`).join('')}</div>` : ''}`;
  } else {
    recFields = `<div class="frow"><label class="f" for="iv-n">Tous les<input type="number" id="iv-n" data-ch="ivN" min="1" max="365" value="${d.ivN}" inputmode="numeric"></label>
      <label class="f" for="iv-unit">&nbsp;<select id="iv-unit" data-ch="ivUnit"><option value="1" ${d.ivUnit===1?'selected':''}>jours</option><option value="7" ${d.ivUnit===7?'selected':''}>semaines</option><option value="30" ${d.ivUnit===30?'selected':''}>mois</option></select></label></div>
      <span class="info">Compté à partir de la dernière fois où c’est fait. Faites-le avec 5 jours de retard, le prochain rappel part de ce jour-là.</span>`;
  }
  let prev;
  if (rec.type === 'interval') prev = `Prochaine fois : <b>${esc(fmtShort(d.id ? intervalDue({...d, rec}) : (rec.anchor||today)))}</b>, puis ${esc(recLabel(rec).toLowerCase())}.`;
  else { const n = nextOcc(rec, today, 3); prev = n.length ? `Prochaines fois : <b>${n.map(fmtShort).map(esc).join('</b>, <b>')}</b>` : 'Choisissez au moins un jour.'; }
  const a = d.assign; const ms = sorted(S.members);
  const memberChips = ms.map(m => { const pos = a.members.indexOf(m.id); return `<button class="chip" data-act="amember" data-id="${m.id}" aria-pressed="${pos>=0}">${a.mode==='rotation' && pos>=0 ? `<span class="n">${pos+1}</span>` : avatar(m.id)}${esc(m.name)}</button>`; }).join('');
  let rotPrev = '';
  if (a.mode === 'rotation' && a.members.length > 1){
    const mon = mondayOf(today);
    rotPrev = `<div class="preview">${[0,1,2].map(k=>{ const w = Math.floor((idx(addDays(mon,7*k)) - idx(a.anchor))/7); return `Semaine ${isoWeek(addDays(mon,7*k))} → <b>${esc(nameOf(a.members[mod(w,a.members.length)]))}</b>`; }).join('<br>')}</div>`;
  }
  return `<h2>${d.id ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
    <div class="sect"><label class="f" for="t-name">Tâche<input type="text" id="t-name" data-ch="tName" value="${esc(d.name)}" placeholder="Ex. Nettoyer les vitres"></label>
      <label class="f" for="t-room">Pièce<select id="t-room" data-ch="tRoom">${sorted(S.rooms).map(r=>`<option value="${r.id}" ${r.id===d.roomId?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label></div>
    <div class="sect u-home"><span class="eyebrow">Quand</span>
      <div class="seg">${sg('rtype','weekly','Jours fixes',d.rtype)}${sg('rtype','monthly','Chaque mois',d.rtype)}${sg('rtype','interval','Après un délai',d.rtype)}</div>
      ${recFields}
      <div class="preview">${prev}</div></div>
    <div class="sect u-home"><span class="eyebrow">Horaire (facultatif)</span>
      <div class="seg">${sg('tmode','none','Dans la journée',d.tmode)}${sg('tmode','at','À une heure',d.tmode)}${sg('tmode','before','Avant',d.tmode)}</div>
      ${d.tmode !== 'none' ? `<label class="f" for="t-at">Heure<input type="time" id="t-at" data-ch="tAt" value="${esc(d.tat)}"></label>` : ''}</div>
    ${d.rtype !== 'interval' ? `<div class="sect u-home"><span class="eyebrow">Si elle n’est pas faite</span>
      <div class="seg">${sg('carry','1','Reste en retard',d.carry?'1':'0')}${sg('carry','0','Attend la prochaine fois',d.carry?'1':'0')}</div>
      <span class="info">${d.carry ? 'Elle reste dans « En retard » jusqu’à ce que quelqu’un la coche. Idéal pour ce qui est rare.' : 'Elle disparaît et revient à la prochaine date. Idéal pour ce qui est fréquent.'}</span></div>` : ''}
    <div class="sect u-shop"><span class="eyebrow">Points gagnés</span>
      <div class="chips">${[0,1,2,3,5,10].map(n => `<button class="chip sq" data-act="tPoints" data-v="${n}" aria-pressed="${(d.points ?? 1)===n}">${n}</button>`).join('')}</div>
      <span class="info">Ce que rapporte la tâche à celui qui la fait (Plus → Points et récompenses).</span></div>
    <div class="sect u-home"><span class="eyebrow">Qui s’en occupe</span>
      <div class="seg">${sg('amode','fixed','Toujours',a.mode)}${sg('amode','rotation','Chacun son tour',a.mode)}${sg('amode','anyone','Qui veut',a.mode)}</div>
      ${a.mode !== 'anyone' ? `<div class="chips">${memberChips}</div>` : '<span class="info">Visible par tout le monde, le premier qui la fait la coche.</span>'}
      ${a.mode==='rotation' ? `<span class="info">L’ordre des numéros donne le tour, une personne par semaine.</span>${rotPrev}` : ''}</div>
    <div class="actions"><button class="btn primary" data-act="saveTask">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>
    ${d.id ? `<button class="btn danger ${S.armed==='task'?'armed':''}" data-act="delTask">${S.armed==='task'?'Confirmer la suppression':'Supprimer cette tâche'}</button>` : ''}`;
};
SHEETS.room = () => {
  const d = S.draft; const ms = sorted(S.members);
  const n = [...S.tasks.values()].filter(t=>t.roomId===d.id).length;
  const a = d.assign;
  return `<h2>${d.id ? 'Modifier la pièce' : 'Nouvelle pièce'}</h2>
    <label class="f" for="r-name">Nom<input type="text" id="r-name" data-ch="rName" value="${esc(d.name)}" placeholder="Ex. Bureau"></label>
    <div class="sect u-home"><span class="eyebrow">Icône</span><div class="chips">${ROOM_ICONS.map(ic => `<button class="chip sq" data-act="rIcon" data-v="${ic}" aria-pressed="${(d.icon||'house')===ic}" aria-label="${ic}">${icon(ic,20)}</button>`).join('')}</div></div>
    <div class="actions"><button class="btn primary" data-act="saveRoom">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>
    ${d.id && n ? `<div class="sect u-home"><span class="eyebrow">Répartir toute la pièce</span>
      <div class="seg"><button data-act="ramode" data-v="fixed" aria-pressed="${a.mode==='fixed'}">Toujours</button><button data-act="ramode" data-v="rotation" aria-pressed="${a.mode==='rotation'}">Chacun son tour</button><button data-act="ramode" data-v="anyone" aria-pressed="${a.mode==='anyone'}">Qui veut</button></div>
      ${a.mode!=='anyone' ? `<div class="chips">${ms.map(m=>{const pos=a.members.indexOf(m.id); return `<button class="chip" data-act="ramember" data-id="${m.id}" aria-pressed="${pos>=0}">${a.mode==='rotation'&&pos>=0?`<span class="n">${pos+1}</span>`:avatar(m.id)}${esc(m.name)}</button>`;}).join('')}</div>` : ''}
      <button class="btn soft" data-act="applyRoom">Appliquer aux ${n} tâches</button></div>` : ''}
    ${d.id ? `<button class="btn danger ${S.armed==='room'?'armed':''}" data-act="delRoom">${S.armed==='room'?`Confirmer : supprimer la pièce et ses ${n} tâches`:'Supprimer la pièce'}</button>` : ''}`;
};

Object.assign(H, {
  msub: el => { S.sub.maison = el.dataset.v; S.roomOpen = null; render(); },
  maisonWeek: () => { S.tab = 'maison'; S.sub.maison = 'semaine'; render(); window.scrollTo(0,0); },
  filter: el => { S.filter = el.dataset.v; LS.set('cotribu-filter', S.filter); render(); },
  openRoom: el => goSub(() => { S.roomOpen = el.dataset.id; }),
  toggle: el => toggleTask(el.dataset.id),
  editTask: el => { const t = S.tasks.get(el.dataset.id); if (!t) return; S.draft = draftFromTask(t); openSheet('task'); },
  newTask: el => { if (!S.rooms.size) { toast('Crée d’abord une pièce.'); return; } S.draft = draftFromTask(null, el.dataset.room); openSheet('task'); },
  rtype: el => { S.draft.rtype = el.dataset.v; renderSheet(); },
  tmode: el => { S.draft.tmode = el.dataset.v; renderSheet(); },
  tPoints: el => { S.draft.points = +el.dataset.v; renderSheet(); },
  carry: el => { S.draft.carry = el.dataset.v === '1'; renderSheet(); },
  wday: el => { const w = S.draft.recs.weekly, v = +el.dataset.v; w.days = w.days.includes(v) ? w.days.filter(x=>x!==v) : [...w.days, v]; renderSheet(); },
  mmonth: el => { const m = S.draft.recs.monthly, v = +el.dataset.v; m.months = m.months.includes(v) ? m.months.filter(x=>x!==v) : [...m.months, v]; renderSheet(); },
  amode: el => { S.draft.assign.mode = el.dataset.v; renderSheet(); },
  amember: el => { const a = S.draft.assign, id = el.dataset.id; a.members = a.members.includes(id) ? a.members.filter(x=>x!==id) : [...a.members, id]; renderSheet(); },
  saveTask: () => {
    const d = S.draft; const name = d.name.trim();
    if (!name) { toast('Donne un nom à la tâche.'); document.getElementById('t-name')?.focus(); return; }
    const rec = draftRec(d);
    if (rec.type==='weekly' && !rec.days.length) { toast('Choisis au moins un jour.'); return; }
    if (rec.type==='monthly' && d.mfreq==='months' && !rec.months.length) { toast('Choisis au moins un mois.'); return; }
    const old = d.id ? S.tasks.get(d.id) : null;
    const today = localToday();
    const siblings = [...S.tasks.values()].filter(t=>t.roomId===d.roomId);
    const t = {
      id: d.id || uid('t'), roomId:d.roomId, name, rec, carry: rec.type==='interval' ? true : !!d.carry,
      time: d.tmode === 'none' || !d.tat ? null : {mode:d.tmode, at:d.tat}, points: d.points ?? 1,
      assign:{mode:d.assign.mode, members: d.assign.mode==='anyone' ? [] : d.assign.members, anchor:d.assign.anchor || mondayOf(today)},
      order: old ? old.order : (Math.max(0,...siblings.map(s=>s.order||0))+1),
      createdAt: old ? old.createdAt : today, lastDone: old ? old.lastDone : null, lastBy: old ? (old.lastBy||null) : null, done: old ? clone(old.done||{}) : {},
    };
    if (old && JSON.stringify(old.rec) !== JSON.stringify(rec)) t.createdAt = today;
    if (!d.id) t.by = S.me || null;
    put('tasks', t); if (!d.id) { if (typeof thinkCredit === 'function') thinkCredit('tasks'); } closeSheet(); render(); toast(d.id ? 'Tâche modifiée' : 'Tâche ajoutée');
  },
  delTask: () => { if (S.armed !== 'task') { S.armed = 'task'; renderSheet(); return; } del('tasks', S.draft.id); closeSheet(); render(); toast('Tâche supprimée'); },
  newRoom: () => { S.draft = {id:null, name:'', icon:'house', assign:{mode:'fixed', members:[]}}; openSheet('room'); },
  editRoom: el => { const r = S.rooms.get(el.dataset.id); S.draft = {...clone(r), assign:{mode:'rotation', members:[]}}; openSheet('room'); },
  rIcon: el => { S.draft.icon = el.dataset.v; renderSheet(); },
  ramode: el => { S.draft.assign.mode = el.dataset.v; renderSheet(); },
  ramember: el => { const a = S.draft.assign, id = el.dataset.id; a.members = a.members.includes(id) ? a.members.filter(x=>x!==id) : [...a.members, id]; renderSheet(); },
  applyRoom: () => {
    const a = S.draft.assign;
    if (a.mode !== 'anyone' && !a.members.length) { toast('Choisis au moins une personne.'); return; }
    const mon = mondayOf(localToday());
    putMany('tasks', [...S.tasks.values()].filter(t=>t.roomId===S.draft.id).map(t => { const c = clone(t); c.assign = {mode:a.mode, members: a.mode==='anyone'?[]:[...a.members], anchor:mon}; return c; }));
    closeSheet(); render(); toast('Répartition appliquée');
  },
  saveRoom: () => {
    const d = S.draft; const name = (d.name||'').trim(); if (!name) { toast('Donne un nom à la pièce.'); return; }
    const old = d.id ? S.rooms.get(d.id) : null;
    put('rooms', {id: d.id || uid('r'), name, icon: d.icon || 'house', order: old ? old.order : Math.max(0,...[...S.rooms.values()].map(r=>r.order||0))+1});
    closeSheet(); render(); toast(d.id ? 'Pièce modifiée' : 'Pièce ajoutée');
  },
  delRoom: () => {
    if (S.armed !== 'room') { S.armed = 'room'; renderSheet(); return; }
    const id = S.draft.id; [...S.tasks.values()].filter(t=>t.roomId===id).forEach(t=>del('tasks', t.id)); del('rooms', id);
    S.roomOpen = null; closeSheet(); render(); toast('Pièce supprimée');
  },
});
Object.assign(CH, {
  tName: el => { S.draft.name = el.value; },
  tRoom: el => { S.draft.roomId = el.value; },
  tAt: el => { S.draft.tat = el.value; },
  rName: el => { S.draft.name = el.value; },
  wEvery: el => { S.draft.recs.weekly.every = +el.value; renderSheet(); },
  wStart: el => { S.draft.recs.weekly.anchor = addDays(mondayOf(localToday()), +el.value); renderSheet(); },
  moMode: el => { S.draft.recs.monthly.mode = el.value; renderSheet(); },
  moDay: el => { S.draft.recs.monthly.day = +el.value; renderSheet(); },
  moNth: el => { S.draft.recs.monthly.nth = +el.value; renderSheet(); },
  moWd: el => { S.draft.recs.monthly.weekday = +el.value; renderSheet(); },
  moFreq: el => { S.draft.mfreq = el.value; renderSheet(); },
  ivN: el => { S.draft.ivN = el.value; renderSheet(); },
  ivUnit: el => { S.draft.ivUnit = +el.value; renderSheet(); },
});
['tName','rName'].forEach(k => LIVE.add(k));
