/* CoTribu — Repas & Recettes
   Recettes = le carnet familial · Repas = ce qu'on prévoit de manger · Courses = ce qu'on doit acheter.
   Parcours : Recette → Menu de la semaine → Courses (les ingrédients se rangent tout seuls par rayon). */

const RCATS = [['plat','Plats'],['entree','Entrées'],['dessert','Desserts'],['aperitif','Apéritifs'],['petitdej','Petit-déj'],['autre','Autres']];
const DIFFS = [['facile','Facile'],['moyen','Moyen'],['difficile','Difficile']];
const catLabel = c => (RCATS.find(x => x[0] === c) || [0,''])[1];

/* ---------- outils ---------- */
function recipeImg(r, cls=''){
  if (r && r.photo) return photoImg(r.photo, cls);
  if (r && r.image) return `<img class="${cls}" src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  return `<span class="rph ${cls}">${icon('chef-hat', 30)}</span>`;
}
const recipeImgUrl = r => (r && r.photo && photoUrl(r.photo)) || (r && r.image) || '';
const mealRecipe = m => m && m.recipeId ? S.recipes.get(m.recipeId) || null : null;
const mealIngredients = m => { const r = mealRecipe(m); return r ? (r.ingredients || []) : (m && m.ingredients || []); };
function recipeMeta(r){
  return [r.time ? `${icon('clock',13)}${r.time} min` : '', r.servings ? `${icon('users',13)}${r.servings} pers.` : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');
}
function recipesSorted(q, f){
  const nq = norm(q || '');
  return [...S.recipes.values()].filter(r => {
    if (nq && !norm(r.name).includes(nq) && !(r.ingredients||[]).some(g => norm(g.name).includes(nq))) return false;
    if (f === 'fav') return !!r.fav;
    if (f === 'rapide') return r.time && r.time <= 30;
    if (f && f !== 'all') return r.cat === f;
    return true;
  }).sort((a,b) => (b.fav|0) - (a.fav|0) || String(a.name).localeCompare(String(b.name)));
}
function lastPlanned(rid){ let d = ''; for (const m of S.meals.values()) if (m.recipeId === rid) for (const o of mealOcc(m)) if (o.date > d) d = o.date; return d; }
function toShoppingList(ingredients, skip){
  let n = 0;
  ingredients.forEach((g, i) => { if (skip && skip.has(i)) return; if (addIngredient(g)) n++; });
  return n;
}
function cookRecipe(r){ startCook({...r, image: recipeImgUrl(r), servings: r.servings ? `${r.servings} personnes` : ''}); }

/* ---------- page Repas & recettes ---------- */
function VIEWS_REPAS(){
  if (S.recipeOpen && S.recipes.has(S.recipeOpen)) return recipeDetail(S.recipes.get(S.recipeOpen));
  const tab = S.repasTab || 'menu';
  let h = backBtn('Plus') + ptitle('Repas & recettes', 'On planifie, on cuisine, on se régale !');
  h += seg('repasTab', tab, [['menu','Menu de la semaine'],['recettes','Mes recettes']], 'u-shop');
  return h + (tab === 'recettes' ? recipesView() : menuView());
}

/* Menu de la semaine */
function menuView(){
  const today = localToday(), day = S.menuDay || today, mon = mondayOf(day);
  let h = `<div class="wstrip u-shop">${[0,1,2,3,4,5,6].map(i => { const ds = addDays(mon,i), n = mealsOn(ds).length;
    return `<button class="wday ${ds===today?'today':''}" data-act="menuPick" data-v="${ds}" aria-pressed="${ds===day}"><small>${esc(cap(fmt(ds,{weekday:'short'}).replace('.','')))}</small><b>${ymd(ds)[2]}</b><span class="dots">${n ? '<i style="background:var(--shop)"></i>' : ''}</span></button>`; }).join('')}</div>`;
  h += `<div class="dayhead"><button class="navb" data-act="menuShift" data-v="-1" aria-label="Jour précédent">${icon('chevron-left',20)}</button><h2>${esc(cap(fmt(day,{weekday:'long', day:'numeric', month:'long'})))}</h2><button class="navb" data-act="menuShift" data-v="1" aria-label="Jour suivant">${icon('chevron-right',20)}</button></div>`;
  const ms = mealsOn(day);
  h += ms.length ? `<div class="mcards">${ms.map(m => { const r = mealRecipe(m), ingr = mealIngredients(m);
      const sub = r ? [r.servings ? `${r.servings} personnes` : '', r.time ? `${r.time} min` : ''].filter(Boolean).join(' · ') : (ingr.length ? `${ingr.length} ingrédients` : 'Repas libre');
      return `<div class="mcard"><button class="mthumb" data-act="${r ? 'recipeOpen' : 'mealMenu'}" data-id="${r ? r.id : m.id}" data-day="${day}" data-slot="${m.slot}">${r ? recipeImg(r) : `<span class="rph">${icon('utensils',26)}</span>`}</button>
        <button class="mbody" data-act="mealMenu" data-id="${m.id}" data-day="${day}" data-slot="${m.slot}"><span class="kicker">${esc(cap(m.slot))}</span><strong>${esc(m.name)}</strong><span class="muted small">${esc(sub)}${mealOcc(m).length > 1 ? ` · ${mealOcc(m).length} repas` : ''}</span></button>
        <button class="iconbtn" data-act="mealMenu" data-id="${m.id}" data-day="${day}" data-slot="${m.slot}" aria-label="Options">${icon('ellipsis',20)}</button></div>`; }).join('')}</div>`
    : `<div class="empty" style="padding:18px"><span class="muted">Rien de prévu ce jour-là.</span></div>`;
  h += `<button class="btn upri block u-shop" data-act="mealAdd">${icon('plus',20)}Ajouter un repas</button>`;
  const ideas = [...S.recipes.values()].sort((a,b) => (b.fav|0) - (a.fav|0) || lastPlanned(a.id).localeCompare(lastPlanned(b.id))).slice(0, 8);
  if (ideas.length) h += `<div class="row" style="justify-content:space-between;margin-top:6px"><h3>Idées pour cette semaine</h3><button class="linkbtn small" data-act="repasTab" data-v="recettes">Voir tout</button></div>
    <div class="hscroll">${ideas.map(r => `<button class="icard" data-act="menuAddRecipe" data-id="${r.id}">${recipeImg(r)}<span class="row" style="gap:4px"><b>${esc(r.name)}</b>${r.fav ? icon('heart',14,'class="favic"') : ''}</span><span class="rmeta">${recipeMeta(r)}</span></button>`).join('')}</div>`;
  else h += `<div class="ucard u-shop"><span class="small">Enregistre tes plats préférés dans <b>Mes recettes</b> : tu pourras les programmer ici en un geste, et envoyer leurs ingrédients aux courses.</span><button class="btn soft sm" data-act="repasTab" data-v="recettes">${icon('chef-hat',16)}Mes recettes</button></div>`;
  return h;
}

/* Mes recettes */
function recipesView(){
  const f = S.rcF || 'all', list = recipesSorted(S.rcQ, f);
  const cats = RCATS.filter(([k]) => [...S.recipes.values()].some(r => r.cat === k));
  let h = `<label class="searchbox">${icon('search',18)}<input type="search" id="rc-q" data-ch="rcQ" value="${esc(S.rcQ||'')}" placeholder="Rechercher une recette ou un ingrédient…" autocomplete="off"></label>`;
  if (S.recipes.size) h += `<div class="chips u-shop nowrap">${[['all','Toutes'],['fav','Favoris'],['rapide','Rapides'],...cats].map(([k,l]) => `<button class="chip" data-act="rcFilter" data-v="${k}" aria-pressed="${f===k}">${k==='fav'?icon('heart',14):''}${esc(l)}</button>`).join('')}</div>`;
  if (!S.recipes.size) h += `<div class="empty"><span class="bubble" style="--u-soft:var(--shop-soft);--u-text:var(--shop-text)">${icon('chef-hat',28)}</span><h3>Ton carnet de recettes est vide</h3>
    <span class="muted">Ajoute les plats que vous aimez, ou partage une recette Marmiton, 750g… vers CoTribu : ingrédients et étapes arrivent tout seuls.</span></div>`;
  else if (!list.length) h += `<div class="empty"><span class="muted">Aucune recette ne correspond.</span></div>`;
  else h += `<div class="rgrid">${list.map(r => `<div class="rcard" data-act="recipeOpen" data-id="${r.id}" role="button" tabindex="0"><span class="rimg">${recipeImg(r)}</span>
      <span class="rbody"><span class="row" style="gap:4px;align-items:flex-start"><b>${esc(r.name)}</b><button class="heart ${r.fav?'on':''}" data-act="recipeFav" data-id="${r.id}" aria-label="${r.fav?'Retirer des favoris':'Ajouter aux favoris'}">${icon('heart',18)}</button></span><span class="rmeta">${recipeMeta(r)}</span></span></div>`).join('')}</div>`;
  h += `<div class="fabwide-spacer"></div><button class="fabwide u-shop" data-act="recipeNew">${icon('plus',20)}Ajouter une recette</button>`;
  return h;
}

/* Fiche d'une recette */
function recipeDetail(r){
  const tab = S.rTab || 'ingr', have = (S.rHave && S.rHave.id === r.id) ? S.rHave.set : new Set();
  const ingr = r.ingredients || [];
  const toBuy = ingr.filter((g,i) => !have.has(i) && !onList(g.name)).length;
  let h = `<div class="rhero">${recipeImg(r)}<button class="rh-back" data-act="recipeBack" aria-label="Retour">${icon('chevron-left',22)}</button><button class="rh-fav heart ${r.fav?'on':''}" data-act="recipeFav" data-id="${r.id}" aria-label="Favori">${icon('heart',22)}</button></div>
    <div class="rtitle"><h1>${esc(r.name)}</h1><button class="iconbtn" data-act="recipeEdit" data-id="${r.id}" aria-label="Modifier la recette">${icon('pencil',18)}</button></div>
    <div class="rinfo">${r.time ? `<span>${icon('clock',16)}${r.time} min</span>` : ''}${r.servings ? `<span>${icon('users',16)}${r.servings} personnes</span>` : ''}${r.difficulty ? `<span>${icon('chef-hat',16)}${esc((DIFFS.find(x=>x[0]===r.difficulty)||[0,''])[1])}</span>` : ''}${r.cat ? `<span class="pill">${esc(catLabel(r.cat))}</span>` : ''}</div>`;
  h += seg('rTab', tab, [['ingr','Ingrédients'],['prep','Préparation'],['notes','Notes']], 'u-shop');
  if (tab === 'ingr') {
    h += ingr.length ? `<div class="card" style="gap:0;padding:6px 14px">${ingr.map((g,i) => { const inList = onList(g.name), got = have.has(i);
        return `<button class="ringr ${got?'got':''}" data-act="rcHave" data-i="${i}"><span class="check">${checkIc()}</span><span class="t">${esc([g.qty, g.name].filter(Boolean).join(' '))}</span>${inList ? `<span class="tag">${icon('shopping-cart',12)} dans la liste</span>` : ''}</button>`; }).join('')}</div>
      <span class="muted small">Coche ce que tu as déjà : seuls les autres iront dans la liste de courses.</span>`
      : `<div class="empty"><span class="muted">Pas encore d’ingrédients.</span><button class="btn soft sm" data-act="recipeEdit" data-id="${r.id}">Ajouter les ingrédients</button></div>`;
  } else if (tab === 'prep') {
    h += (r.steps||[]).length ? `<ol class="rsteps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><button class="btn upri u-shop" data-act="recipeCook" data-id="${r.id}">${icon('chef-hat',18)}Cuisiner en mode pas à pas</button>`
      : `<div class="empty"><span class="muted">Pas encore d’étapes.</span><button class="btn soft sm" data-act="recipeEdit" data-id="${r.id}">Ajouter les étapes</button></div>`;
  } else {
    h += `<div class="card">${r.notes ? `<p style="margin:0;white-space:pre-wrap">${esc(r.notes)}</p>` : '<span class="muted">Pas de note. Astuces, variantes, avis de la famille… Touche le crayon pour en ajouter.</span>'}
      ${r.url ? `<a class="linkbtn small" href="${esc(r.url)}" target="_blank" rel="noopener">${icon('book-open',14)} Recette d’origine</a>` : ''}</div>`;
  }
  h += `<div class="ractions"><button class="btn upri u-shop" data-act="recipeToMenu" data-id="${r.id}">${icon('calendar-days',18)}Ajouter au menu</button>
    <button class="btn deep" data-act="recipeToShop" data-id="${r.id}" ${ingr.length ? '' : 'disabled'}>${icon('shopping-cart',18)}${toBuy ? `Ajouter ${toBuy} ingrédient${toBuy>1?'s':''} aux courses` : 'Tout est déjà là 👍'}</button></div>`;
  return h;
}

