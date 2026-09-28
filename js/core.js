/* CoTribu — dates, récurrences, état, modèle de départ */
/* ---------- dates (all UTC-based day math) ---------- */
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const idx = ds => { const [y,m,d] = ds.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/DAY); };
const fromIdx = i => { const d = new Date(i*DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; };
const addDays = (ds,n) => fromIdx(idx(ds)+n);
const dow = ds => (idx(ds)+4)%7; // 0 = dimanche
const mondayOf = ds => addDays(ds, -((dow(ds)+6)%7));
const mod = (a,n) => ((a%n)+n)%n;
const ymd = ds => ds.split('-').map(Number);
const dim = (y,m) => new Date(Date.UTC(y,m,0)).getUTCDate();
const isoWeek = ds => { const i = idx(ds), th = i + 3 - ((dow(ds)+6)%7); const y = new Date(th*DAY).getUTCFullYear(); return 1 + Math.floor((th - idx(`${y}-01-01`))/7); };
const fmt = (ds,o) => new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',...o}).format(new Date(idx(ds)*DAY));
const fmtShort = ds => fmt(ds, ds.slice(0,4) === localToday().slice(0,4) ? {weekday:'short',day:'numeric',month:'short'} : {day:'numeric',month:'short',year:'numeric'});
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

const DAYN = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const DAYL = ['D','L','M','M','J','V','S'];
const MON = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MONS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const WEEK_ORDER = [1,2,3,4,5,6,0];
const COLORS = ['#D98C6A','#9DB9C8','#B8AED1','#E8B7B4','#E5C77A','#A7C4A0','#9AA7B0','#DCCDBF'];

/* ---------- recurrence engine ---------- */
function isOn(rec, ds){
  if (!rec) return false;
  if (rec.type === 'weekly'){
    if (!(rec.days||[]).includes(dow(ds))) return false;
    const w = Math.floor((idx(ds) - idx(rec.anchor || ds))/7);
    return mod(w, rec.every||1) === 0;
  }
  if (rec.type === 'monthly'){
    const [y,m,d] = ymd(ds);
    if (rec.months && rec.months.length){ if (!rec.months.includes(m)) return false; }
    else { const [ay,am] = (rec.anchor||ds).split('-').map(Number); if (mod((y-ay)*12 + (m-am), rec.every||1) !== 0) return false; }
    const last = dim(y,m);
    if (rec.mode === 'day') return d === Math.min(rec.day||1, last);
    if (dow(ds) !== rec.weekday) return false;
    if (rec.nth === -1) return d + 7 > last;
    return Math.ceil(d/7) === rec.nth;
  }
  return false;
}
function nextOcc(rec, from, n=1){
  const out=[]; for (let i=0;i<800 && out.length<n;i++){ const ds=addDays(from,i); if (isOn(rec,ds)) out.push(ds); } return out;
}
function prevOcc(rec, before){
  for (let i=1;i<400;i++){ const ds=addDays(before,-i); if (isOn(rec,ds)) return ds; } return null;
}
function intervalDue(t){ return t.lastDone ? addDays(t.lastDone, t.rec.days) : (t.rec.anchor || t.createdAt); }

function recLabel(rec){
  if (!rec) return '';
  if (rec.type === 'weekly'){
    const days = WEEK_ORDER.filter(d => (rec.days||[]).includes(d));
    const e = rec.every||1;
    if (days.length === 7 && e === 1) return 'Tous les jours';
    const names = days.map(d => DAYN[d]);
    const list = names.length > 1 ? names.slice(0,-1).join(', ') + ' et ' + names.at(-1) : names[0] || '—';
    if (e === 1) return names.length === 1 ? 'Chaque ' + list : cap(list);
    if (e === 2) return names.length === 1 ? `Un ${list} sur deux` : `${cap(list)}, une semaine sur deux`;
    return `${cap(list)}, toutes les ${e} semaines`;
  }
  if (rec.type === 'monthly'){
    const part = rec.mode === 'day' ? `le ${rec.day===1?'1er':rec.day}` : `${rec.nth===1?'1er':rec.nth===-1?'dernier':rec.nth+'e'} ${DAYN[rec.weekday]}`;
    if (rec.months && rec.months.length){
      const ms = [...rec.months].sort((a,b)=>a-b).map(m=>MON[m-1]);
      if (ms.length === 1) return `${cap(part)} de ${ms[0]}, chaque année`;
      return `${cap(part)} de ${ms.slice(0,-1).join(', ')} et ${ms.at(-1)}`;
    }
    const e = rec.every||1;
    return e === 1 ? `${cap(part)} du mois` : `${cap(part)} du mois, tous les ${e} mois`;
  }
  if (rec.type === 'interval'){
    const n = rec.days;
    if (n % 365 === 0) return n === 365 ? 'Tous les ans' : `Tous les ${n/365} ans`;
    if (n % 30 === 0) return n === 30 ? 'Environ tous les mois' : `Environ tous les ${n/30} mois`;
    if (n % 7 === 0) return n === 7 ? 'Environ chaque semaine' : `Environ toutes les ${n/7} semaines`;
    return n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
  }
  return '';
}
const isRoutine = rec => rec && rec.type === 'weekly' && (rec.every||1) === 1;

/* assignment */
function assigneesOn(t, ds){
  if (t.swap && t.swap[ds] && S.members.has(t.swap[ds])) return [t.swap[ds]]; // « je m'en occupe » pour ce jour-là
  const a = t.assign || {mode:'anyone'};
  const ids = (a.members||[]).filter(id => S.members.has(id));
  if (a.mode === 'fixed') return ids;
  if (a.mode === 'rotation' && ids.length){
    const w = Math.floor((idx(ds) - idx(a.anchor || mondayOf(ds)))/7);
    return [ids[mod(w, ids.length)]];
  }
  return [];
}

/* status for today */
function todayStatus(t, today){
  if (t.rec.type === 'interval'){
    const due = intervalDue(t);
    const doneToday = t.lastDone === today;
    if (doneToday) return {show:true, done:true, late:false};
    if (due <= today) return {show:true, done:false, late: due < today, since: due};
    return {show:false};
  }
  const done = !!(t.done && t.done[today]);
  const sched = isOn(t.rec, today);
  if (sched || done) return {show:true, done, late:false};
  if (t.carry){
    const p = prevOcc(t.rec, today);
    const base = t.lastDone || addDays(t.createdAt || today, -1);
    if (p && p > base) return {show:true, done:false, late:true, since:p};
  }
  return {show:false};
}
/* occurrence on a future day (week view) */
function onDay(t, ds, today){
  if (ds === today) { const s = todayStatus(t,today); return s.show && !s.late; }
  if (t.rec.type === 'interval'){
    // project forward, assuming anything due by today gets done today
    let due = intervalDue(t);
    if (t.lastDone === today || due <= today) due = addDays(today, t.rec.days);
    const diff = idx(ds) - idx(due);
    return diff >= 0 && diff % t.rec.days === 0;
  }
  return isOn(t.rec, ds);
}

/* ---------- state ---------- */
const COLS = ['members','rooms','tasks','items','events','meals','memories','proches','requests','albums','rewards'];
const S = {
  members:new Map(), rooms:new Map(), tasks:new Map(), items:new Map(), events:new Map(), meals:new Map(), memories:new Map(),
  proches:new Map(), requests:new Map(), albums:new Map(), rewards:new Map(),
  meta:{name:'Notre maison'},
  mode:'loading', loaded:false, tab:'today', filter:'all', me:null, draft:null, sheet:null, armed:null,
  sub:{maison:'jour', courses:'liste', planning:'semaine', plus:null},
  roomOpen:null, aisleOpen:null, planDay:null, planMonth:null, dismissed:{},
};
const LS = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} },
};
S.filter = LS.get('cotribu-filter') || 'all';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + '-' + Math.random().toString(36).slice(2,9);
const sorted = map => [...map.values()].sort((a,b)=>(a.order??0)-(b.order??0) || String(a.name).localeCompare(b.name));
const clone = o => JSON.parse(JSON.stringify(o));

