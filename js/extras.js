/* CoTribu — Repas de la semaine et Souvenirs */

/* ---------- Repas ---------- */
/* un repas peut être prévu à plusieurs moments : m.occ = [{date, slot}] (sinon m.date + m.slot) */
const SLOTS = [['matin','Matin'],['midi','Midi'],['soir','Soir']];
const slotRank = s => ({matin:0, midi:1, soir:2}[s] ?? 1);
function mealOcc(m){ return Array.isArray(m.occ) && m.occ.length ? m.occ : [{date: m.date, slot: m.slot || 'soir'}]; }
function mealsOn(ds){
  const out = [];
  for (const m of S.meals.values()) for (const o of mealOcc(m)) if (o.date === ds) out.push({...m, date: o.date, slot: o.slot});
  return out.sort((a,b) => slotRank(a.slot) - slotRank(b.slot));
}
const shortDay = ds => cap(fmt(ds,{weekday:'short'}).replace('.',''));
function occLabel(m){ const o = mealOcc(m); return o.length > 1 ? o.slice().sort((a,b) => a.date.localeCompare(b.date) || slotRank(a.slot) - slotRank(b.slot)).map(x => `${shortDay(x.date)} ${x.slot}`).join(' · ') : ''; }
function parseIngredients(text){
  return String(text||'').split(/\n|;/).map(l => l.replace(/^[-•*]\s*/,'').trim()).filter(Boolean).map(l => { const p = parseItem(l); return {name:p.name, qty:p.qty, aisle:guessAisle(p.name)}; });
}
function VIEWS_REPAS(){
  const today = localToday();
  const mon = S.mealWeek || mondayOf(today);
  let h = `${backBtn('Plus')}` + ptitle('Repas', 'Le menu de la semaine, et les courses qui vont avec.');
  h += `<div class="dayhead"><button class="navb" data-act="shiftMealWeek" data-v="-7" aria-label="Semaine précédente">${icon('chevron-left',20)}</button><h2>Semaine du ${esc(fmt(mon,{day:'numeric',month:'long'}))}</h2><button class="navb" data-act="shiftMealWeek" data-v="7" aria-label="Semaine suivante">${icon('chevron-right',20)}</button></div>`;
  for (let i=0;i<7;i++){
    const ds = addDays(mon,i);
    const ms = mealsOn(ds);
    h += `<div class="card u-shop" style="gap:4px${ds===today?';border:2px solid var(--shop)':''}"><div class="row"><h3 style="flex:1">${esc(cap(fmt(ds,{weekday:'long',day:'numeric'})))}</h3>${ds===today?'<span class="pill" style="background:var(--shop-soft);color:var(--shop-text)">Aujourd’hui</span>':''}</div>
      ${['matin','midi','soir'].filter(slot => slot !== 'matin' || ms.some(x => x.slot === 'matin')).map(slot => { const m = ms.find(x => x.slot === slot);
        return `<div class="meal"><span class="slot">${slot}</span>${m ? `${(m.steps||[]).length ? `<button class="iconbtn cookmini" data-act="cook" data-id="${m.id}" aria-label="Cuisiner ${esc(m.name)}">${icon('chef-hat',18)}</button>` : ''}<button class="body" style="border:0;background:none;text-align:left;padding:0;color:inherit" data-act="editMeal" data-id="${m.id}"><div class="t">${esc(m.name)}</div><div class="s">${(m.ingredients||[]).length ? (m.ingredients.length+' ingrédients') : 'Pas d’ingrédients notés'}${mealOcc(m).length > 1 ? ` · ${mealOcc(m).length} repas` : ''}</div></button>`
          : `<button class="add" data-act="newMeal" data-date="${ds}" data-slot="${slot}">+ Ajouter</button>`}</div>`; }).join('')}</div>`;
  }
  h += `<button class="btn upri block u-shop" data-act="menuOpen">${icon('sparkles',20)}Proposer des menus avec l’IA</button>`;
  h += `<button class="btn deep block" data-act="goRecipes">${icon('shopping-cart',20)}Voir les ingrédients à acheter</button>`;
  return h;
};
SHEETS.meal = () => {
  const d = S.draft;
  return `<h2>${d.id ? 'Modifier le repas' : 'Nouveau repas'}</h2>
    <label class="f" for="me-name">Plat<input type="text" id="me-name" data-ch="meName" value="${esc(d.name)}" placeholder="Ex. Salade de pâtes"></label>
    ${d.id || (d.stepsText||'').trim() ? `<button class="btn upri u-shop cookbtn" data-act="cookFromDraft">${icon('chef-hat',20)}<span><b>Cuisiner ce plat</b><small>Les étapes en grand, une par une, avec minuteurs</small></span></button>` : ''}
    <div class="sect"><span class="eyebrow">Quand</span>
      <div class="chips u-shop">${SLOTS.map(([k,l]) => `<button class="chip" data-act="meSlotTog" data-v="${k}" aria-pressed="${d.slots.includes(k)}">${l}</button>`).join('')}</div>
      <div class="daychips">${d.week.map(ds => `<button class="daychip" data-act="meDayTog" data-v="${ds}" aria-pressed="${d.days.includes(ds)}"><small>${esc(shortDay(ds))}</small><b>${ymd(ds)[2]}</b></button>`).join('')}</div>
      <div class="row" style="justify-content:space-between"><button class="linkbtn small" data-act="meWeek" data-v="-7">‹ Sem. préc.</button><span class="muted small">${d.days.length * d.slots.length > 1 ? `${d.days.length * d.slots.length} repas` : ''}</span><button class="linkbtn small" data-act="meWeek" data-v="7">Sem. suiv. ›</button></div>
      ${d.days.length * d.slots.length > 1 ? `<span class="muted small">Les ingrédients ne sont comptés qu’une fois pour les courses : pense à ajuster les quantités si tu cuisines plusieurs fois.</span>` : ''}</div>
    <label class="f" for="me-ingr">Ingrédients (un par ligne)<textarea id="me-ingr" data-ch="meIngr" rows="6" placeholder="500 g pâtes&#10;6 tomates&#10;1 mozzarella">${esc(d.ingrText)}</textarea></label>
    <label class="f" for="me-steps">Étapes de la recette (une par ligne, facultatif)<textarea id="me-steps" data-ch="meSteps" rows="5" placeholder="Faire cuire les pâtes 10 min&#10;Couper les tomates…">${esc(d.stepsText||'')}</textarea></label>
    ${d.url ? `<a class="linkbtn small" href="${esc(d.url)}" target="_blank" rel="noopener">${icon('book-open',14)} Voir la recette d’origine</a>` : ''}

    <div class="actions"><button class="btn primary" data-act="saveMeal">Enregistrer</button><button class="btn soft" data-act="close">Annuler</button></div>
    <button class="btn upri u-shop" data-act="saveMealShop">${icon('shopping-cart',18)}Enregistrer et ajouter aux courses</button>
    ${d.id ? `<button class="btn danger ${S.armed==='meal'?'armed':''}" data-act="delMeal">${S.armed==='meal'?'Confirmer la suppression':'Supprimer ce repas'}</button>` : ''}`;
};
function mealDraft(m, date, slot){
  if (m) {
    const o = mealOcc(m), days = [...new Set(o.map(x => x.date))], slots = [...new Set(o.map(x => x.slot))];
    const mon = mondayOf(days.slice().sort()[0]);
    return {...clone(m), days, slots, week: [0,1,2,3,4,5,6].map(i => addDays(mon, i)), ingrText:(m.ingredients||[]).map(g => (g.qty?g.qty+' ':'')+g.name).join('\n'), stepsText:(m.steps||[]).join('\n')};
  }
  const ds = date || localToday(), mon = mondayOf(ds);
  return {id:null, name:'', days:[ds], slots:[slot || 'soir'], week: [0,1,2,3,4,5,6].map(i => addDays(mon, i)), ingrText:''};
}
function saveMealDraft(){
  const d = S.draft; const name = (d.name||'').trim();
  if (!name) { toast('Écris le nom du plat.'); return null; }
  if (!d.days.length) { toast('Choisis au moins un jour.'); return null; }
  if (!d.slots.length) { toast('Choisis matin, midi ou soir.'); return null; }
  const occ = []; d.days.slice().sort().forEach(ds => d.slots.slice().sort((a,b) => slotRank(a) - slotRank(b)).forEach(s => occ.push({date: ds, slot: s})));
  const steps = String(d.stepsText||'').split('\n').map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean).slice(0, 40);
  const m = {id: d.id || uid('r'), name, date: occ[0].date, slot: occ[0].slot, occ, ingredients: parseIngredients(d.ingrText), steps, url: d.url || '', image: d.image || '', time: d.time || 0, servings: d.servings || '', by:S.me||null};
  put('meals', m); if (!d.id) { if (typeof thinkCredit === 'function') thinkCredit('meals'); } return m;
}
Object.assign(H, {
  shiftMealWeek: el => { S.mealWeek = addDays(S.mealWeek || mondayOf(localToday()), +el.dataset.v); render(); },
  newMeal: el => { S.draft = mealDraft(null, el.dataset.date, el.dataset.slot); openSheet('meal'); },
  editMeal: el => { const m = S.meals.get(el.dataset.id); if (!m) return; S.draft = mealDraft(m); openSheet('meal'); },
  meSlotTog: el => { const d = S.draft, v = el.dataset.v; d.slots = d.slots.includes(v) ? d.slots.filter(x => x !== v) : [...d.slots, v]; renderSheet(); },
  meDayTog: el => { const d = S.draft, v = el.dataset.v; d.days = d.days.includes(v) ? d.days.filter(x => x !== v) : [...d.days, v]; renderSheet(); },
  meWeek: el => { const d = S.draft; d.week = d.week.map(x => addDays(x, +el.dataset.v)); renderSheet(); },
  saveMeal: () => { if (saveMealDraft()) { closeSheet(); render(); toast('Repas enregistré'); } },
  saveMealShop: () => { const m = saveMealDraft(); if (!m) return; let n = 0; m.ingredients.forEach(g => { if (addIngredient(g)) n++; }); closeSheet(); render(); toast(n ? `Repas enregistré, ${n} ingrédients ajoutés aux courses` : 'Repas enregistré'); },
  delMeal: () => { if (S.armed !== 'meal') { S.armed = 'meal'; renderSheet(); return; } del('meals', S.draft.id); closeSheet(); render(); },
  goRecipes: () => { S.tab = 'courses'; S.sub.courses = 'recettes'; S.sub.plus = null; render(); window.scrollTo(0,0); },
});
Object.assign(CH, {
  meName: el => { S.draft.name = el.value; }, meIngr: el => { S.draft.ingrText = el.value; }, meSteps: el => { S.draft.stepsText = el.value; },
});
['meName','meIngr','meSteps'].forEach(k => LIVE.add(k));

