/* CoTribu — Supabase : connexion, foyer, synchronisation, installation */
/* ---------- Supabase ---------- */
const SUPABASE_URL = 'https://seyoygitqtttyftwzssr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q-6hNV7Z4zsaVRhMine7Dg_hjBd_HV4';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}});
S.hh = null;        // foyer courant {id, name, invite_code}
S.live = false;     // canal temps réel connecté
S.busy = false;
S.welcomeMode = 'create';
const QS = new URLSearchParams(location.search);
S.joinCode = (QS.get('code') || '').toUpperCase().slice(0,6);
S.procheCode = (QS.get('proche') || '').toUpperCase().slice(0,6);
if (S.joinCode) S.welcomeMode = 'join';
if (S.procheCode) S.welcomeMode = 'proche';
S.role = 'member';
const HH_COLS = 'id,name,invite_code,proche_code,premium_until,premium_source';
let channel = null;

const queues = new Map();
function enqueue(key, fn){
  const prev = queues.get(key) || Promise.resolve();
  const next = prev.then(fn).then(r => { if (r && r.error) throw r.error; }).catch(err => onWriteError(err));
  queues.set(key, next);
  return next;
}
function onWriteError(err){
  console.warn(err);
  const m = (err && err.message || '').toLowerCase();
  if (!navigator.onLine) toast("Pas de connexion : la modification n’a pas été enregistrée.");
  else if (m.includes('check')) toast(explain(err));
  else toast("Modification non enregistrée. Réessaie dans un instant.");
  loadAll();
}
// le carnet de recettes est rangé dans la collection « meals » de la base (ids « rc-… »), sans changement de schéma
const dbCol = col => col === 'recipes' ? 'meals' : col;
const appCol = (col, id) => col === 'meals' && String(id).startsWith('rc-') ? 'recipes' : col;
const row = (col, obj) => ({household_id:S.hh.id, col:dbCol(col), id:obj.id, data:obj, updated_at:new Date().toISOString()});
function put(col, obj){
  S[col].set(obj.id, obj);
  return enqueue(col+'/'+obj.id, () => sb.from('docs').upsert(row(col,obj)));
}
function putMany(col, list){
  list.forEach(o => S[col].set(o.id, o));
  return enqueue('bulk', () => sb.from('docs').upsert(list.map(o=>row(col,o))));
}
function del(col, id){
  S[col].delete(id);
  enqueue(col+'/'+id, () => sb.from('docs').delete().match({household_id:S.hh.id, col:dbCol(col), id}));
}
function putMeta(meta){
  S.meta = meta;
  if (S.hh) { S.hh.name = meta.name; enqueue('hh', () => sb.from('households').update({name:meta.name}).eq('id', S.hh.id)); }
}