/* ---------- fenêtres ---------- */
function recipeDraft(r){
  if (r) return {...clone(r), ingrText: (r.ingredients||[]).map(g => (g.qty ? g.qty + ' ' : '') + g.name).join('\n'), stepsText: (r.steps||[]).join('\n'), _new: []};
  return {id: null, name: '', cat: 'plat', servings: 4, time: '', difficulty: 'facile', ingrText: '', stepsText: '', notes: '', fav: false, photo: null, image: '', url: '', importUrl: '', _new: []};
}
SHEETS.recipe = () => {
  const d = S.draft;
  return `<h2>${d.id ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
    ${d.id ? '' : `<div class="importbox"><span class="small"><b>Tu l’as trouvée sur internet ?</b> Colle le lien, CoTribu remplit tout.</span>
      <div class="row"><input type="url" id="rc-url" data-ch="rcImportUrl" value="${esc(d.importUrl||'')}" placeholder="https://www.marmiton.org/…" autocomplete="off" style="flex:1"><button class="btn soft sm" data-act="rcImport" ${d.importing?'disabled':''}>${d.importing ? '<span class="spin"></span>' : icon('download',16)}Importer</button></div></div>`}
    <div class="rphoto">${(d.photo || d.image) ? recipeImg(d, 'pv') : `<span class="rph pv">${icon('camera',28)}</span>`}
      <div style="display:flex;flex-direction:column;gap:6px;flex:1"><label class="btn soft sm filebtn">${icon('camera',16)}${S.uploading ? 'Envoi…' : (d.photo || d.image ? 'Changer la photo' : 'Ajouter une photo')}<input type="file" accept="image/*" data-ch="rcPhoto" ${S.uploading?'disabled':''}></label>
      ${d.photo || d.image ? `<button class="btn ghost sm" data-act="rcNoPhoto">Retirer la photo</button>` : ''}</div></div>
    <label class="f" for="rc-name">Nom<input type="text" id="rc-name" data-ch="rcName" value="${esc(d.name)}" placeholder="Ex. Lasagnes maison"></label>
    <div class="sect"><span class="eyebrow">Catégorie</span><div class="chips u-shop">${RCATS.map(([k,l]) => `<button class="chip" data-act="rcCat" data-v="${k}" aria-pressed="${d.cat===k}">${l}</button>`).join('')}</div></div>
    <div class="frow"><label class="f" for="rc-serv">Personnes<input type="number" id="rc-serv" data-ch="rcServ" min="1" max="30" value="${esc(d.servings||'')}"></label>
      <label class="f" for="rc-time">Temps total (min)<input type="number" id="rc-time" data-ch="rcTime" min="1" max="1440" value="${esc(d.time||'')}" placeholder="45"></label></div>
    <div class="sect"><span class="eyebrow">Difficulté</span><div class="chips u-shop">${DIFFS.map(([k,l]) => `<button class="chip" data-act="rcDiff" data-v="${k}" aria-pressed="${d.difficulty===k}">${l}</button>`).join('')}</div></div>
    <label class="f" for="rc-ingr">Ingrédients (un par ligne, avec la quantité)<textarea id="rc-ingr" data-ch="rcIngr" rows="7" placeholder="12 feuilles de lasagnes&#10;400 g de viande hachée&#10;1 oignon">${esc(d.ingrText)}</textarea></label>
    <label class="f" for="rc-steps">Étapes (une par ligne)<textarea id="rc-steps" data-ch="rcSteps" rows="6" placeholder="Faire revenir l’oignon et la viande&#10;Ajouter les tomates, laisser mijoter 20 min">${esc(d.stepsText)}</textarea></label>
    <label class="f" for="rc-notes">Notes (facultatif)<textarea id="rc-notes" data-ch="rcNotes" rows="3" placeholder="Astuces, variantes, avis de la famille…">${esc(d.notes||'')}</textarea></label>
    <label class="toggle"><input type="checkbox" data-ch="rcFavT" ${d.fav?'checked':''}>Recette favorite ❤️</label>
    <div class="actions"><button class="btn primary" data-act="rcSave" ${S.uploading?'disabled':''}>Enregistrer</button><button class="btn soft" data-act="rcCancel">Annuler</button></div>
    ${d.id ? `<button class="btn danger ${S.armed==='recipe'?'armed':''}" data-act="rcDel">${S.armed==='recipe' ? 'Confirmer : supprimer la recette' : 'Supprimer cette recette'}</button>` : ''}`;
};
function next14(from){ return Array.from({length: 14}, (_, i) => addDays(from, i)); }
SHEETS.toMenu = () => {
  const t = S.tm, r = S.recipes.get(t.rid); if (!r) return '';
  return `<h2>Ajouter au menu</h2><span class="muted">${esc(r.name)}</span>
    <div class="sect"><span class="eyebrow">Quel jour ?</span><div class="hscroll days">${next14(localToday()).map(ds => `<button class="daychip" data-act="tmDay" data-v="${ds}" aria-pressed="${t.days.includes(ds)}"><small>${esc(shortDay(ds))}</small><b>${ymd(ds)[2]}</b></button>`).join('')}</div></div>
    <div class="sect"><span class="eyebrow">Quand ?</span><div class="chips u-shop">${SLOTS.map(([k,l]) => `<button class="chip" data-act="tmSlot" data-v="${k}" aria-pressed="${t.slots.includes(k)}">${l}</button>`).join('')}</div></div>
    ${(r.ingredients||[]).length ? `<label class="toggle"><input type="checkbox" data-ch="tmShop" ${t.shop?'checked':''}>Ajouter aussi les ingrédients manquants aux courses</label>` : ''}
    <div class="actions"><button class="btn primary" data-act="tmSave">${icon('calendar-days',18)}Ajouter${t.days.length * t.slots.length > 1 ? ` (${t.days.length * t.slots.length} repas)` : ''}</button><button class="btn soft" data-act="close">Annuler</button></div>`;
};
SHEETS.mealAdd = () => {
  const a = S.ma, list = recipesSorted(a.q, 'all');
  return `<h2>Ajouter un repas</h2><span class="muted">${esc(cap(fmt(a.day,{weekday:'long', day:'numeric', month:'long'})))}</span>
    <div class="chips u-shop">${SLOTS.map(([k,l]) => `<button class="chip" data-act="maSlot" data-v="${k}" aria-pressed="${a.slot===k}">${l}</button>`).join('')}</div>
    <div class="sect"><span class="eyebrow">Choisir une recette</span>
      ${S.recipes.size > 5 ? `<label class="searchbox">${icon('search',18)}<input type="search" id="ma-q" data-ch="maQ" value="${esc(a.q||'')}" placeholder="Rechercher…" autocomplete="off"></label>` : ''}
      ${list.length ? `<div class="menu">${list.slice(0, 30).map(r => `<button class="lrow" data-act="maPick" data-id="${r.id}"><span class="rthumb">${recipeImg(r)}</span><span class="body"><span class="t">${esc(r.name)}</span><span class="s rmeta">${recipeMeta(r)}</span></span>${r.fav ? icon('heart',16,'class="favic"') : ''}</button>`).join('')}</div>`
        : `<span class="muted small">${S.recipes.size ? 'Aucune recette ne correspond.' : 'Ton carnet de recettes est encore vide.'}</span>`}</div>
    <div class="sect"><span class="eyebrow">Ou un repas libre, sans recette</span>
      <div class="row"><input type="text" id="ma-free" data-ch="maFree" value="${esc(a.free||'')}" placeholder="Ex. Restes, pizza, chez mamie…" style="flex:1" data-enter="maFreeSave"><button class="btn soft sm" data-act="maFreeSave">Ajouter</button></div></div>
    <button class="btn ghost" data-act="maNewRecipe">${icon('plus',18)}Créer une nouvelle recette</button>`;
};
SHEETS.mealMenu = () => {
  const x = S.mm, m = S.meals.get(x.id); if (!m) return '';
  const r = mealRecipe(m), ingr = mealIngredients(m), multi = mealOcc(m).length > 1, steps = r ? (r.steps||[]) : (m.steps||[]);
  const row = (a, ic, l, extra='') => `<button class="lrow" data-act="${a}" ${extra}><span class="bubble sm">${icon(ic,16)}</span><span class="body"><span class="t">${l}</span></span>${icon('chevron-right',18)}</button>`;
  return `<h2>${esc(m.name)}</h2><span class="muted">${esc(cap(fmt(x.day,{weekday:'long', day:'numeric', month:'long'})))} · ${esc(x.slot)}</span>
    <div class="menu u-shop">${r ? row('mmRecipe','book-open','Voir la recette') : ''}${steps.length ? row('mmCook','chef-hat','Cuisiner (pas à pas)') : ''}
      ${ingr.length ? row('mmShop','shopping-cart','Ajouter les ingrédients aux courses') : ''}
      ${row('mmEdit','pencil', 'Modifier ou déplacer')}
      ${!r && (m.ingredients||[]).length ? row('mmToRecipe','chef-hat','Enregistrer dans mes recettes') : ''}</div>
    <button class="btn danger" data-act="mmDelOne">${multi ? 'Retirer ce repas-ci' : 'Supprimer ce repas'}</button>
    ${multi ? `<button class="btn ghost" data-act="mmDelAll">Supprimer les ${mealOcc(m).length} repas « ${esc(m.name)} »</button>` : ''}`;
};
// depuis Courses : « Ajouter depuis une recette »
SHEETS.fromRecipe = () => {
  const f = S.fr;
  if (f.step === 2) {
    const n = f.ingredients.filter((g,i) => f.pick.has(i)).length;
    return `<h2>${esc(f.name)}</h2><span class="muted">Ce qui est coché ira dans la liste. Décoche ce que tu as déjà.</span>
      <div class="card" style="gap:0;padding:6px 14px">${f.ingredients.map((g,i) => { const inList = onList(g.name);
        return `<button class="ringr ${f.pick.has(i)?'buy':'skip'}" data-act="frTog" data-i="${i}"><span class="check">${checkIc()}</span><span class="t">${esc([g.qty, g.name].filter(Boolean).join(' '))}</span>${inList ? `<span class="tag">déjà dans la liste</span>` : ''}</button>`; }).join('')}</div>
      <div class="actions"><button class="btn primary" data-act="frAdd" ${n?'':'disabled'}>${icon('shopping-cart',18)}Ajouter ${n} article${n>1?'s':''}</button><button class="btn soft" data-act="frBack">Retour</button></div>`;
  }
  const today = localToday();
  const planned = [...S.meals.values()].filter(m => mealIngredients(m).length && mealOcc(m).some(o => o.date >= today && o.date <= addDays(today, 7)));
  const list = recipesSorted(f.q, 'all');
  return `<h2>Ajouter depuis une recette</h2>
    ${planned.length ? `<div class="sect"><span class="eyebrow">Au menu cette semaine</span><div class="menu">${planned.map(m => { const r = mealRecipe(m), o = mealOcc(m).filter(x => x.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0];
        return `<button class="lrow" data-act="frPickMeal" data-id="${m.id}"><span class="rthumb">${r ? recipeImg(r) : `<span class="rph">${icon('utensils',20)}</span>`}</span><span class="body"><span class="t">${esc(m.name)}</span><span class="s">${esc(dayTag(o.date))} ${esc(o.slot)} · ${mealIngredients(m).length} ingrédients</span></span>${icon('chevron-right',18)}</button>`; }).join('')}</div></div>` : ''}
    <div class="sect"><span class="eyebrow">Mes recettes</span>
      ${S.recipes.size > 5 ? `<label class="searchbox">${icon('search',18)}<input type="search" id="fr-q" data-ch="frQ" value="${esc(f.q||'')}" placeholder="Rechercher…" autocomplete="off"></label>` : ''}
      ${list.length ? `<div class="menu">${list.filter(r => (r.ingredients||[]).length).slice(0, 30).map(r => `<button class="lrow" data-act="frPickRecipe" data-id="${r.id}"><span class="rthumb">${recipeImg(r)}</span><span class="body"><span class="t">${esc(r.name)}</span><span class="s">${(r.ingredients||[]).length} ingrédients</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>`
        : `<span class="muted small">Ton carnet de recettes est vide. Ajoute des recettes dans Plus → Repas & recettes.</span>`}</div>
    <button class="btn soft" data-act="close">Fermer</button>`;
};
function frOpen(name, ingredients){
  S.fr = {...S.fr, step: 2, name, ingredients, pick: new Set(ingredients.map((g,i) => onList(g.name) ? -1 : i).filter(i => i >= 0))};
  renderSheet();
}

/* ---------- actions ---------- */
function openRecipe(id){ S.recipeOpen = id; S.rTab = 'ingr'; if (!(S.rHave && S.rHave.id === id)) S.rHave = {id, set: new Set()}; history.pushState({sub: 2}, ''); render(); window.scrollTo(0,0); }
function goRepasTab(tab){ if (S.sheet) closeSheet(); S.tab = 'plus'; S.repasTab = tab; S.recipeOpen = null; goSub(() => { S.sub.plus = 'repas'; }); }
function newMealFromRecipe(r, days, slots){
  const occ = []; days.slice().sort().forEach(ds => slots.slice().sort((a,b) => slotRank(a) - slotRank(b)).forEach(s => occ.push({date: ds, slot: s})));
  const m = {id: uid('r'), name: r.name, recipeId: r.id, date: occ[0].date, slot: occ[0].slot, occ, ingredients: [], by: S.me || null};
  put('meals', m); if (typeof thinkCredit === 'function') thinkCredit('meals');
  return m;
}
Object.assign(H, {
  repasTab: el => { S.repasTab = el.dataset.v; S.recipeOpen = null; render(); window.scrollTo(0,0); },
  goRecipes: () => goRepasTab('recettes'),
  menuPick: el => { S.menuDay = el.dataset.v; render(); },
  menuShift: el => { S.menuDay = addDays(S.menuDay || localToday(), +el.dataset.v); render(); },
  rcFilter: el => { S.rcF = el.dataset.v; render(); },
  rTab: el => { S.rTab = el.dataset.v; render(); },
  recipeOpen: el => openRecipe(el.dataset.id),
  recipeBack: () => back(),
  recipeFav: el => { const r = S.recipes.get(el.dataset.id); if (!r) return; put('recipes', {...clone(r), fav: !r.fav}); render(); toast(r.fav ? 'Retirée des favoris' : 'Ajoutée aux favoris ❤️'); },
  recipeNew: () => { S.draft = recipeDraft(null); openSheet('recipe'); },
  recipeEdit: el => { const r = S.recipes.get(el.dataset.id); if (!r) return; S.draft = recipeDraft(r); openSheet('recipe'); },
  recipeCook: el => { const r = S.recipes.get(el.dataset.id); if (r) cookRecipe(r); },
  rcHave: el => { const i = +el.dataset.i, s = S.rHave.set; s.has(i) ? s.delete(i) : s.add(i); render(); },
  recipeToShop: el => {
    const r = S.recipes.get(el.dataset.id); if (!r) return;
    const n = toShoppingList(r.ingredients || [], S.rHave && S.rHave.id === r.id ? S.rHave.set : null);
    render(); toast(n ? `${n} ingrédient${n>1?'s':''} ajouté${n>1?'s':''} aux courses, rangés par rayon` : 'Tout est déjà dans la liste');
  },
  recipeToMenu: el => { S.tm = {rid: el.dataset.id, days: [S.menuDay && S.menuDay >= localToday() ? S.menuDay : localToday()], slots: [new Date().getHours() < 14 ? 'midi' : 'soir'], shop: false}; openSheet('toMenu'); },
  menuAddRecipe: el => { S.tm = {rid: el.dataset.id, days: [S.menuDay || localToday()], slots: ['soir'], shop: false}; openSheet('toMenu'); },
  tmDay: el => { const t = S.tm, v = el.dataset.v; t.days = t.days.includes(v) ? t.days.filter(x => x !== v) : [...t.days, v]; renderSheet(); },
  tmSlot: el => { const t = S.tm, v = el.dataset.v; t.slots = t.slots.includes(v) ? t.slots.filter(x => x !== v) : [...t.slots, v]; renderSheet(); },
  tmSave: () => {
    const t = S.tm, r = S.recipes.get(t.rid); if (!r) return;
    if (!t.days.length || !t.slots.length) { toast('Choisis un jour et un moment.'); return; }
    newMealFromRecipe(r, t.days, t.slots);
    let n = 0; if (t.shop) n = toShoppingList(r.ingredients || []);
    closeSheet(); S.menuDay = t.days.slice().sort()[0]; render();
    toast(`${r.name} ajouté au menu${n ? `, ${n} ingrédient${n>1?'s':''} dans les courses` : ''}`);
  },
  mealAdd: () => { S.ma = {day: S.menuDay || localToday(), slot: new Date().getHours() < 14 ? 'midi' : 'soir', q: '', free: ''}; openSheet('mealAdd'); },
  maSlot: el => { S.ma.slot = el.dataset.v; renderSheet(); },
  maPick: el => { const r = S.recipes.get(el.dataset.id), a = S.ma; if (!r) return; newMealFromRecipe(r, [a.day], [a.slot]); closeSheet(); render(); toast(`${r.name} ajouté au menu`); },
  maFreeSave: () => {
    const a = S.ma, name = (a.free || document.getElementById('ma-free')?.value || '').trim(); if (!name) { toast('Écris le nom du repas.'); return; }
    put('meals', {id: uid('r'), name, date: a.day, slot: a.slot, occ: [{date: a.day, slot: a.slot}], ingredients: [], by: S.me || null});
    if (typeof thinkCredit === 'function') thinkCredit('meals');
    closeSheet(); render(); toast(`${name} ajouté au menu`);
  },
  maNewRecipe: () => { S.draft = recipeDraft(null); S.sheet = 'recipe'; S.armed = null; renderSheet(); },
  mealMenu: el => { S.mm = {id: el.dataset.id, day: el.dataset.day, slot: el.dataset.slot}; openSheet('mealMenu'); },
  mmRecipe: () => { const m = S.meals.get(S.mm.id), r = mealRecipe(m); closeSheet(); if (r) setTimeout(() => openRecipe(r.id), 60); },
  mmCook: () => { const m = S.meals.get(S.mm.id), r = mealRecipe(m); closeSheet(); setTimeout(() => r ? cookRecipe(r) : startCook(m), 60); },
  mmShop: () => { const m = S.meals.get(S.mm.id); if (!m) return; S.fr = {step: 1, q: ''}; S.sheet = 'fromRecipe'; frOpen(m.name, mealIngredients(m)); },
  mmEdit: () => { const m = S.meals.get(S.mm.id); if (!m) return; S.draft = mealDraft(m); S.sheet = 'meal'; S.armed = null; renderSheet(); },
  mmToRecipe: () => {
    const m = S.meals.get(S.mm.id); if (!m) return;
    const r = {id: 'rc-' + uid('r').slice(2), name: m.name, cat: 'plat', servings: +String(m.servings||'').replace(/\D/g,'') || 4, time: m.time || '', difficulty: 'facile', ingredients: m.ingredients || [], steps: m.steps || [], notes: '', fav: false, image: m.image || '', url: m.url || '', by: S.me || null, createdAt: new Date().toISOString()};
    put('recipes', r); put('meals', {...clone(m), recipeId: r.id, ingredients: [], steps: []});
    closeSheet(); render(); toast(`${m.name} enregistré dans tes recettes`);
  },
  mmDelOne: () => {
    const x = S.mm, m = S.meals.get(x.id); if (!m) return; const before = clone(m);
    const rest = mealOcc(m).filter(o => !(o.date === x.day && o.slot === x.slot));
    if (rest.length) put('meals', {...clone(m), occ: rest, date: rest[0].date, slot: rest[0].slot}); else del('meals', m.id);
    closeSheet(); render(); toastUndo(`${m.name} retiré du menu`, () => { put('meals', before); render(); });
  },
  mmDelAll: () => { const m = S.meals.get(S.mm.id); if (!m) return; const before = clone(m); del('meals', m.id); closeSheet(); render(); toastUndo(`${m.name} supprimé du menu`, () => { put('meals', before); render(); }); },
  fromRecipeOpen: () => { S.fr = {step: 1, q: ''}; openSheet('fromRecipe'); },
  frPickRecipe: el => { const r = S.recipes.get(el.dataset.id); if (r) frOpen(r.name, r.ingredients || []); },
  frPickMeal: el => { const m = S.meals.get(el.dataset.id); if (m) frOpen(m.name, mealIngredients(m)); },
  frTog: el => { const i = +el.dataset.i, p = S.fr.pick; p.has(i) ? p.delete(i) : p.add(i); renderSheet(); },
  frBack: () => { S.fr.step = 1; renderSheet(); },
  frAdd: () => { const f = S.fr; let n = 0; f.ingredients.forEach((g,i) => { if (f.pick.has(i) && addIngredient(g)) n++; }); closeSheet(); render(); toast(n ? `${n} article${n>1?'s':''} ajouté${n>1?'s':''} aux courses` : 'Tout est déjà dans la liste'); },
  // fenêtre recette
  rcCat: el => { S.draft.cat = el.dataset.v; renderSheet(); },
  rcDiff: el => { S.draft.difficulty = el.dataset.v; renderSheet(); },
  rcNoPhoto: () => { S.draft.photo = null; S.draft.image = ''; renderSheet(); },
  rcCancel: () => { const d = S.draft; if (d && d._new && d._new.length) removePhotos(d._new.filter(p => p !== (S.recipes.get(d.id)||{}).photo)).catch(()=>{}); closeSheet(); },
  rcImport: async () => {
    const d = S.draft, url = (d.importUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) { toast('Colle un lien qui commence par https://'); return; }
    d.importing = true; renderSheet();
    try {
      const {data, error} = await sb.functions.invoke('cotribu-recipe', {body: {url}});
      if (error) throw error;
      const r = data && data.recipe;
      if (!r) toast('Je n’ai pas trouvé de recette sur cette page. Tu peux la remplir à la main.');
      else {
        Object.assign(d, {name: d.name || r.name || '', ingrText: (r.ingredients||[]).join('\n'), stepsText: (r.steps||[]).join('\n'), image: d.photo ? d.image : (r.image || ''), url: r.url || url,
          time: r.time || d.time, servings: +String(r.servings||'').replace(/\D/g,'').slice(0,2) || d.servings});
        toast('Recette importée : vérifie et enregistre');
      }
    } catch(e) { console.warn(e); toast('L’import n’a pas marché (fonction pas encore activée ?). Tu peux la remplir à la main.'); }
    d.importing = false; renderSheet();
  },
  rcSave: () => {
    const d = S.draft, name = (d.name || '').trim(); if (!name) { toast('Donne un nom à la recette.'); return; }
    const old = d.id ? S.recipes.get(d.id) : null;
    const r = {id: d.id || 'rc-' + uid('r').slice(2), name, cat: d.cat || 'plat', servings: +d.servings || '', time: +d.time || '', difficulty: d.difficulty || '',
      ingredients: parseIngredients(d.ingrText), steps: String(d.stepsText||'').split('\n').map(x => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean).slice(0, 40),
      notes: (d.notes || '').trim(), fav: !!d.fav, photo: d.photo || null, image: d.photo ? '' : (d.image || ''), url: d.url || '', by: (old && old.by) || S.me || null, createdAt: (old && old.createdAt) || new Date().toISOString()};
    put('recipes', r);
    const stale = [old && old.photo, ...(d._new || [])].filter(p => p && p !== r.photo); if (stale.length) removePhotos(stale).catch(()=>{});
    if (!old && typeof thinkCredit === 'function') thinkCredit('meals');
    closeSheet();
    if (!old) { S.tab = 'plus'; S.sub.plus = 'repas'; S.repasTab = 'recettes'; setTimeout(() => openRecipe(r.id), 60); } else render();
    toast(old ? 'Recette modifiée' : 'Recette ajoutée au carnet');
  },
  rcDel: () => {
    if (S.armed !== 'recipe') { S.armed = 'recipe'; renderSheet(); return; }
    const d = S.draft, r = S.recipes.get(d.id); if (!r) return;
    del('recipes', r.id); if (r.photo) removePhotos([r.photo]).catch(()=>{});
    closeSheet(); if (S.recipeOpen === r.id) { S.recipeOpen = null; back(); } render(); toast('Recette supprimée');
  },
});
Object.assign(CH, {
  rcQ: el => { S.rcQ = el.value; render(); },
  maQ: el => { S.ma.q = el.value; renderSheet(); },
  maFree: el => { S.ma.free = el.value; },
  frQ: el => { S.fr.q = el.value; renderSheet(); },
  tmShop: el => { S.tm.shop = el.checked; },
  rcImportUrl: el => { S.draft.importUrl = el.value; },
  rcName: el => { S.draft.name = el.value; }, rcServ: el => { S.draft.servings = el.value; }, rcTime: el => { S.draft.time = el.value; },
  rcIngr: el => { S.draft.ingrText = el.value; }, rcSteps: el => { S.draft.stepsText = el.value; }, rcNotes: el => { S.draft.notes = el.value; },
  rcFavT: el => { S.draft.fav = el.checked; },
  rcPhoto: async el => {
    const f = el.files && el.files[0]; if (!f) return;
    S.uploading = true; renderSheet();
    try { const p = await uploadPhoto(f); S.draft._new.push(p); S.draft.photo = p; S.draft.image = ''; }
    catch(e) { console.warn(e); toast(explain(e)); }
    S.uploading = false; renderSheet();
  },
});
['rcQ','maQ','maFree','frQ','rcImportUrl','rcName','rcIngr','rcSteps','rcNotes'].forEach(k => LIVE.add(k));
