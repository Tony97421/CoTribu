/* CoTribu — Accueil (Aujourd'hui), Plus, Foyer, Bienvenue */

VIEWS.today = () => {
  const today = localToday();
  const tasks = todayItems(today, {mine:false});
  const list = tasks.filter(x => !x.st.late), late = tasks.filter(x => x.st.late);
  const done = list.filter(x=>x.st.done).length, total = list.length;
  let h = ptitle('Aujourd’hui', esc(cap(fmt(today,{weekday:'long', day:'numeric', month:'long', year:'numeric'}))),
    `<div class="row"><button class="pillbtn" data-act="goPlanWeek">${icon('calendar-days',18)}Vue semaine</button><button class="fab" data-act="quickAdd" aria-label="Ajouter">${icon('plus',26)}</button></div>`);
  if (!S.dismissed.hello && LS.get('cotribu-dismiss-hello') !== today) {
    const hr = new Date().getHours();
    const hello = hr < 12 ? 'Belle journée à toute la tribu !' : hr < 18 ? 'Bel après-midi à la tribu !' : 'Bonne soirée à la tribu !';
    const line = done ? `${done} ${done>1?'tâches terminées':'tâche terminée'} aujourd’hui` : total ? `${total} ${total>1?'tâches':'tâche'} au programme` : 'Rien d’urgent aujourd’hui';
    h += `<div class="banner"><span class="sun">${icon('sun',24)}</span><div><h3>${hello}</h3><span class="muted small">${line}</span></div><button class="x" data-act="dismiss" data-v="hello" aria-label="Masquer">${icon('x',18)}</button></div>`;
  }
  h += whoAmICard() + installCard(true);

  // Tâches du jour
  const shown = [...late, ...list].slice(0, 6);
  h += `<div class="card u-home"><button class="chead" data-act="tab" data-v="maison"><span class="bubble soft">${icon('circle-check',20)}</span><h3>Tâches du jour</h3><span class="go">${icon('chevron-right',18)}</span><span class="spacer"></span>
      <span class="muted small num" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${done}/${total} terminées<span class="pbar" style="width:110px"><b style="width:${total?Math.round(done/total*100):0}%"></b></span></span></button>
    <div class="mini">${shown.map(x => taskRow(x, today, {noFreq:true})).join('') || '<span class="muted small">Rien de prévu aujourd’hui.</span>'}</div>
    ${tasks.length > shown.length ? `<button class="btn ghost sm" data-act="tab" data-v="maison">Voir les ${tasks.length} tâches</button>` : ''}
    <button class="addline" data-act="newTask">${icon('plus',20)}Ajouter une tâche</button></div>`;

  // Planning + Repas
  const evs = eventsOn(today);
  const meals = mealsOn(today);
  const hr = new Date().getHours();
  const meal = meals.find(m => m.slot === (hr < 14 ? 'midi' : 'soir')) || meals[0];
  h += `<div class="grid2">
    <div class="ucard u-plan"><button class="chead" data-act="goPlanDay"><span class="bubble sm">${icon('calendar',16)}</span><h3>Planning</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
      ${evs.length ? `<div class="dayline">${evs.slice(0,5).map(e => `<button class="it" style="border:0;background:none;padding:0;text-align:left;color:inherit" data-act="editEvent" data-id="${e.id}" data-day="${today}"><span class="hr"><i style="background:${catOf(e).c}"></i>${e.allDay||!e.start?'Jour':esc(hm(e.start))}</span><span>${esc(e.title)}</span></button>`).join('')}</div>` : '<span class="muted small">Aucun événement aujourd’hui.</span>'}
      <button class="addline" data-act="newEvent">${icon('plus',18)}Événement</button></div>
    <div class="ucard u-shop"><button class="chead" data-act="goRepas"><span class="bubble sm">${icon('utensils',16)}</span><h3>Repas</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
      ${meal ? `<button class="row" style="border:0;background:none;padding:0;text-align:left;color:inherit" data-act="editMeal" data-id="${meal.id}"><span class="mealpic" style="width:56px;height:56px">${icon('soup',26)}</span><span><span class="kicker">${meal.slot==='midi'?'Ce midi':'Ce soir'}</span><br><strong>${esc(meal.name)}</strong></span></button>` : '<span class="muted small">Rien de prévu pour ce soir.</span>'}
      <button class="addline" data-act="newMeal" data-date="${today}" data-slot="${hr<14?'midi':'soir'}">${icon('plus',18)}Repas</button></div>
  </div>`;

  // Courses + Souvenirs
  const toBuy = activeItems().filter(i => !i.done);
  const tb = throwback();
  const lastMem = tb || [...S.memories.values()].sort((a,b)=>b.date.localeCompare(a.date))[0];
  h += `<div class="grid2">
    <div class="ucard u-shop"><button class="chead" data-act="tab" data-v="courses"><span class="bubble sm">${icon('shopping-cart',16)}</span><h3>Courses</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
      ${toBuy.length ? `<div class="mini">${toBuy.slice(0,3).map(i => `<div class="task"><button class="check" data-act="itemToggle" data-id="${i.id}" aria-label="Cocher ${esc(i.name)}">${checkIc()}</button><span class="body"><span class="name" style="font-weight:500">${esc(i.name)}</span></span></div>`).join('')}</div>${toBuy.length>3?`<span class="muted small">+ ${toBuy.length-3} autres</span>`:''}` : '<span class="muted small">La liste est vide.</span>'}
      <button class="addline" data-act="goAddItem">${icon('plus',18)}Article</button></div>
    <div class="ucard u-mem"><button class="chead" data-act="goSouvenirs"><span class="bubble sm">${icon('heart',16)}</span><h3>Souvenirs</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
      ${lastMem ? `<button style="border:0;background:none;padding:0;text-align:left;color:inherit;display:flex;flex-direction:column;gap:6px" data-act="openMemory" data-id="${lastMem.id}">${(lastMem.photos||[])[0]?`<span class="memthumb" style="width:100%;height:90px">${photoImg(lastMem.photos[0])}</span>`:''}<span class="kicker">${esc(tb ? agoLabel(tb) : 'Dernier souvenir')}</span><strong>${esc(lastMem.title)}</strong></button>` : '<span class="muted small">Les beaux moments de la famille, gardés ici.</span>'}
      <button class="addline" data-act="newMemory">${icon('plus',18)}Souvenir</button></div>
  </div>`;
  return h;
};
SHEETS.quick = () => `<h2>Ajouter</h2><div class="menu">
  ${[['newTask','circle-check','Une tâche','u-home'],['newEvent','calendar','Un événement','u-plan'],['goAddItem','shopping-cart','Un article de courses','u-shop'],['newMealQ','utensils','Un repas','u-shop'],['newMemory','heart','Un souvenir','u-mem']]
    .map(([a,ic,l,u]) => `<button class="lrow ${u}" data-act="${a}"><span class="bubble sm">${icon(ic,16)}</span><span class="body"><span class="t">${l}</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>
  <button class="btn soft" data-act="close">Fermer</button>`;

/* ---------- Plus ---------- */
VIEWS.plus = () => {
  if (S.sub.plus === 'repas') return VIEWS_REPAS();
  if (S.sub.plus === 'souvenirs') return VIEWS_SOUVENIRS();
  if (S.sub.plus === 'foyer') return viewFoyer();
  let h = ptitle('Plus', esc(S.meta.name || 'Notre maison'), syncBadge());
  h += `<div class="menu">
    ${[['repas','utensils','Repas','Le menu de la semaine','u-shop'],['souvenirs','heart','Souvenirs','Photos et moments importants','u-mem'],['foyer','users','Foyer et famille','Membres, invitation, notifications','u-home']]
      .map(([v,ic,t,s,u]) => `<button class="lrow ${u}" data-act="plusGo" data-v="${v}"><span class="bubble">${icon(ic,20)}</span><span class="body"><span class="t">${t}</span><span class="s">${s}</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>`;
  h += installCard(false);
  return h;
};

function viewFoyer(){
  const ms = sorted(S.members);
  let h = backBtn('Plus') + ptitle('Foyer et famille', '', syncBadge());
  h += `<div class="card"><label class="f" for="f-home">Nom du foyer<input type="text" id="f-home" data-ch="homeName" value="${esc(S.meta.name||'')}" placeholder="Notre maison"></label></div>`;
  h += `<div class="card"><h3>Sur ce téléphone, je suis…</h3><div class="chips">${ms.map(m=>`<button class="chip" data-act="me" data-id="${m.id}" aria-pressed="${S.me===m.id}">${avatar(m.id)}${esc(m.name)}</button>`).join('')}</div>
    <span class="muted small">Sert au filtre « Mes tâches », aux rappels et à noter qui a fait quoi. Chaque téléphone choisit le sien.</span></div>`;
  h += pushCard();
  h += `<div class="card"><h3>Membres</h3>${ms.map(m=>`<div class="mrow">
      <button class="av lg" style="background:${memberColor(m)};border:0" data-act="color" data-id="${m.id}" aria-label="Changer la couleur de ${esc(m.name)}">${esc((m.name||'?').charAt(0).toUpperCase())}</button>
      <input type="text" id="m-${m.id}" data-ch="memberName" data-id="${m.id}" value="${esc(m.name)}" aria-label="Prénom">
      <button class="btn danger sm ${S.armed==='m'+m.id?'armed':''}" data-act="delMember" data-id="${m.id}">${S.armed==='m'+m.id?'Confirmer':'Retirer'}</button></div>`).join('')}
    <span class="muted small">Touche une pastille pour changer sa couleur. Les enfants n’ont pas besoin de compte.</span>
    <button class="btn soft" data-act="addMemberSheet">${icon('user-plus',18)}Ajouter un membre</button></div>`;
  h += `<div class="card"><h3>Inviter la famille</h3>
    <span class="small">Envoie ce lien à chaque membre. En l’ouvrant, il rejoint directement le foyer et voit tout en direct.</span>
    <div class="code num" aria-label="Code d’invitation">${esc(S.hh.invite_code)}</div>
    <input type="text" id="inv-link" readonly value="${esc(inviteLink())}" aria-label="Lien d’invitation">
    <button class="btn primary" data-act="share">${icon('share-2',18)}Envoyer l’invitation</button></div>`;
  h += `<div class="card"><h3>Repartir de zéro</h3><span class="muted small">Remplace toutes les pièces et tâches par le modèle « Entretien maison standard ». Membres, courses, planning et souvenirs sont conservés.</span>
    <button class="btn danger ${S.armed==='reset'?'armed':''}" data-act="reset">${S.armed==='reset'?'Confirmer : tout remplacer':'Recharger le modèle'}</button></div>`;
  h += `<div class="card"><h3>Ce téléphone</h3><span class="muted small">Si tu changes de téléphone ou effaces les données du navigateur, rejoins simplement le foyer avec le code ci-dessus.</span>
    <button class="btn danger ${S.armed==='leave'?'armed':''}" data-act="leave">${S.armed==='leave'?'Confirmer : quitter ce foyer':'Quitter ce foyer sur ce téléphone'}</button></div>`;
  return h;
}

/* ---------- Bienvenue ---------- */
VIEWS.welcome = () => {
  const names = S.welcome || (S.welcome = ['','']);
  let h = `<div class="brand"><span class="wordmark"><span class="name" style="font-size:44px">Co<b>Tribu</b></span><span class="tagline" style="font-size:24px">Le quotidien se partage</span></span>
    <span class="muted" style="margin-top:10px">Tâches, courses, planning et souvenirs : toute la famille sur la même page.</span></div>`;
  h += seg('wMode', S.welcomeMode, [['create','Créer un foyer'],['join','Rejoindre un foyer']], 'u-home');
  if (S.welcomeMode === 'join') {
    h += `<div class="card"><h3>Code d’invitation</h3><span class="muted small">Demande-le à la personne qui a créé le foyer (Plus → Foyer).</span>
      <input type="text" id="j-code" class="codein num" data-ch="jCode" value="${esc(S.joinCode)}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234">
      <button class="btn deep" data-act="join" ${S.busy?'disabled':''}>${S.busy?'Connexion…':'Rejoindre'}</button></div>`;
  } else {
    h += `<div class="card"><label class="f" for="w-home">Nom du foyer<input type="text" id="w-home" data-ch="wHome" value="${esc(S.wHome||'')}" placeholder="Famille Martin"></label></div>
    <div class="card"><h3>Qui vit ici ?</h3>${names.map((n,i)=>`<input type="text" id="w-m${i}" data-ch="wName" data-i="${i}" value="${esc(n)}" placeholder="${i===0?'Ton prénom':'Prénom '+(i+1)}">`).join('')}
      <span class="muted small">Les enfants aussi, même sans téléphone.</span>
      <button class="btn soft" data-act="wAdd">${icon('plus',18)}Ajouter quelqu’un</button></div>
    <div class="card"><h3>Modèle « Entretien maison standard »</h3>
      <span class="small muted">Lundi courses et frigo · mardi cuisine · mercredi chambre enfant · jeudi chambre parents · vendredi salle de bain et WC · dimanche salon. Tout se modifie ensuite.</span>
      <button class="btn deep" data-act="wGo" ${S.busy?'disabled':''}>${S.busy?'Création…':'Créer le foyer'}</button></div>`;
  }
  return h;
};

Object.assign(H, {
  quickAdd: () => openSheet('quick'),
  newMealQ: () => { S.draft = {id:null, name:'', date: localToday(), slot: new Date().getHours() < 14 ? 'midi' : 'soir', ingrText:''}; S.sheet = 'meal'; renderSheet(); },
  goPlanWeek: () => { S.tab = 'planning'; S.sub.planning = 'semaine'; S.planDay = localToday(); render(); window.scrollTo(0,0); },
  goPlanDay: () => { S.tab = 'planning'; S.sub.planning = 'jour'; S.planDay = localToday(); render(); window.scrollTo(0,0); },
  goRepas: () => { closeSheet(true); S.tab = 'plus'; goSub(() => { S.sub.plus = 'repas'; }); },
  goSouvenirs: () => { S.tab = 'plus'; goSub(() => { S.sub.plus = 'souvenirs'; }); },
  goAddItem: () => { if (S.sheet) closeSheet(); S.tab = 'courses'; S.sub.courses = 'liste'; S.aisleOpen = null; render(); window.scrollTo(0,0); setTimeout(() => { const i = document.getElementById('c-new'); if (i) i.focus(); }, 60); },
  plusGo: el => goSub(() => { S.sub.plus = el.dataset.v; }),
  wMode: el => { S.welcomeMode = el.dataset.v; render(); },
  wAdd: () => { S.welcome.push(''); render(); },
  wGo: () => createHousehold(),
  join: () => joinHousehold(),
  leave: () => { if (S.armed !== 'leave') { S.armed = 'leave'; render(); return; } S.armed = null; leaveHousehold(); },
  color: el => { const m = clone(S.members.get(el.dataset.id)); m.color = ((m.color||0)+1) % COLORS.length; put('members', m); render(); },
  delMember: el => { const k = 'm'+el.dataset.id; if (S.armed !== k) { S.armed = k; render(); return; } S.armed = null; del('members', el.dataset.id); if (S.me === el.dataset.id) { S.me = null; } render(); },
  reset: async () => {
    if (S.armed !== 'reset') { S.armed = 'reset'; render(); return; }
    S.armed = null;
    const names = sorted(S.members);
    const tpl = buildTemplate(names.length ? names.map(m=>m.name) : ['Moi'], localToday());
    const map = {}; tpl.members.forEach((m,i)=>{ map[m.id] = names[i] ? names[i].id : m.id; });
    tpl.tasks.forEach(t=>{ t.assign.members = t.assign.members.map(id=>map[id]); });
    const {error} = await sb.from('docs').delete().eq('household_id', S.hh.id).in('col', ['rooms','tasks']);
    if (error) { toast(explain(error)); return; }
    S.rooms = new Map(); S.tasks = new Map();
    if (!names.length) await putMany('members', tpl.members);
    await putMany('rooms', tpl.rooms); await putMany('tasks', tpl.tasks);
    render(); toast('Modèle rechargé');
  },
});
Object.assign(CH, {
  homeName: el => putMeta({...S.meta, name: el.value.trim() || 'Notre maison'}),
  memberName: el => { const m = clone(S.members.get(el.dataset.id)); const v = el.value.trim(); if (!v || v === m.name) return; m.name = v; put('members', m); render(); },
  wHome: el => { S.wHome = el.value; },
  wName: el => { S.welcome[+el.dataset.i] = el.value; },
  jCode: el => { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if (v !== el.value) el.value = v; S.joinCode = v; },
});
['wHome','wName','jCode'].forEach(k => LIVE.add(k));