async function loadAll(){
  if (!S.hh) return;
  const {data, error} = await sb.from('docs').select('col,id,data').eq('household_id', S.hh.id);
  if (error) { console.warn(error); return; }
  const next = {}; COLS.forEach(c => next[c] = new Map());
  data.forEach(r => { const c = appCol(r.col, r.id); if (next[c]) next[c].set(r.id, {...r.data, id:r.id}); });
  Object.assign(S, next);
  const h = await sb.from('households').select(HH_COLS).eq('id', S.hh.id).maybeSingle();
  if (h.data) { S.hh = h.data; S.meta = {name:h.data.name}; }
  S.loaded = true;
  render();
}
function subscribe(){
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('docs-'+S.hh.id)
    .on('postgres_changes', {event:'*', schema:'public', table:'docs', filter:'household_id=eq.'+S.hh.id}, p => {
      if (p.eventType === 'DELETE') { const o = p.old || {}; if (o.household_id && o.household_id !== S.hh.id) return; const c = appCol(o.col, o.id); if (S[c]) S[c].delete(o.id); }
      else { const r = p.new; const c = appCol(r.col, r.id); if (S[c]) S[c].set(r.id, {...r.data, id:r.id}); }
      render();
    })
    .subscribe(status => { S.live = status === 'SUBSCRIBED'; renderHeaderStatus(); });
}
async function openHousehold(h, role, memberId){
  S.hh = h; S.meta = {name:h.name}; S.loaded = false;
  S.role = role || 'member';
  LS.set('cotribu-hh', h.id);
  const memberKey = 'cotribu-me-'+h.id; S.me = S.role === 'proche' ? memberId : LS.get(memberKey);
  S.tab = S.role === 'proche' ? 'proche' : (S.tab === 'proche' ? 'today' : S.tab);
  S.mode = 'app'; render();
  await loadAll(); subscribe();
  if (typeof handleLaunch === 'function') handleLaunch();
}
async function boot(){
  const {data:{session}} = await sb.auth.getSession();
  if (!session) { S.mode = 'welcome'; render(); return; }
  const {data, error} = await sb.from('household_users').select(`household_id, member_id, role, households(${HH_COLS})`).eq('user_id', session.user.id);
  if (error) { console.warn(error); S.errMsg = error.message; S.mode = 'error'; render(); return; }
  if (!data.length) { S.mode = 'welcome'; render(); return; }
  const last = LS.get('cotribu-hh');
  const pick = data.find(d => d.household_id === last) || data[0];
  if (pick.role !== 'proche' && pick.member_id && !LS.get('cotribu-me-'+pick.household_id)) LS.set('cotribu-me-'+pick.household_id, pick.member_id);
  openHousehold(pick.households, pick.role, pick.member_id);
}
async function ensureSession(){
  const {data:{session}} = await sb.auth.getSession();
  if (session) return;
  const {error} = await sb.auth.signInAnonymously();
  if (error) throw error;
}
function explain(err){
  const m = (err && (err.message || err.msg) || '').toLowerCase();
  if (m.includes('code_invalide')) return 'Code introuvable. Vérifie les 6 caractères.';
  if (m.includes('code_cadeau_invalide')) return 'Ce code cadeau n’existe pas.';
  if (m.includes('code_cadeau_epuise')) return 'Ce code cadeau a déjà été utilisé.';
  if (m.includes('code_cadeau_deja_utilise')) return 'Ton foyer a déjà utilisé ce code.';
  if (m.includes('deja_pris')) return 'Quelqu’un a déjà accepté cette demande.';
  if (m.includes('demande_annulee')) return 'Cette demande a été annulée par la famille.';
  if (m.includes('nom_manquant')) return 'Écris ton prénom (ou comment la famille t’appelle).';
  if (m.includes('anonymous')) return 'Connexion désactivée : active « Allow anonymous sign-ins » dans Supabase.';
  if (m.includes('docs_col_check') || m.includes('check constraint')) return 'La base n’est pas à jour : lance migration-2.sql dans Supabase.';
  if (m.includes('bucket')) return 'Le stockage des photos n’est pas prêt : lance migration-2.sql dans Supabase.';
  if (m.includes('function') || m.includes('relation') || m.includes('schema')) return 'La base n’est pas encore prête : lance le script SQL dans Supabase.';
  if (!navigator.onLine) return 'Pas de connexion internet.';
  return 'Ça n’a pas marché : ' + (err && err.message || 'erreur inconnue');
}
async function createHousehold(){
  const names = (S.welcome||[]).map(n=>n.trim()).filter(Boolean);
  if (!names.length) { toast('Ajoute au moins un prénom.'); return; }
  S.busy = true; render();
  try {
    await ensureSession();
    const {data:h, error} = await sb.rpc('create_household', {p_name:(S.wHome||'').trim() || 'Notre maison'});
    if (error) throw error;
    S.hh = h;
    let tpl = buildTemplate(names, localToday());
    if ((S.wDesc||'').trim() && typeof aiSetupTemplate === 'function') {
      toast('L’IA prépare votre maison…');
      try { const t2 = await aiSetupTemplate(h.id, tpl.members, S.wDesc.trim()); if (t2) tpl = t2; }
      catch(e) { console.warn(e); toast('L’IA n’a pas pu répondre : modèle standard chargé.'); }
    }
    const rows = [...tpl.members.map(o=>row('members',o)), ...tpl.rooms.map(o=>row('rooms',o)), ...tpl.tasks.map(o=>row('tasks',o))];
    const up = await sb.from('docs').upsert(rows); if (up.error) throw up.error;
    LS.set('cotribu-me-'+h.id, tpl.members[0].id);
    await sb.from('household_users').update({member_id:tpl.members[0].id}).eq('household_id', h.id).eq('user_id', (await sb.auth.getUser()).data.user.id);
    S.busy = false; S.tab = 'today';
    await openHousehold(h);
    toast('Foyer créé. Invite ta famille : Plus → Foyer.');
  } catch(e) { S.busy = false; render(); toast(explain(e)); }
}
async function joinAsProche(){
  const code = (S.procheCode||'').trim().toUpperCase(), name = (S.procheName||'').trim();
  if (code.length < 6) { toast('Le code fait 6 caractères.'); return; }
  if (!name) { toast('Écris ton prénom (ou comment la famille t’appelle).'); return; }
  S.busy = true; render();
  try {
    await ensureSession();
    const {data:h, error} = await sb.rpc('join_as_proche', {p_code:code, p_name:name});
    if (error) throw error;
    history.replaceState(null, '', location.pathname);
    const u = (await sb.auth.getUser()).data.user;
    const {data:hu} = await sb.from('household_users').select('role, member_id').eq('household_id', h.id).eq('user_id', u.id).maybeSingle();
    S.busy = false;
    await openHousehold(h, hu ? hu.role : 'proche', hu ? hu.member_id : null);
    toast('Bienvenue ! Tu es maintenant proche de « ' + h.name + ' »');
  } catch(e) { S.busy = false; render(); toast(explain(e)); }
}
async function joinHousehold(){
  const code = (S.joinCode||'').trim().toUpperCase();
  if (code.length < 6) { toast('Le code fait 6 caractères.'); return; }
  S.busy = true; render();
  try {
    await ensureSession();
    const {data:h, error} = await sb.rpc('join_household', {p_code:code});
    if (error) throw error;
    history.replaceState(null, '', location.pathname);
    S.busy = false; S.tab = 'today';
    const u = (await sb.auth.getUser()).data.user;
    const {data:hu} = await sb.from('household_users').select('role, member_id').eq('household_id', h.id).eq('user_id', u.id).maybeSingle();
    await openHousehold(h, hu ? hu.role : 'member', hu ? hu.member_id : null);
    toast('Bienvenue dans « ' + h.name + ' »');
  } catch(e) { S.busy = false; render(); toast(explain(e)); }
}
async function setMe(id){
  S.me = id; LS.set('cotribu-me-'+S.hh.id, id); render();
  const u = (await sb.auth.getUser()).data.user;
  if (u) sb.from('household_users').update({member_id:id}).eq('household_id', S.hh.id).eq('user_id', u.id).then(()=>{});
}
async function leaveHousehold(){
  const u = (await sb.auth.getUser()).data.user;
  await sb.from('household_users').delete().eq('household_id', S.hh.id).eq('user_id', u.id);
  if (channel) sb.removeChannel(channel);
  LS.set('cotribu-hh', ''); S.hh = null; COLS.forEach(c => S[c] = new Map());
  S.mode = 'welcome'; render();
}

