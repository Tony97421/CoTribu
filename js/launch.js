/* CoTribu — ouverture depuis un raccourci de l'icône (?go=…) ou depuis « Partager vers CoTribu » (?share=1) */

async function handleLaunch(){
  const q = new URLSearchParams(location.search);
  const go = q.get('go'), share = q.get('share');
  if (!go && !share) return;
  try { history.replaceState(history.state, '', location.pathname); } catch(e){}
  if (S.mode !== 'app' || S.role === 'proche') return;
  if (go) return launchGo(go);
  if (share) return receiveShared();
}
function launchGo(go){
  if (S.sheet) closeSheet();
  if (go === 'courses') H.goAddItem();
  else if (go === 'task') { S.tab = 'maison'; render(); H.newTask({dataset:{}}); }
  else if (go === 'event') { S.tab = 'planning'; render(); H.newEvent(); }
  else if (go === 'memory') { S.tab = 'plus'; S.sub.plus = 'souvenirs'; render(); H.newMemory(); }
}

/* ---------- Partage reçu ---------- */
async function receiveShared(){
  let meta = null, files = [];
  try {
    const c = await caches.open('cotribu-share');
    const r = await c.match('./__share/meta'); if (r) meta = await r.json();
    if (meta) for (let i = 0; i < meta.files; i++) { const f = await c.match(`./__share/${i}`); if (f) files.push(await f.blob()); }
    for (const k of await c.keys()) await c.delete(k);
  } catch(e){ console.warn(e); }
  if (!meta || (!meta.text && !meta.title && !meta.url && !files.length)) { toast('Rien n’a été reçu. Réessaie de partager.'); return; }
  const text = [meta.text, meta.url && !(meta.text||'').includes(meta.url) ? meta.url : ''].filter(Boolean).join('\n').trim();
  const cands = shareCandidates(text);
  const sh = S.shared = {title: (meta.title||'').trim(), text, files, cands, pick: cands.map(c => !isStaple(c)), thumbs: files.map(f => URL.createObjectURL(f))};
  const link = meta.url || ((text.match(/https?:\/\/\S+/) || [])[0]) || '';
  if (link && !files.length) { sh.loading = true; fetchRecipe(sh, link); }
  openSheet('shared');
}
// sel, poivre, eau : on les a déjà, décochés par défaut
function isStaple(c){ const n = norm(parseItem(c).name); return /^(sel|poivre|eau|sel et poivre|sel poivre)( |$)/.test(n) && n.split(' ').length <= 3; }
async function fetchRecipe(sh, link){
  try {
    const call = sb.functions.invoke('cotribu-recipe', {body:{url: link}});
    const {data, error} = await Promise.race([call, new Promise(ok => setTimeout(() => ok({error:{message:'timeout'}}), 15000))]);
    if (error) throw error;
    if (data && data.recipe && data.recipe.ingredients.length) {
      const r = data.recipe;
      sh.recipe = r; sh.title = r.name || sh.title;
      sh.cands = r.ingredients; sh.pick = r.ingredients.map(c => !isStaple(c));
    } else sh.recipeFail = (data && data.error) || 'pas_de_recette';
  } catch(e) { console.warn('recette', e); sh.recipeFail = 'indispo'; }
  sh.loading = false;
  if (S.sheet === 'shared' && S.shared === sh) renderSheet();
}

