/* CoTribu — Accueil (Aujourd'hui), Plus, Foyer, Bienvenue */

VIEWS.today = () => {
  const today = localToday();
  const tasks = todayItems(today, {mine:false});
  const list = tasks.filter(x => !x.st.late), late = tasks.filter(x => x.st.late);
  const done = list.filter(x=>x.st.done).length, total = list.length;
  let h = ptitle('Aujourd’hui', esc(cap(fmt(today,{weekday:'long', day:'numeric', month:'long', year:'numeric'}))),
    `<div class="row">${AI_ON ? `<button class="pillbtn" data-act="aiOpen" aria-label="Ajouter avec l’IA">${icon('sparkles',18)}IA</button>` : ''}<button class="pillbtn" data-act="goPlanWeek">${icon('calendar-days',18)}Semaine</button><button class="fab" data-act="quickAdd" aria-label="Ajouter">${icon('plus',26)}</button></div>`);
  if (!S.dismissed.hello && LS.get('cotribu-dismiss-hello') !== today) {
    const hr = new Date().getHours();
    const hello = hr < 12 ? 'Belle journée à toute la tribu !' : hr < 18 ? 'Bel après-midi à la tribu !' : 'Bonne soirée à la tribu !';
    const line = done ? `${done} ${done>1?'tâches terminées':'tâche terminée'} aujourd’hui` : total ? `${total} ${total>1?'tâches':'tâche'} au programme` : 'Rien d’urgent aujourd’hui';
    h += `<div class="banner"><span class="sun">${icon('sun',24)}</span><div><h3>${hello}</h3><span class="muted small">${line}</span></div><button class="x" data-act="dismiss" data-v="hello" aria-label="Masquer">${icon('x',18)}</button></div>`;
  }
  h += whoAmICard() + firstStepsCard() + (typeof newsCard === 'function' ? newsCard() : '') + installCard(true);
  h += (typeof thanksCard === 'function' ? thanksCard() : '') + (typeof rateCard === 'function' ? rateCard() : '') + pauseCard('today') + throwbackHero() + countdownCard();
  h += meteoCard();
  const pk = prevMonthKey();
  if (+today.slice(8) <= 5 && LS.get('cotribu-dismiss-bilan') !== pk && sorted(S.members).some(m => !m.kid && thinkTotal(m, pk) > 0))
    h += `<div class="ucard u-lav"><div class="row"><span class="bubble sm">${icon('brain',16)}</span><h3 style="flex:1">Le bilan de ${esc(MON[+pk.slice(5)-1])}</h3><button class="x" style="border:0;background:none;color:var(--muted)" data-act="dismissBilan" data-v="${pk}" aria-label="Masquer">${icon('x',18)}</button></div>
      <span class="small">${esc(chargeInsight(pk))}</span><button class="btn upri sm" data-act="goCharge" data-v="${pk}">Voir qui pense à quoi</button></div>`;
  const reqs = openRequests().slice(0,2);
  if (reqs.length) h += `<div class="ucard u-lav"><button class="chead" data-act="plusGo" data-v="proches"><span class="bubble sm">${icon('hand-heart',16)}</span><h3>Demandes aux proches</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>${reqs.map(r => `<div class="row" style="justify-content:space-between;gap:8px"><span><strong>${esc(r.title)}</strong><br><span class="muted small">${esc(reqWhen(r))}</span></span>${reqStatus(r)}</div>`).join('')}</div>`;

  // Tâches du jour
  const shown = [...late, ...list].slice(0, 6);
  h += `<div class="card u-home"><button class="chead" data-act="tab" data-v="maison"><span class="bubble soft">${icon('circle-check',20)}</span><h3>Tâches du jour</h3><span class="go">${icon('chevron-right',18)}</span><span class="spacer"></span>
      <span class="muted small num" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${done}/${total} terminées<span class="pbar" style="width:88px"><b style="width:${total?Math.round(done/total*100):0}%"></b></span></span></button>
    <div class="mini">${shown.map(x => taskRow(x, today, {noFreq:true})).join('') || '<span class="muted small">Rien de prévu aujourd’hui.</span>'}</div>
    ${tasks.length > shown.length ? `<button class="btn ghost sm" data-act="tab" data-v="maison">Voir les ${tasks.length} tâches</button>` : ''}
    <button class="addline" data-act="newTask">${icon('plus',20)}Ajouter une tâche</button></div>`;

  // Points de la semaine
  const champs = sorted(S.members).map(m => ({m, w: weekPts(m)})).filter(x => x.w > 0).sort((a,b) => b.w - a.w);
  if (champs.length) h += `<div class="ucard u-shop"><button class="chead" data-act="plusGo" data-v="points"><span class="bubble sm">${icon('star',16)}</span><h3>Points de la semaine</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
    <div class="chips">${champs.slice(0,4).map((x,i) => `<span class="chip" style="cursor:default">${avatar(x.m.id)}${esc(x.m.name)} <b class="num">${x.w}</b>${i===0?' ★':''}</span>`).join('')}</div></div>`;

  // Planning + Repas
  const evs = eventsOn(today);
  const meals = mealsOn(today);
  const hr = new Date().getHours();
  const nowSlot = hr < 10 ? 'matin' : hr < 14 ? 'midi' : 'soir';
  const meal = meals.find(m => m.slot === nowSlot) || meals.find(m => slotRank(m.slot) > slotRank(nowSlot)) || meals[meals.length - 1];
  h += `<div class="grid2">
    <div class="ucard u-plan"><button class="chead" data-act="goPlanDay"><span class="bubble sm">${icon('calendar',16)}</span><h3>Planning</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
      ${evs.length ? `<div class="dayline">${evs.slice(0,5).map(e => `<button class="it" style="border:0;background:none;padding:0;text-align:left;color:inherit" data-act="editEvent" data-id="${e.id}" data-day="${today}"><span class="hr"><i style="background:${catOf(e).c}"></i>${e.allDay||!e.start?'Jour':esc(hm(e.start))}</span><span>${esc(e.title)}</span></button>`).join('')}</div>` : '<span class="muted small">Aucun événement aujourd’hui.</span>'}
      <button class="addline" data-act="newEvent">${icon('plus',18)}Événement</button></div>
    <div class="ucard u-shop"><button class="chead" data-act="goRepas"><span class="bubble sm">${icon('utensils',16)}</span><h3>Repas</h3><span class="spacer"></span><span class="go">${icon('chevron-right',18)}</span></button>
      ${meal ? `<button class="row" style="border:0;background:none;padding:0;text-align:left;color:inherit" data-act="editMeal" data-id="${meal.id}"><span class="mealpic" style="width:56px;height:56px;overflow:hidden">${mealRecipe(meal) ? recipeImg(mealRecipe(meal)) : icon('soup',26)}</span><span><span class="kicker">${({matin:'Ce matin', midi:'Ce midi', soir:'Ce soir'})[meal.slot] || 'Aujourd’hui'}</span><br><strong>${esc(meal.name)}</strong></span></button>` : '<span class="muted small">Rien de prévu pour ce soir.</span>'}
      <button class="addline" data-act="newMeal" data-date="${today}" data-slot="${hr<14?'midi':'soir'}">${icon('plus',18)}Repas</button></div>
  </div>`;

  // Courses + Souvenirs
  const toBuy = activeItems().filter(i => !i.done);
  const tb = throwbackHero() ? null : throwback();
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
  ${[...(AI_ON ? [['aiOpen','sparkles','Écrire ou dicter (IA)','u-warm']] : []),['newTask','circle-check','Une tâche','u-home'],['newEvent','calendar','Un événement','u-plan'],['goAddItem','shopping-cart','Un article de courses','u-shop'],['newMealQ','utensils','Un repas','u-shop'],['newMemory','heart','Un souvenir','u-mem'],['newRequest','hand-heart','Une demande à un proche','u-lav']]
    .map(([a,ic,l,u]) => `<button class="lrow ${u}" data-act="${a}"><span class="bubble sm">${icon(ic,16)}</span><span class="body"><span class="t">${l}</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>
  <button class="btn soft" data-act="close">Fermer</button>`;

/* ---------- Plus ---------- */
VIEWS.plus = () => {
  if (S.sub.plus === 'repas') return VIEWS_REPAS();
  if (S.sub.plus === 'souvenirs') return VIEWS_SOUVENIRS();
  if (S.sub.plus === 'foyer') return viewFoyer();
  if (S.sub.plus === 'proches') return viewProches();
  if (S.sub.plus === 'premium') return viewPremium();
  if (S.sub.plus === 'album') return viewAlbum();
  if (S.sub.plus === 'points') return viewPoints();
  if (S.sub.plus === 'charge') return viewCharge();
  let h = ptitle('Plus', esc(S.meta.name || 'Notre maison'), syncBadge());
  h += `<div class="menu">
    ${[['premium','crown','CoTribu Premium', isPremium() ? premiumUntilLabel() : 'L’IA qui fait le travail à votre place','u-warm'],['charge','brain','Charge mentale','Qui pense à quoi, qui le fait','u-lav'],['points','star','Points et récompenses','Les tâches faites rapportent des points','u-shop'],['repas','utensils','Repas & recettes','Le menu de la semaine et le carnet de recettes','u-shop'],['souvenirs','heart','Souvenirs','Photos et moments importants','u-mem'],['proches','hand-heart','Proches','Grands-parents, nounou : demandes de garde','u-lav'],['foyer','users','Foyer et famille','Membres, invitation, rappels','u-home']]
      .map(([v,ic,t,s,u]) => `<button class="lrow ${u}" data-act="plusGo" data-v="${v}"><span class="bubble">${icon(ic,20)}</span><span class="body"><span class="t">${t}</span><span class="s">${s}</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>`;
  h += `<div class="menu"><button class="lrow" data-act="guideOpen"><span class="bubble soft" style="--u-soft:var(--home-soft);--u-text:var(--home-text)">${icon('book-open',18)}</span><span class="body"><span class="t">Guide de démarrage</span><span class="s">Revoir comment marche CoTribu</span></span>${icon('chevron-right',18)}</button>
    <button class="lrow" data-act="feedbackOpen"><span class="bubble soft" style="--u-soft:var(--lav-soft);--u-text:var(--lav-text)">${icon('send',18)}</span><span class="body"><span class="t">Une idée ? Un souci ?</span><span class="s">Dis-nous ce qui t’aiderait ou ce qui coince</span></span>${icon('chevron-right',18)}</button>
    <button class="lrow" data-act="rateMenu"><span class="bubble soft" style="--u-soft:var(--warm-soft);--u-text:var(--warm-text)">${icon(typeof storeUrl === 'function' && storeUrl() ? 'star' : 'share-2',18)}</span><span class="body"><span class="t">${typeof storeUrl === 'function' && storeUrl() ? 'Noter CoTribu' : 'Recommander CoTribu'}</span><span class="s">${typeof storeUrl === 'function' && storeUrl() ? 'Une note aide d’autres familles à nous trouver' : 'Parle de CoTribu à une famille autour de toi'}</span></span>${icon('chevron-right',18)}</button></div>`;
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
  // lien Google Agenda retiré (doublon avec les notifications) ; icsCard() reste disponible dans premium.js si besoin
  h += `<div class="card"><h3>Membres</h3>${ms.map(m=>`<div class="mrow">
      <button style="border:0;background:none;padding:0" data-act="editMember" data-id="${m.id}" aria-label="Photo et couleur de ${esc(m.name)}">${avatar(m.id,'lg')}</button>
      <input type="text" id="m-${m.id}" data-ch="memberName" data-id="${m.id}" value="${esc(m.name)}" aria-label="Prénom">
      <button class="btn danger sm ${S.armed==='m'+m.id?'armed':''}" data-act="delMember" data-id="${m.id}">${S.armed==='m'+m.id?'Confirmer':'Retirer'}</button></div>`).join('')}
    <span class="muted small">Touche une pastille pour ajouter une photo ou changer la couleur. Les enfants n’ont pas besoin de compte.</span>
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
  if (S.welcomeMode === 'proche') {
    return h + `<div class="card u-lav"><div class="row"><span class="bubble">${icon('hand-heart',18)}</span><h3>Rejoindre le cercle d’une famille</h3></div>
      <span class="small">Tu pourras recevoir leurs demandes (garde des enfants, coups de main) et y répondre en un geste. Tu ne verras que ce qu’ils partagent avec toi.</span>
      <label class="f" for="p-name">Ton prénom, ou comment la famille t’appelle<input type="text" id="p-name" data-ch="pName" value="${esc(S.procheName||'')}" placeholder="Ex. Mamie, Nounou Sarah"></label>
      <label class="f" for="p-code">Code<input type="text" id="p-code" class="codein num" data-ch="pCode" value="${esc(S.procheCode||'')}" maxlength="6" autocomplete="off" autocapitalize="characters"></label>
      <button class="btn upri" data-act="pJoin" ${S.busy?'disabled':''}>${S.busy?'Connexion…':'Rejoindre'}</button></div>
      <button class="btn ghost" data-act="wMode" data-v="create">Je veux plutôt créer ma propre famille</button>`;
  }
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
      ${AI_ON ? `<label class="f" for="w-desc">Ou décris ta maison, l’IA prépare tout (facultatif)<textarea id="w-desc" data-ch="wDesc" placeholder="Ex. maison avec jardin, 2 enfants de 6 et 10 ans, un chien, on travaille tous les deux">${esc(S.wDesc||'')}</textarea></label>` : ''}
      <button class="btn deep" data-act="wGo" ${S.busy?'disabled':''}>${S.busy?'Création…':'Créer le foyer'}</button></div>`;
  }
  return h;
};

Object.assign(H, {
  quickAdd: () => openSheet('quick'),
  newMealQ: () => { S.draft = mealDraft(null, localToday(), new Date().getHours() < 14 ? 'midi' : 'soir'); S.sheet = 'meal'; renderSheet(); },
  goPlanWeek: () => { S.tab = 'planning'; S.sub.planning = 'semaine'; S.planDay = localToday(); render(); window.scrollTo(0,0); },
  goPlanDay: () => { S.tab = 'planning'; S.sub.planning = 'jour'; S.planDay = localToday(); render(); window.scrollTo(0,0); },
  goRepas: () => { closeSheet(true); S.tab = 'plus'; S.repasTab = 'menu'; S.recipeOpen = null; S.menuDay = localToday(); goSub(() => { S.sub.plus = 'repas'; }); },
  goSouvenirs: () => { S.tab = 'plus'; goSub(() => { S.sub.plus = 'souvenirs'; }); },
  goAddItem: () => { if (S.sheet) closeSheet(); S.tab = 'courses'; S.sub.courses = 'liste'; S.aisleOpen = null; render(); window.scrollTo(0,0); setTimeout(() => { const i = document.getElementById('c-new'); if (i) i.focus(); }, 60); },
  goCharge: el => { S.chargeMonth = el.dataset.v; S.tab = 'plus'; goSub(() => { S.sub.plus = 'charge'; }); },
  dismissBilan: el => { LS.set('cotribu-dismiss-bilan', el.dataset.v); render(); },
  plusGo: el => { if (S.tab !== 'plus') S.tab = 'plus'; goSub(() => { S.sub.plus = el.dataset.v; }); if (el.dataset.v === 'premium') loadAiUsage(); },
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
  wDesc: el => { S.wDesc = el.value; },
  wName: el => { S.welcome[+el.dataset.i] = el.value; },
  jCode: el => { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g,''); if (v !== el.value) el.value = v; S.joinCode = v; },
});
['wHome','wName','jCode','wDesc'].forEach(k => LIVE.add(k));
