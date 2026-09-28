/* CoTribu — notifications (abonnement de ce téléphone) */
const VAPID_PUBLIC = 'BF8cRTNKkssM013U0xV0UDH1YgNZg4ZPG2BNMuv2-Jb5xEmhzzxzW-ZBkDRifU2_ywJ2H-deloRBmyOqkO01fUo';
S.push = {state:'unknown', busy:false};

function b64ToBytes(b64){
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const s = atob((b64 + pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function refreshPushState(){
  if (!pushSupported()) { S.push.state = isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'; return; }
  if (Notification.permission === 'denied') { S.push.state = 'denied'; return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    S.push.state = sub ? 'on' : 'off';
  } catch(e) { S.push.state = 'off'; }
}
async function enablePush(){
  if (!S.me) { toast('Choisis d’abord qui tu es sur ce téléphone.'); return; }
  S.push.busy = true; render();
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { S.push.state = perm === 'denied' ? 'denied' : 'off'; return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToBytes(VAPID_PUBLIC)});
    await savePushSub(sub);
    S.push.state = 'on'; toast('Rappels activés sur ce téléphone');
  } catch(e) { console.warn(e); toast(explain(e)); }
  finally { S.push.busy = false; render(); }
}
async function savePushSub(sub){
  const j = sub.toJSON();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  const {error} = await sb.from('push_subs').upsert({endpoint:j.endpoint, household_id:S.hh.id, member_id:S.me, sub:j, tz});
  if (error) throw error;
}
async function disablePush(){
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await sb.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    S.push.state = 'off'; toast('Rappels désactivés sur ce téléphone');
  } catch(e) { toast(explain(e)); }
  render();
}
async function testPush(){
  S.push.busy = true; render();
  try {
    const {data, error} = await sb.functions.invoke('cotribu-push', {body:{mode:'test'}});
    if (error) throw error;
    toast(data && data.sent ? 'Notification envoyée : elle arrive dans quelques secondes' : 'Aucun téléphone abonné trouvé');
  } catch(e) { console.warn(e); toast('Le serveur de rappels ne répond pas encore (fonction « cotribu-push » à installer dans Supabase).'); }
  finally { S.push.busy = false; render(); }
}
// Garder l'abonnement à jour si on change de profil sur ce téléphone
const _setMe = setMe;
setMe = async function(id){ await _setMe(id); if (S.push.state === 'on') { try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await savePushSub(sub); } catch(e){} } };

function pushCard(){
  const st = S.push.state, busy = S.push.busy;
  let body = '';
  if (st === 'on') body = `<span class="small">Ce téléphone reçoit les rappels de <b>${esc(S.me ? nameOf(S.me) : '…')}</b> : chaque matin vers 7h30 ses tâches et événements du jour, et une heure avant chaque événement.</span>
    <div class="actions"><button class="btn soft" data-act="testPush" ${busy?'disabled':''}>${icon('bell',18)}${busy?'Envoi…':'Tester'}</button><button class="btn danger" data-act="disablePush">Désactiver</button></div>`;
  else if (st === 'ios-install') body = `<span class="small">Sur iPhone, les rappels marchent une fois CoTribu ajoutée à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouverte depuis son icône.</span>`;
  else if (st === 'unsupported') body = `<span class="small muted">Ce navigateur ne permet pas les notifications. Sur Android, utilise Chrome ; sur iPhone, ajoute l’app à l’écran d’accueil.</span>`;
  else if (st === 'denied') body = `<span class="small">Les notifications sont bloquées pour CoTribu. Autorise-les dans les réglages du téléphone (Notifications → Chrome ou CoTribu), puis reviens ici.</span>`;
  else body = `<span class="small">Chaque matin, tes tâches et tes événements du jour. Et un petit rappel une heure avant chaque rendez-vous.</span>
    <button class="btn deep" data-act="enablePush" ${busy?'disabled':''}>${icon('bell',18)}${busy?'Activation…':'Activer les rappels'}</button>`;
  return `<div class="card"><div class="row"><span class="bubble soft" style="--u-soft:var(--home-soft);--u-text:var(--home-text)">${icon('bell',18)}</span><h3>Rappels sur ce téléphone</h3></div>${body}</div>`;
}
Object.assign(H, { enablePush: () => enablePush(), disablePush: () => disablePush(), testPush: () => testPush() });
refreshPushState().then(() => { if (S.mode === 'app') render(); });