/*TPL*/
function buildTemplate(memberNames, today){
  const mon = mondayOf(today);
  const members = memberNames.map((n,i)=>({id:'m'+(i+1), name:n, color:i%COLORS.length, order:i}));
  const ids = members.map(m=>m.id);
  const two = ids.slice(0,2);
  const W = (days, every=1) => ({type:'weekly', days, every, anchor:mon});
  const M = (o) => ({type:'monthly', every:1, anchor:today.slice(0,7), mode:'nth', nth:1, weekday:0, ...o});
  const I = (days, offset=0) => ({type:'interval', days, anchor:addDays(today, offset)});
  const fixed = (i=0) => ({mode:'fixed', members:[ids[i] || ids[0]]});
  const rot = () => ({mode:'rotation', members:two, anchor:mon});
  const anyone = () => ({mode:'anyone', members:[]});
  const rooms = [
    ['general','Toute la maison','house'],['cuisine','Cuisine','cooking-pot'],['salon','Salon','sofa'],['sdb','Salle de bain','bath'],['wc','WC','toilet'],
    ['ch-parents','Chambre parents','bed-double'],['ch-enfant','Chambre enfant','baby'],['linge','Linge','washing-machine'],['exterieur','Extérieur','sprout'],
  ].map(([id,name,icon],i)=>({id:'r-'+id, name, icon, order:i}));
  const T = [];
  const add = (room, list) => list.forEach(([name, rec, assign, carry, time]) => T.push({room, name, rec, assign, carry: !!carry, time: time || null}));
  add('general', [
    ['Vider le lave-vaisselle', W([0,1,2,3,4,5,6]), rot(), false, {mode:'before', at:'09:00'}],
    ['Faire les courses', W([1]), fixed(0)],
    ['Sortir les poubelles', W([2,5]), rot(), false, {mode:'at', at:'20:00'}],
    ['Arroser les plantes', W([3,6]), anyone()],
  ]);
  add('cuisine', [
    ['Nettoyer le frigo', W([1]), fixed(0)],
    ['Nettoyer les façades', W([2]), fixed(1)],
    ['Plan de travail', W([2]), fixed(1)],
    ['Poussière', W([2]), fixed(1)],
    ['Évier', W([2]), fixed(1)],
    ['Aspirateur', W([2]), fixed(1)],
    ['Sol', W([2]), fixed(1)],
    ['Détartrer la cafetière', I(30,0), anyone()],
    ['Nettoyer le four', I(90,40), anyone()],
  ]);
  add('salon', [
    ['Poussière', W([0]), fixed(0)],
    ['Aspirateur', W([0]), fixed(0)],
    ['Sol', W([0]), fixed(0)],
    ['Vitres', M({nth:1, weekday:0}), fixed(0), true],
  ]);
  add('sdb', [
    ['Lavabo et miroir', W([5]), rot()],
    ['Douche / baignoire', W([5]), rot()],
    ['Changer les serviettes', W([5]), rot()],
    ['Sol', W([5]), rot()],
    ['Joints et siphons', I(90,60), anyone(), true],
  ]);
  add('wc', [
    ['Cuvette', W([5]), rot()],
    ['Sol', W([5]), rot()],
  ]);
  add('ch-parents', [
    ['Poussière', W([4]), fixed(0)],
    ['Aspirateur', W([4]), fixed(0)],
    ['Changer les draps', W([4],2), fixed(0), true],
  ]);
  add('ch-enfant', [
    ['Ranger la chambre', W([3]), anyone()],
    ['Poussière', W([3]), anyone()],
    ['Aspirateur', W([3]), anyone()],
    ['Changer les draps', W([3],2), anyone(), true],
  ]);
  add('linge', [
    ['Lancer une machine', I(3,0), anyone()],
    ['Laver les rideaux', M({months:[4,10], weekday:6}), anyone(), true],
  ]);
  add('exterieur', [
    ['Balayer la terrasse', W([6],2), fixed(0)],
    ['Grand nettoyage de la terrasse', M({months:[3,9], weekday:6}), anyone(), true],
  ]);
  const counters = {};
  const tasks = T.map(t => { counters[t.room] = (counters[t.room]||0)+1; return {
    id:`t-${t.room}-${counters[t.room]}`, roomId:'r-'+t.room, name:t.name, rec:t.rec, assign:t.assign, carry:t.carry, time:t.time,
    order:counters[t.room], createdAt:today, lastDone:null, done:{} }; });
  return {members, rooms, tasks};
}
/*/TPL*/


