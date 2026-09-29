/* CoTribu — « Une idée ? Un souci ? » : les messages arrivent dans la table feedback de Supabase */

// version de l'appli = nom du cache du service worker (ex. cotribu-v26)
try { caches.keys().then(k => { S.appVersion = k.filter(x => /^cotribu-v\d+$/.test(x)).sort((a,b) => parseInt(a.slice(9)) - parseInt(b.slice(9))).pop() || ''; }).catch(()=>{}); } catch(_){}
const FB_KINDS = [['idee','sparkles','Une idée'], ['probleme','wrench','Un souci'], ['bravo','heart','Un bravo']];
SHEETS.feedback = () => {
  const d = S.draft;
  const ph = {idee: 'Ex. Ce serait super de pouvoir…', probleme: 'Ex. Quand je touche…, il se passe… Sur quel écran ?', bravo: 'Ce que tu aimes dans CoTribu'}[d.kind];
  return `<h2>Une idée ? Un souci ?</h2>
    <span class="muted">CoTribu est faite par une petite équipe, et chaque message est lu. Dis-nous ce qui t’aiderait, ce qui coince, ou ce qui te plaît.</span>
    <div class="chips">${FB_KINDS.map(([k,ic,l]) => `<button class="chip" data-act="fbKind" data-v="${k}" aria-pressed="${d.kind===k}">${icon(ic,16)}${l}</button>`).join('')}</div>
    <label class="f" for="fb-msg">Ton message<textarea id="fb-msg" data-ch="fbMsg" rows="6" maxlength="4000" placeholder="${esc(ph)}">${esc(d.message||'')}</textarea></label>
    <label class="f" for="fb-contact">Pour te répondre (facultatif)<input type="email" id="fb-contact" data-ch="fbContact" value="${esc(d.contact||'')}" placeholder="ton@email.fr" autocomplete="email" maxlength="200"></label>
    <span class="muted small">On joint automatiquement la version de l’appli et le type de téléphone, pour comprendre un éventuel souci. Rien d’autre.</span>
    <div class="actions"><button class="btn primary" data-act="fbSend" ${d.sending?'disabled':''}>${icon('send',18)}${d.sending?'Envoi…':'Envoyer'}</button><button class="btn soft" data-act="close">Annuler</button></div>`;
};
function fbInfo(){
  const ua = navigator.userAgent || '';
  const os = /Android\s[\d.]+/.exec(ua)?.[0] || (/iPhone|iPad/.test(ua) ? 'iOS ' + ((/OS (\d+[_\d]*)/.exec(ua)||[])[1]||'').replace(/_/g,'.') : /Windows|Mac OS X|Linux/.exec(ua)?.[0] || '');
  const browser = /SamsungBrowser|Firefox|Edg|Chrome|Safari/.exec(ua)?.[0] || '';
  return {version: S.appVersion || '', os, browser, installed: matchMedia('(display-mode: standalone)').matches, screen: `${screen.width}x${screen.height}`, tab: S.tab, premium: typeof isPremium === 'function' ? isPremium() : false, members: S.members.size};
}
Object.assign(H, {
  feedbackOpen: () => { S.draft = {kind:'idee', message:'', contact: LS.get('cotribu-fb-contact') || ''}; openSheet('feedback'); },
  fbKind: el => { S.draft.kind = el.dataset.v; renderSheet(); },
  fbSend: async () => {
    const d = S.draft, message = (d.message||'').trim(), contact = (d.contact||'').trim();
    if (message.length < 3) { toast('Écris quelques mots avant d’envoyer.'); document.getElementById('fb-msg')?.focus(); return; }
    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) { toast('L’adresse e-mail ne semble pas valide.'); return; }
    const last = +(LS.get('cotribu-fb-last') || 0); if (Date.now() - last < 20000) { toast('Merci ! Attends quelques secondes avant d’en envoyer un autre.'); return; }
    d.sending = true; renderSheet();
    try {
      const {data: u} = await sb.auth.getUser();
      const {error} = await sb.from('feedback').insert({user_id: u && u.user ? u.user.id : null, household_id: S.hh ? S.hh.id : null, kind: d.kind, message: message.slice(0,4000), contact: contact || null, info: fbInfo()});
      if (error) throw error;
      LS.set('cotribu-fb-last', String(Date.now())); if (contact) LS.set('cotribu-fb-contact', contact);
      sb.functions.invoke('cotribu-push', {body:{mode:'feedback'}}).catch(() => {}); // prévient l'équipe tout de suite
      closeSheet(); toast({idee:'Merci pour ton idée ! 💡', probleme:'Merci, on regarde ça.', bravo:'Merci, ça fait chaud au cœur ! 💛'}[d.kind]);
    } catch(e) {
      console.warn(e); d.sending = false; renderSheet();
      toast(/relation|does not exist|schema cache/i.test(e.message||'') ? 'L’envoi n’est pas encore activé. Réessaie plus tard.' : 'Envoi impossible. Vérifie ta connexion et réessaie.');
    }
  },
});
Object.assign(CH, { fbMsg: el => { S.draft.message = el.value; }, fbContact: el => { S.draft.contact = el.value; } });
LIVE.add('fbMsg'); LIVE.add('fbContact');