/* ---------- install (PWA) ---------- */
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('CoTribu est installée'); render(); });
/* ---------- mises à jour de l'app ---------- */
let swWaiting = null, swReloading = false;
function showUpdate(w){ swWaiting = w; const el = document.getElementById('update'); if (el) el.hidden = false; }
function applyUpdate(){ const el = document.getElementById('update'); if (el) el.querySelector('button').textContent = 'Mise à jour…'; if (swWaiting) swWaiting.postMessage('skip'); else location.reload(); }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (swReloading) return; swReloading = true; location.reload(); });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); }); });
    const check = () => reg.update().catch(()=>{});
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }).catch(()=>{}));
}
const shareSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
function installCard(compact){
  if (isStandalone()) return '';
  if (compact) { const until = +(LS.get('cotribu-install-later')||0); if (Date.now() < until) return ''; }
  if (installEvt) return `<div class="card install"><h3>Installer CoTribu</h3><span class="small">Une icône sur ton écran d’accueil, comme une vraie app.</span>
    <div class="actions"><button class="btn primary" data-act="install">Installer</button>${compact?'<button class="btn soft" data-act="later">Plus tard</button>':''}</div></div>`;
  if (isIOS()) return `<div class="card install"><h3>Ajoute CoTribu à ton écran d’accueil</h3>
    <ol class="steps"><li>Touche ${shareSvg} <b>Partager</b> en bas de Safari</li><li>Choisis <b>Sur l’écran d’accueil</b></li><li>Ouvre CoTribu depuis sa nouvelle icône</li></ol>
    ${compact?'<div class="actions"><button class="btn soft" data-act="later">Plus tard</button></div>':''}</div>`;
  return '';
}
function inviteLink(){ return location.origin + location.pathname + '?code=' + (S.hh ? S.hh.invite_code : ''); }
async function shareInvite(){
  const text = `Rejoins notre foyer « ${S.hh.name} » sur CoTribu : ${inviteLink()} (code ${S.hh.invite_code})`;
  if (navigator.share) { try { await navigator.share({title:'CoTribu', text}); return; } catch(e){ if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Invitation copiée'); }
  catch(e) { const i = document.getElementById('inv-link'); if (i) { i.select(); } toast('Sélectionne le lien pour le copier'); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.hh) { loadAll(); if (!S.live) subscribe(); } });
window.addEventListener('online', () => { if (S.hh) { loadAll(); subscribe(); } });


/* ---------- photos (souvenirs) ---------- */
const PHOTO_URLS = new Map(); // chemin → {url, exp}
async function resizeImage(file, max=1600, quality=0.82){
  const bmp = await (window.createImageBitmap ? createImageBitmap(file).catch(()=>null) : null);
  let w, h, draw;
  if (bmp) { w = bmp.width; h = bmp.height; draw = (ctx,W,H) => ctx.drawImage(bmp,0,0,W,H); }
  else {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); });
    w = img.naturalWidth; h = img.naturalHeight; draw = (ctx,W,H) => ctx.drawImage(img,0,0,W,H);
  }
  const r = Math.min(1, max / Math.max(w,h)); const W = Math.round(w*r), H = Math.round(h*r);
  const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H);
  return await new Promise(ok => c.toBlob(ok, 'image/jpeg', quality));
}
async function uploadPhoto(file){
  const blob = await resizeImage(file);
  const path = `${S.hh.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const {error} = await sb.storage.from('souvenirs').upload(path, blob, {contentType:'image/jpeg', upsert:false});
  if (error) throw error;
  return path;
}
async function photoUrls(paths){
  const now = Date.now();
  const need = [...new Set(paths)].filter(p => { const c = PHOTO_URLS.get(p); return !c || c.exp < now + 60000; });
  if (need.length) {
    const {data, error} = await sb.storage.from('souvenirs').createSignedUrls(need, 3600);
    if (!error && data) data.forEach(d => { if (d.signedUrl) PHOTO_URLS.set(d.path, {url:d.signedUrl, exp: now + 3500*1000}); });
  }
}
const photoUrl = p => (PHOTO_URLS.get(p)||{}).url || '';
async function removePhotos(paths){ if (paths.length) await sb.storage.from('souvenirs').remove(paths); }