// « prends du lait, des couches et du pain stp » → Lait, Couches, Pain
const FILLER = /^(stp|svp|merci|hello|salut|coucou|bonjour|hey|ok|tu peux|peux-tu|peux tu|pourrais-tu|pense à|pense a|penses à|penses a|n['’]oublie pas|oublie pas|il faut|faut|il manque|il nous faut|on a besoin de|besoin de|on n['’]a plus de|plus de|prends|prend|prendre|achète|achete|acheter|ramène|ramene|ramener|récupère|recupere|reprends|et)(?=\s|$|[:,!])[\s:,!]*/i;
const ARTICLE = /^(?:(?:du|de la|des|le|la|les|un|une)\s+|(?:de l|l|d)['’]\s*)/i;
function shareCandidates(text){
  const QTY = /^((\d+(?:[.,/]\d+)?\s?[½¼¾]?|[½¼¾])\s?(kg|mg|g|l|dl|cl|ml|x|pinc[ée]es?|cuill[eè]res?( [àa] (soupe|caf[ée]))?|c\.? ?[àa] ?[sc]\.?|gousses?|verres?|tranches?|sachets?|pots?|bo[iî]tes?|feuilles?|brins?)?)$/i;
  // « 250 g » seul sur une ligne, puis « de farine » à la ligne suivante (copier-coller d'une recette)
  const lines = String(text||'').replace(/https?:\/\/\S+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean), joined = [];
  for (let i = 0; i < lines.length; i++) { if (QTY.test(lines[i]) && lines[i+1]) { joined.push(lines[i] + ' ' + lines[i+1]); i++; } else joined.push(lines[i]); }
  const s = joined.join('\n');
  const out = [], seen = new Set();
  for (let part of s.split(/\n|,|;|•|·|\s+et\s+|\s+\+\s+|\s+puis\s+/i)) {
    part = part.replace(/^[\s\-–—*•·✓✔☐▪>]+/, '').replace(/[\s!.?…)]+$/, '').replace(/\s+(stp|svp|merci|et)$/i, '').trim();
    let prev; do { prev = part; part = part.replace(FILLER, '').trim(); } while (part !== prev);
    if (!/^\d/.test(part)) part = part.replace(ARTICLE, '').trim();
    if (part.length < 2 || part.length > 50 || part.split(/\s+/).length > 7) continue;
    const k = norm(part); if (seen.has(k)) continue; seen.add(k);
    out.push(part);
  }
  return out.slice(0, 30);
}
function sharedFirstLine(){
  const sh = S.shared || {};
  const t = sh.title || (sh.text||'').replace(/https?:\/\/\S+/g, '').split('\n').map(x => x.trim()).find(Boolean) || '';
  return t.slice(0, 80);
}

SHEETS.shared = () => {
  const sh = S.shared; if (!sh) return '';
  const n = sh.pick.filter(Boolean).length;
  let h = `<h2>Reçu dans CoTribu</h2>`;
  if (sh.thumbs.length) h += `<div class="uploads">${sh.thumbs.map(u => `<span class="ph"><img src="${esc(u)}" alt=""></span>`).join('')}</div>
    <button class="btn primary" data-act="shareMemory">${icon('heart',18)}En faire un souvenir</button>`;
  if (sh.loading) h += `<div class="row muted small"><span class="spin"></span>Lecture de la recette…</div>`;
  if (sh.recipe) h += `<div class="ucard u-shop"><span class="kicker">Recette</span><strong>${esc(sh.recipe.name || 'Recette')}</strong><span class="muted small">${sh.recipe.ingredients.length} ingrédients${sh.recipe.servings ? ' · ' + esc(sh.recipe.servings) : ''}</span></div>`;
  else if (sh.recipeFail && !sh.loading) h += `<div class="info">${sh.recipeFail === 'indispo' ? 'La lecture des recettes n’est pas encore activée.' : 'Je n’ai pas trouvé les ingrédients sur cette page.'} Astuce : sur la recette, sélectionne la liste des ingrédients, puis Partager → CoTribu.</div>`;
  if (sh.text && !sh.recipe) h += `<div class="sharequote">${esc(sh.text.length > 400 ? sh.text.slice(0,400) + '…' : sh.text)}</div>`;
  if (sh.cands.length) h += `<div class="sect"><span class="eyebrow">${sh.recipe ? 'Ingrédients' : 'Pour les courses'}, touche pour retirer</span><div class="chips u-shop">${sh.cands.map((c,i) => `<button class="chip" data-act="shareTog" data-i="${i}" aria-pressed="${sh.pick[i]}">${esc(cap(c))}</button>`).join('')}</div></div>
    <button class="btn ${sh.thumbs.length ? 'soft' : 'primary'}" data-act="shareItems" ${n ? '' : 'disabled'}>${icon('shopping-cart',18)}Ajouter ${n} article${n>1?'s':''} aux courses</button>`;
  if (sh.text || sh.title) h += `<div class="menu">
    ${[['shareTask','circle-check','En faire une tâche','u-home'],['shareEvent','calendar','En faire un événement','u-plan'],['shareMeal','utensils','En faire un repas','u-shop']]
      .map(([a,ic,l,u]) => `<button class="lrow ${u}" data-act="${a}"><span class="bubble sm">${icon(ic,16)}</span><span class="body"><span class="t">${l}</span></span>${icon('chevron-right',18)}</button>`).join('')}</div>`;
  return h + `<button class="btn soft" data-act="shareCancel">Annuler</button>`;
};
function sharedDone(){ const sh = S.shared; if (sh) sh.thumbs.forEach(u => URL.revokeObjectURL(u)); S.shared = null; }
Object.assign(H, {
  shareTog: el => { const i = +el.dataset.i; S.shared.pick[i] = !S.shared.pick[i]; renderSheet(); },
  shareItems: () => {
    const sh = S.shared; let n = 0;
    sh.cands.forEach((c,i) => { if (sh.pick[i] && !onList(parseItem(c).name) && addItemFromText(c)) n++; });
    sharedDone(); closeSheet();
    S.tab = 'courses'; S.sub.courses = 'liste'; S.aisleOpen = null; render(); window.scrollTo(0,0);
    toast(n ? `${n} article${n>1?'s':''} ajouté${n>1?'s':''} aux courses` : 'Déjà tout dans la liste');
  },
  shareTask: () => {
    if (!S.rooms.size) { toast('Crée d’abord une pièce.'); return; }
    const name = sharedFirstLine(); sharedDone();
    S.draft = draftFromTask(null); S.draft.name = name; S.sheet = 'task'; S.armed = null; renderSheet();
  },
  shareEvent: () => {
    const sh = S.shared, title = sharedFirstLine(), note = sh.text && sh.text !== title ? sh.text.slice(0, 1000) : ''; sharedDone();
    S.draft = draftEvent(null, localToday()); S.draft.title = title; S.draft.note = note; S.sheet = 'event'; S.armed = null; renderSheet();
    toast('Choisis la date et l’heure');
  },
  shareMeal: () => {
    const sh = S.shared, name = sh.title || (sh.cands.length > 2 ? '' : sharedFirstLine());
    const ingr = sh.cands.length > 2 ? sh.cands.join('\n') : ''; sharedDone();
    S.draft = {...mealDraft(null, localToday(), 'soir'), name, ingrText: ingr}; S.sheet = 'meal'; S.armed = null; renderSheet();
  },
  shareMemory: () => {
    const sh = S.shared, files = sh.files, title = sharedFirstLine(); sharedDone();
    S.draft = draftMemory(null, {title}); S.sheet = 'memory'; S.armed = null; renderSheet();
    CH.moFiles({files});
  },
  shareCancel: () => { sharedDone(); closeSheet(); },
});