/* ---------- univers, catégories, rayons ---------- */
const ROOM_ICONS = ['house','wrench','cooking-pot','sofa','bath','toilet','bed-double','baby','washing-machine','sprout','trees','shirt','armchair','book-open','car','package','sparkles'];

const CATS = {
  famille:{label:'Famille / Sorties', icon:'trees',          c:'#A7C4A0', soft:'var(--cat-famille)'},
  sante:  {label:'Santé / Rendez-vous', icon:'stethoscope', c:'#9DB9C8', soft:'var(--cat-sante)'},
  repas:  {label:'Repas', icon:'utensils',                  c:'#E5C77A', soft:'var(--cat-repas)'},
  ecole:  {label:'École / Activités enfants', icon:'backpack', c:'#E8B7B4', soft:'var(--cat-ecole)'},
  maison: {label:'Maison', icon:'house',                    c:'#B8AED1', soft:'var(--cat-maison)'},
  garde:  {label:'Garde / Proches', icon:'users',           c:'#9AA7B0', soft:'var(--cat-garde)'},
  autre:  {label:'Autre', icon:'star',                      c:'#D98C6A', soft:'var(--cat-autre)'},
};

const AISLES = [
  {id:'fruits',   name:'Fruits & légumes',  icon:'apple',       tone:'shop',  kw:'pomme poire banane tomate salade carotte courgette oignon ail échalote pomme de terre patate avocat citron orange clémentine kiwi fraise raisin melon pastèque poireau brocoli chou épinard concombre poivron aubergine champignon herbe persil basilic menthe fruit légume radis haricot vert endive betterave mangue ananas pêche abricot cerise'},
  {id:'frais',    name:'Produits frais',    icon:'milk',        tone:'plan',  kw:'lait yaourt yogourt fromage beurre crème oeuf œuf mozzarella emmental comté parmesan chèvre feta skyr compote dessert jambon lardon saucisson chorizo pâte feuilletée pâte brisée pâte à pizza tofu houmous'},
  {id:'viandes',  name:'Viandes & poissons',icon:'drumstick',   tone:'mem',   kw:'poulet boeuf bœuf steak haché porc veau agneau dinde saucisse côte escalope rôti viande poisson saumon cabillaud thon crevette moule colin merlu filet'},
  {id:'epicerie', name:'Épicerie',          icon:'wheat',       tone:'shop',  kw:'pâtes pates riz farine sucre sel poivre huile vinaigre moutarde ketchup mayonnaise sauce conserve lentille pois chiche semoule quinoa céréale cereale biscuit gâteau chocolat confiture miel pain de mie café thé tisane épice bouillon chips gâteaux apéro olive maïs sucette bonbon compote pâte à tartiner nutella levure'},
  {id:'boulangerie',name:'Boulangerie',     icon:'croissant',   tone:'shop',  kw:'pain baguette croissant brioche viennoiserie'},
  {id:'surgeles', name:'Surgelés',          icon:'snowflake',   tone:'plan',  kw:'surgelé surgele glace frites poêlée petits pois surgelés pizza surgelée nuggets'},
  {id:'boissons', name:'Boissons',          icon:'cup-soda',    tone:'plan',  kw:'eau jus soda coca limonade sirop vin bière biere lait d\'amande boisson'},
  {id:'hygiene',  name:'Hygiène & beauté',  icon:'droplets',    tone:'mem',   kw:'shampoing shampooing gel douche savon dentifrice brosse à dents déodorant coton rasoir crème mouchoir serviette hygiénique tampon maquillage'},
  {id:'entretien',name:'Maison & entretien',icon:'spray-can',   tone:'home',  kw:'lessive adoucissant liquide vaisselle pastille lave-vaisselle éponge sac poubelle essuie-tout papier toilette sopalin nettoyant javel vinaigre blanc ampoule pile aluminium film'},
  {id:'bebe',     name:'Bébé & enfants',    icon:'baby',        tone:'shop',  kw:'couche lingette petit pot biberon lait infantile'},
  {id:'autre',    name:'Autre',             icon:'package',     tone:'neutral', kw:''},
];
const aisleOf = id => AISLES.find(a => a.id === id) || AISLES[AISLES.length-1];
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
function guessAisle(name){
  const n = norm(name); if (!n) return 'autre';
  let best = 'autre', bestLen = 0;
  for (const a of AISLES) for (const k of a.kw.split(' ')) {
    const kk = norm(k); if (kk.length < 3) continue;
    const re = new RegExp('(^|[^a-z])' + kk.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(s|x|es)?($|[^a-z])');
    if (re.test(n) && kk.length > bestLen) { best = a.id; bestLen = kk.length; }
  }
  return best;
}

/* ---------- événements : répétitions ---------- */
function eventOn(e, ds){
  if (!e || !e.date) return false;
  if (ds < e.date) return false;
  if (e.until && ds > e.until) return false;
  const r = e.repeat || 'none';
  if (r === 'none') return ds === e.date || (e.endDate && ds <= e.endDate);
  if (r === 'daily') return true;
  if (r === 'weekly') return dow(ds) === dow(e.date);
  if (r === 'biweekly') return dow(ds) === dow(e.date) && mod(Math.round((idx(ds)-idx(e.date))/7),2) === 0;
  if (r === 'monthly') return ymd(ds)[2] === ymd(e.date)[2];
  if (r === 'yearly') return ds.slice(5) === e.date.slice(5);
  return false;
}
function eventsOn(ds){
  return [...S.events.values()].filter(e => eventOn(e, ds) && !(e.skip||[]).includes(ds))
    .sort((a,b) => (a.allDay?'':(a.start||'99')).localeCompare(b.allDay?'':(b.start||'99')));
}
const REPEATS = [['none','Une seule fois'],['daily','Tous les jours'],['weekly','Chaque semaine'],['biweekly','Une semaine sur deux'],['monthly','Chaque mois'],['yearly','Chaque année']];
const hm = t => t ? t.replace(':','h') : '';
const timeLabel = tm => !tm || !tm.at ? '' : (tm.mode === 'before' ? 'Avant ' + hm(tm.at) : hm(tm.at));
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
