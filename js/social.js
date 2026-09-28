/* CoTribu — dictée des courses (reconnaissance vocale du téléphone, gratuite) et bouton « Merci » */

/* ---------- Dictée ---------- */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let REC = null;
function micBtn(){
  if (!SpeechRec) return '';
  const on = !!REC;
  return `<button class="mic ${on ? 'on' : ''}" data-act="micToggle" aria-label="${on ? 'Arrêter la dictée' : 'Dicter des articles'}" aria-pressed="${on}">${icon('mic',20)}</button>`;
}
function micRefresh(){ document.querySelectorAll('.mic').forEach(b => { b.classList.toggle('on', !!REC); b.setAttribute('aria-pressed', !!REC); }); }
function startDictation(){
  if (!SpeechRec) { toast('La dictée n’est pas disponible sur ce téléphone.'); return; }
  const rec = new SpeechRec();
  rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += ' ' + r[0].transcript; else interim += r[0].transcript; }
    const inp = document.getElementById('c-new'); if (inp) { inp.value = (finalText + ' ' + interim).trim(); inp.placeholder = 'Je t’écoute…'; }
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Autorise le micro pour CoTribu dans les réglages du téléphone.');
    else if (e.error === 'no-speech') toast('Je n’ai rien entendu. Réessaie en parlant près du téléphone.');
    else if (e.error !== 'aborted') toast('La dictée a été interrompue.');
  };
  rec.onend = () => {
    REC = null; micRefresh();
    const inp = document.getElementById('c-new'); if (inp) { inp.value = ''; inp.placeholder = 'Ajouter un article (ex. 6 bananes)'; }
    const said = finalText.trim(); if (!said) return;
    addSpoken(said);
  };
  try { rec.start(); REC = rec; micRefresh(); try { navigator.vibrate && navigator.vibrate(15); } catch(_){} }
  catch(e) { REC = null; toast('Impossible de démarrer la dictée.'); }
}
// « du lait des œufs et deux baguettes » → Lait, Œufs, 2 baguettes
const NUMS = {un:1, une:1, deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8, neuf:9, dix:10, douze:12, quinze:15, vingt:20};
function spokenItems(text){
  let s = ' ' + String(text).toLowerCase().replace(/[.!?;]/g, ',') + ' ';
  s = s.replace(/\s(virgule|puis|ensuite|aussi|avec|et)(?=\s)/g, ',');
  s = s.replace(/(^|[\s,])(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt)\s(?=\S)/g, (m, pre, w) => `${pre}${NUMS[w]} `);
  s = s.replace(/(\d)\s?(kilogrammes?|kilos?)(?=\s|,)/g, '$1 kg').replace(/(\d)\s?grammes?(?=\s|,)/g, '$1 g').replace(/(\d)\s?centilitres?(?=\s|,)/g, '$1 cl').replace(/(\d)\s?litres?(?=\s|,)/g, '$1 l');
  // la dictée met rarement des virgules : on coupe devant « du / des / de la / de l' » et devant chaque nombre
  s = s.replace(/\s(?=(?:du|des|de la)\s|de l['’])/g, ', ').replace(/\s(?=\d)/g, ', ');
  // « lait pain œufs » dit d'une traite : si chaque mot est un produit connu, on sépare
  return shareCandidates(s).flatMap(p => {
    const w = p.split(/\s+/);
    return w.length > 2 && !/\d|['’]/.test(p) && w.every(x => x.length > 2 && guessAisle(x) !== 'autre') ? w : [p];
  });
}
function addSpoken(said){
  const list = spokenItems(said);
  if (!list.length) { toast(`Je n’ai pas compris : « ${said} »`); return; }
  let n = 0; const names = [];
  for (const c of list) { if (onList(parseItem(c).name)) continue; const it = addItemFromText(c, S.aisleOpen || null); if (it) { n++; names.push(it.name); } }
  render();
  toast(n ? `Ajouté : ${names.slice(0,4).join(', ')}${names.length > 4 ? '…' : ''}` : 'Déjà tout dans la liste');
}
Object.assign(H, {
  micToggle: () => { if (REC) { try { REC.stop(); } catch(_){} } else startDictation(); },
});

/* ---------- Merci ---------- */
function thanksBtn(t, doer, today){
  if (!S.me || !doer || doer === S.me || !S.members.has(doer)) return '';
  const m = S.members.get(doer);
  const sent = (m.thanks || []).some(x => x.from === S.me && x.key === t.id + '|' + today);
  return sent ? `<span class="thx sent" aria-label="Merci envoyé">${icon('heart',16)}Merci</span>`
    : `<button class="thx" data-act="thank" data-id="${t.id}" data-to="${doer}" aria-label="Dire merci à ${esc(m.name)}">${icon('heart',16)}Merci</button>`;
}
function sendThanks(to, what, key){
  const m0 = S.members.get(to); if (!m0 || !S.me) return;
  const m = clone(m0);
  m.thanks = [...(m.thanks || []), {id: uid('m'), from: S.me, what, key, at: new Date().toISOString()}].slice(-20);
  put('members', m);
}
function unseenThanks(){
  if (!S.me || !S.members.has(S.me)) return [];
  const seen = LS.get('cotribu-thx-seen-' + S.me) || '';
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  return (S.members.get(S.me).thanks || []).filter(x => x.at > seen && x.at > week && S.members.has(x.from));
}
function thanksCard(){
  const list = unseenThanks(); if (!list.length) return '';
  const byFrom = {}; list.forEach(x => (byFrom[x.from] = byFrom[x.from] || []).push(x.what));
  const lines = Object.entries(byFrom).map(([from, whats]) => `<div class="row">${avatar(from)}<span class="small" style="flex:1"><b>${esc(nameOf(from))}</b> t’a dit merci pour ${esc(listFr([...new Set(whats)].slice(0,3).map(w => lowerFirst(w))))}${whats.length > 3 ? '…' : ''}</span></div>`).join('');
  return `<div class="ucard u-mem thxcard"><div class="row"><span class="bubble sm">${icon('heart',16)}</span><h3 style="flex:1">${list.length > 1 ? 'Des mercis pour toi' : 'Un merci pour toi'}</h3><button class="x" style="border:0;background:none;color:var(--muted)" data-act="thanksSeen" aria-label="Masquer">${icon('x',18)}</button></div>${lines}</div>`;
}
const lowerFirst = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const listFr = a => a.length > 1 ? a.slice(0,-1).join(', ') + ' et ' + a.at(-1) : (a[0] || '');
Object.assign(H, {
  thank: el => {
    const t = S.tasks.get(el.dataset.id), to = el.dataset.to; if (!t) return;
    sendThanks(to, t.name, t.id + '|' + localToday());
    render(); toast(`Merci envoyé à ${nameOf(to)} 💛`);
    try { navigator.vibrate && navigator.vibrate(15); } catch(_){}
  },
  thanksSeen: () => { const l = S.members.get(S.me); const last = (l && l.thanks || []).map(x => x.at).sort().at(-1); LS.set('cotribu-thx-seen-' + S.me, last || new Date().toISOString()); render(); },
});