/* ---------- Souvenirs ---------- */
function photoImg(p, cls=''){ return `<img class="${cls}" data-path="${esc(p)}" ${photoUrl(p)?`src="${esc(photoUrl(p))}"`:''} alt="" loading="lazy">`; }
AFTER.push(() => {
  const imgs = [...document.querySelectorAll('img[data-path]')].filter(i => !i.getAttribute('src'));
  if (!imgs.length) return;
  photoUrls(imgs.map(i => i.dataset.path)).then(() => imgs.forEach(i => { const u = photoUrl(i.dataset.path); if (u) i.src = u; }));
});
function throwback(){
  const today = localToday(), md = today.slice(5), y = +today.slice(0,4);
  const list = [...S.memories.values()].filter(m => m.date && m.date.slice(0,4) < String(y));
  const exact = list.filter(m => m.date.slice(5) === md);
  if (exact.length) return exact.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const near = list.filter(m => { const d = idx(`${y}-${m.date.slice(5)}`) - idx(today); return d >= -3 && d <= 3; });
  return near[0] || null;
}
function agoLabel(m){ const n = +localToday().slice(0,4) - +m.date.slice(0,4); return n <= 0 ? '' : n === 1 ? 'Il y a 1 an' : `Il y a ${n} ans`; }
function memoCard(m){
  const p = (m.photos||[])[0];
  return `<button class="memo" data-act="openMemory" data-id="${m.id}"><span class="cover">${p ? photoImg(p) : icon('heart',40)}</span>
    <span class="row"><span style="flex:1;min-width:0"><strong style="display:block">${esc(m.title)}</strong><span class="muted small">${esc(fmt(m.date,{day:'numeric',month:'long',year:'numeric'}))}${(m.photos||[]).length?` · ${m.photos.length} photo${m.photos.length>1?'s':''}`:''}</span></span>${(m.members||[]).some(id=>S.members.has(id)) ? avatars(m.members.filter(id=>S.members.has(id))) : ''}</span></button>`;
}
function VIEWS_SOUVENIRS(){
  let h = `${backBtn('Plus')}` + ptitle('Souvenirs', 'L’histoire de la famille, au fil des jours.', `<button class="fab" style="background:var(--mem-text)" data-act="newMemory" aria-label="Ajouter un souvenir">${icon('plus',26)}</button>`);
  const tb = throwback();
  if (tb) h += `<div class="ucard u-mem"><span class="kicker">${esc(agoLabel(tb))}</span><button class="row" style="border:0;background:none;padding:0;text-align:left;color:inherit" data-act="openMemory" data-id="${tb.id}">${(tb.photos||[])[0]?`<span class="memthumb">${photoImg(tb.photos[0])}</span>`:''}<span><strong>${esc(tb.title)}</strong><br><span class="muted small">${esc(fmt(tb.date,{day:'numeric',month:'long',year:'numeric'}))}</span></span></button></div>`;
  if ([...S.memories.values()].some(m => (m.photos||[]).length)) h += `<button class="btn upri u-mem" data-act="slidesAll">${icon('play',18)}Diaporama des souvenirs</button>`;
  h += `<button class="btn soft u-mem" style="background:var(--mem-soft);color:var(--mem-text)" data-act="goAlbum">${icon('book-open',18)}Album de l’année (IA)</button>`;
  const f = S.memFilter || 'all';
  h += `<div class="chips u-mem"><button class="chip" data-act="memFilter" data-v="all" aria-pressed="${f==='all'}">Tout le monde</button>${sorted(S.members).map(m => `<button class="chip" data-act="memFilter" data-v="${m.id}" aria-pressed="${f===m.id}">${avatar(m.id)}${esc(m.name)}</button>`).join('')}</div>`;
  const list = [...S.memories.values()].filter(m => f === 'all' || (m.members||[]).includes(f)).sort((a,b) => b.date.localeCompare(a.date));
  if (!list.length) return h + `<div class="empty"><h3>Aucun souvenir pour l’instant</h3><span class="muted">Rentrée, anniversaire, vacances… Ajoute des photos et quelques mots : dans un an, CoTribu te les rappellera.</span><button class="btn upri u-mem" data-act="newMemory">${icon('camera',18)}Ajouter un souvenir</button></div>`;
  let year = '';
  list.forEach(m => { const y = m.date.slice(0,4); if (y !== year) { year = y; h += `<div class="year">${y}</div>`; } h += memoCard(m); });
  return h;
};
function draftMemory(m, pre={}){
  if (m) return {...clone(m), photos:[...(m.photos||[])], members:[...(m.members||[])], _new:[]};
  return {id:null, title:pre.title||'', date:pre.date||localToday(), text:'', members:pre.members?[...pre.members]:[], photos:[], eventId:pre.eventId||null, _new:[]};
}
SHEETS.memory = () => {
  const d = S.draft, ms = sorted(S.members);
  return `<h2>${d.id ? 'Modifier le souvenir' : 'Nouveau souvenir'}</h2>
    <label class="f" for="mo-title">Titre<input type="text" id="mo-title" data-ch="moTitle" value="${esc(d.title)}" placeholder="Ex. Rentrée scolaire, Noël chez mamie"></label>
    <label class="f" for="mo-date">Date<input type="date" id="mo-date" data-ch="moDate" value="${esc(d.date)}"></label>
    <div class="sect"><span class="eyebrow">Photos</span>
      <div class="uploads">${d.photos.map((p,i) => `<span class="ph">${photoImg(p)}<button data-act="rmPhoto" data-i="${i}" aria-label="Retirer la photo">${icon('x',14)}</button></span>`).join('')}</div>
      <label class="btn soft filebtn u-mem" style="background:var(--mem-soft);color:var(--mem-text)">${icon('camera',18)}${S.uploading?'Envoi en cours…':'Ajouter des photos'}<input type="file" id="mo-files" accept="image/*" multiple data-ch="moFiles" ${S.uploading?'disabled':''}></label></div>
    <label class="f" for="mo-text">Quelques mots<textarea id="mo-text" data-ch="moText" placeholder="Ce qu’on veut se rappeler de ce jour-là">${esc(d.text||'')}</textarea></label>
    <div class="sect"><span class="eyebrow">Qui était là</span><div class="chips u-mem">${ms.map(m => `<button class="chip" data-act="moMember" data-id="${m.id}" aria-pressed="${d.members.includes(m.id)}">${avatar(m.id)}${esc(m.name)}</button>`).join('')}</div></div>
    <div class="actions"><button class="btn primary" data-act="saveMemory" ${S.uploading?'disabled':''}>Enregistrer</button><button class="btn soft" data-act="cancelMemory">Annuler</button></div>
    ${d.id ? `<button class="btn danger ${S.armed==='memory'?'armed':''}" data-act="delMemory">${S.armed==='memory'?'Confirmer : supprimer le souvenir et ses photos':'Supprimer ce souvenir'}</button>` : ''}`;
};
SHEETS.memoryView = () => {
  const m = S.memories.get(S.viewId); if (!m) return '';
  return `<div class="row"><div style="flex:1"><span class="kicker" style="color:var(--mem-text)">${esc(fmt(m.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</span><h2>${esc(m.title)}</h2></div><button class="iconbtn" data-act="editMemory" data-id="${m.id}" aria-label="Modifier">${icon('pencil',18)}</button></div>
    ${(m.photos||[]).length ? `<div class="photos">${m.photos.map(p => `<button class="ph" data-act="viewPhoto" data-path="${esc(p)}">${photoImg(p)}</button>`).join('')}</div>` : ''}
    ${(m.photos||[]).length > 1 ? `<button class="btn upri u-mem" data-act="slidesMemory" data-id="${m.id}">${icon('play',18)}Diaporama</button>` : ''}
    ${m.text ? `<p style="margin:0;white-space:pre-wrap">${esc(m.text)}</p>` : ''}
    ${(m.members||[]).length ? `<div class="row">${avatars(m.members.filter(id=>S.members.has(id)))}<span class="muted small">${esc(m.members.filter(id=>S.members.has(id)).map(nameOf).join(', '))}</span></div>` : ''}
    <button class="btn soft" data-act="close">Fermer</button>`;
};
Object.assign(H, {
  memFilter: el => { S.memFilter = el.dataset.v; render(); },
  newMemory: () => { S.draft = draftMemory(null); openSheet('memory'); },
  openMemory: el => { S.viewId = el.dataset.id; openSheet('memoryView'); setTimeout(afterRender, 0); },
  editMemory: el => { S.draft = draftMemory(S.memories.get(el.dataset.id)); S.sheet = 'memory'; S.armed = null; renderSheet(); afterRender(); },
  moMember: el => { const d = S.draft, id = el.dataset.id; d.members = d.members.includes(id) ? d.members.filter(x=>x!==id) : [...d.members, id]; renderSheet(); afterRender(); },
  rmPhoto: el => { const p = S.draft.photos.splice(+el.dataset.i, 1)[0]; (S.draft._rm = S.draft._rm || []).push(p); renderSheet(); afterRender(); },
  saveMemory: () => {
    const d = S.draft; const title = (d.title||'').trim();
    if (!title) { toast('Donne un titre au souvenir.'); return; }
    const m = {id: d.id || uid('s'), title, date: d.date || localToday(), text:(d.text||'').trim(), members:d.members, photos:d.photos, eventId:d.eventId||null, by:S.me||null};
    put('memories', m); if (!d.id) { if (typeof thinkCredit === 'function') thinkCredit('memories'); }
    if (d._rm && d._rm.length) removePhotos(d._rm).catch(()=>{});
    closeSheet(); render(); toast(d.id ? 'Souvenir modifié' : 'Souvenir ajouté');
  },
  cancelMemory: () => { const d = S.draft; if (d && d._new && d._new.length) removePhotos(d._new.filter(p => !(S.memories.get(d.id)||{photos:[]}).photos.includes(p))).catch(()=>{}); closeSheet(); },
  delMemory: () => { if (S.armed !== 'memory') { S.armed = 'memory'; renderSheet(); afterRender(); return; } const m = S.memories.get(S.draft.id); removePhotos([...(m.photos||[]), ...(S.draft._new||[])]).catch(()=>{}); del('memories', S.draft.id); closeSheet(); render(); toast('Souvenir supprimé'); },
  viewPhoto: el => { const u = photoUrl(el.dataset.path); if (!u) return; const v = document.createElement('div'); v.className = 'viewer'; v.innerHTML = `<img src="${esc(u)}" alt=""><button aria-label="Fermer">${icon('x',22)}</button>`; v.addEventListener('click', () => v.remove()); document.body.appendChild(v); },
});
Object.assign(CH, {
  moTitle: el => { S.draft.title = el.value; }, moDate: el => { S.draft.date = el.value; }, moText: el => { S.draft.text = el.value; },
  moFiles: async el => {
    const files = [...(el.files||[])].slice(0, 12); if (!files.length) return;
    S.uploading = true; renderSheet();
    let ok = 0;
    for (const f of files) {
      try { const p = await uploadPhoto(f); S.draft.photos.push(p); S.draft._new.push(p); ok++; }
      catch(e) { console.warn(e); toast(explain(e)); break; }
    }
    S.uploading = false; renderSheet(); afterRender();
    if (ok) toast(`${ok} photo${ok>1?'s':''} ajoutée${ok>1?'s':''}`);
  },
});
['moTitle','moText'].forEach(k => LIVE.add(k));
