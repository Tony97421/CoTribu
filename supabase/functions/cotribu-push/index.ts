// @ts-nocheck
// CoTribu — fonction serveur « cotribu-push »
// Envoie les rappels : le matin (tâches + événements du jour de chaque membre) et 1 h avant chaque événement.
// Prévient aussi les administrateurs (table admins) quand un utilisateur envoie « Une idée ? Un souci ? ».
// Rappel 30 min avant les tâches à heure fixe, avec un bouton « C'est fait ✓ » qui coche la tâche sans ouvrir l'app.
// Appelée toutes les 15 minutes par pg_cron (mode "tick"), ou depuis l'app (mode "test").
// Secrets à définir dans Supabase → Edge Functions → Secrets :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "https://tony97421.github.io/CoTribu/",
  Deno.env.get("VAPID_PUBLIC_KEY"),
  Deno.env.get("VAPID_PRIVATE_KEY"),
);

/* ---------- dates & récurrences (identiques à l'app) ---------- */
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, "0");
const idx = (ds) => { const [y, m, d] = ds.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
const fromIdx = (i) => { const d = new Date(i * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const addDays = (ds, n) => fromIdx(idx(ds) + n);
const dow = (ds) => (idx(ds) + 4) % 7;
const mondayOf = (ds) => addDays(ds, -((dow(ds) + 6) % 7));
const mod = (a, n) => ((a % n) + n) % n;
const ymd = (ds) => ds.split("-").map(Number);
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const hm = (t) => { if (!t) return ""; const [h, m] = String(t).split(":"); return `${+h}h${m && m !== "00" ? m : ""}`; };

function isOn(rec, ds) {
  if (!rec) return false;
  if (rec.type === "once") return ds === rec.date;
  if (rec.type === "weekly") {
    if (!(rec.days || []).includes(dow(ds))) return false;
    return mod(Math.floor((idx(ds) - idx(rec.anchor || ds)) / 7), rec.every || 1) === 0;
  }
  if (rec.type === "monthly") {
    const [y, m, d] = ymd(ds);
    if (rec.months && rec.months.length) { if (!rec.months.includes(m)) return false; }
    else { const [ay, am] = (rec.anchor || ds).split("-").map(Number); if (mod((y - ay) * 12 + (m - am), rec.every || 1) !== 0) return false; }
    const last = dim(y, m);
    if (rec.mode === "day") return d === Math.min(rec.day || 1, last);
    if (dow(ds) !== rec.weekday) return false;
    if (rec.nth === -1) return d + 7 > last;
    return Math.ceil(d / 7) === rec.nth;
  }
  return false;
}
function prevOcc(rec, before) { for (let i = 1; i < 400; i++) { const ds = addDays(before, -i); if (isOn(rec, ds)) return ds; } return null; }
// mode vacances (même règle que l'app) : pause rangée sur les fiches membres
function familyPause(members) {
  let p = null; for (const m of members.values()) if (m.pause && m.pause.from && m.pause.to && (!p || String(m.pause.at || "") > String(p.at || ""))) p = m.pause;
  return p && p.from <= p.to ? p : null;
}
function intervalDue(t, p) {
  let d = t.lastDone ? addDays(t.lastDone, t.rec.days) : (t.rec.anchor || t.createdAt);
  if (p && d >= p.from && d <= p.to && (!t.lastDone || t.lastDone < p.from)) d = addDays(d, idx(p.to) - idx(p.from) + 1);
  return d;
}
function dueToday(t, today, p) {
  if (t.rec.type === "once") return !t.lastDone && !!t.rec.date && t.rec.date <= today;
  if (p && today >= p.from && today <= p.to) return false;
  if (t.rec.type === "interval") return t.lastDone !== today && intervalDue(t, p) <= today;
  if (t.done && t.done[today]) return false;
  if (isOn(t.rec, today)) return true;
  if (t.carry) { const o = prevOcc(t.rec, today); let base = t.lastDone || addDays(t.createdAt || today, -1); if (p && p.to < today && p.to > base) base = p.to; return !!(o && o > base); }
  return false;
}
function assigneesOn(t, ds, members) {
  if (t.swap && t.swap[ds] && members.has(t.swap[ds])) return [t.swap[ds]]; // « je m'en occupe » pour ce jour-là
  const a = t.assign || { mode: "anyone" };
  const ids = (a.members || []).filter((id) => members.has(id));
  if (a.mode === "fixed") return ids;
  if (a.mode === "rotation" && ids.length) return [ids[mod(Math.floor((idx(ds) - idx(a.anchor || mondayOf(ds))) / 7), ids.length)]];
  return [];
}
// emploi du temps (fiche membre) : la personne est-elle au travail / à l'école à cette minute ?
function busyNow(h, memberId, ds, min) {
  const m = h.members.get(memberId); if (!m || !Array.isArray(m.schedule)) return false;
  return m.schedule.some((s) => {
    if (!(s.days || []).includes(dow(ds)) || !s.start || !s.end) return false;
    if (s.weeks && s.weeks !== "all" && s.abAnchor) { const even = mod(Math.round((idx(mondayOf(ds)) - idx(s.abAnchor)) / 7), 2) === 0; if (s.weeks === "A" ? !even : even) return false; }
    const t = (s.times && s.times[dow(ds)]) || s; // horaires propres à ce jour
    return toMin(t.start || s.start) <= min && toMin(t.end || s.end) > min;
  });
}
function eventOn(e, ds) {
  if (!e || !e.date || ds < e.date) return false;
  if ((e.skip || []).includes(ds)) return false;
  const r = e.repeat || "none";
  if (r === "none") return ds === e.date;
  if (r === "daily") return true;
  if (r === "weekly") return dow(ds) === dow(e.date);
  if (r === "biweekly") return dow(ds) === dow(e.date) && mod(Math.round((idx(ds) - idx(e.date)) / 7), 2) === 0;
  if (r === "monthly") return ymd(ds)[2] === ymd(e.date)[2];
  if (r === "yearly") return ds.slice(5) === e.date.slice(5);
  return false;
}
function localNow(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const frDate = (ds) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(idx(ds) * DAY));
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/* ---------- envoi ---------- */
async function send(sub, payload) {
  try { await webpush.sendNotification(sub.sub, JSON.stringify(payload), { TTL: 3600 }); return true; }
  catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from("push_subs").delete().eq("endpoint", sub.endpoint);
    else console.error("push error", e && e.statusCode, e && e.body);
    return false;
  }
}
/* ---------- bouton « C'est fait ✓ » dans la notification ---------- */
// lien signé (on ne peut cocher que CETTE tâche, pour CETTE personne, CE jour-là)
const enc = new TextEncoder();
let hmacKey = null;
async function sign(text) {
  hmacKey ||= await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("CRON_SECRET") || "cotribu"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, enc.encode(text)));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cotribu-push`;
async function doneAction(hid, taskId, memberId, date) {
  const sig = await sign(`${hid}|${taskId}|${memberId}|${date}`);
  return { actions: [{ action: "done", title: "C’est fait ✓" }], done: { url: FN_URL, key: Deno.env.get("SUPABASE_ANON_KEY") || "", h: hid, t: taskId, m: memberId, d: date, sig } };
}
async function markDone(b) {
  const { h, t, m, d, sig } = b || {};
  if (!h || !t || !m || !d || !sig || sig !== await sign(`${h}|${t}|${m}|${d}`)) return { error: "lien invalide" };
  if (Math.abs(idx(d) - idx(new Date().toISOString().slice(0, 10))) > 1) return { error: "trop tard" };
  const { data: rows } = await db.from("docs").select("col,id,data").eq("household_id", h).in("col", ["tasks", "members"]).in("id", [t, m]);
  const task = (rows || []).find((r) => r.col === "tasks" && r.id === t), mem = (rows || []).find((r) => r.col === "members" && r.id === m);
  if (!task) return { error: "tâche introuvable" };
  const td = { ...task.data }; td.done = { ...(td.done || {}) };
  if (td.done[d]) return { ok: true, name: td.name, already: true };
  td.done[d] = m;
  const keys = Object.keys(td.done).sort(); while (keys.length > 40) delete td.done[keys.shift()];
  if (!td.lastDone || d >= td.lastDone) { td.lastDone = d; td.lastBy = m; }
  await db.from("docs").upsert({ household_id: h, col: "tasks", id: t, data: td });
  if (mem) { // points + « qui le fait » (charge mentale), comme dans l'app
    const md = { ...mem.data }; const pts = td.points != null ? +td.points : 1;
    if (pts) { md.history = [{ t: "task", pts, d, at: new Date().toISOString(), label: td.name, taskId: t }, ...(md.history || [])].slice(0, 150); md.points = Math.max(0, (+md.points || 0) + pts); }
    const mk = d.slice(0, 7); md.mental = { ...(md.mental || {}) }; md.mental[mk] = { a: {}, f: 0, ...(md.mental[mk] || {}) }; md.mental[mk].f = (md.mental[mk].f || 0) + 1;
    await db.from("docs").upsert({ household_id: h, col: "members", id: m, data: md });
  }
  return { ok: true, name: td.name };
}

async function once(key) { // vrai si pas encore envoyé
  const { error } = await db.from("push_log").insert({ key });
  return !error;
}
async function loadHouseholds(ids) {
  const { data } = await db.from("docs").select("household_id,col,id,data").in("household_id", ids).in("col", ["members", "rooms", "tasks", "events", "proches", "requests"]);
  const H = {};
  for (const r of data || []) {
    const h = H[r.household_id] ||= { members: new Map(), rooms: new Map(), tasks: new Map(), events: new Map(), proches: new Map(), requests: new Map() };
    h[r.col].set(r.id, { ...r.data, id: r.id });
  }
  return H;
}

// un événement concerne-t-il cette personne ? (proche : seulement si invité ; famille : si concerné ou si personne n'est précisé)
function concerns(e, id) {
  if (id.startsWith("p-")) return (e.proches || []).includes(id);
  return !(e.members || []).length || e.members.includes(id);
}
const personName = (h, id) => ((h.members.get(id) || h.proches.get(id) || {}).name || "");

function morningMessage(h, memberId, today) {
  const name = personName(h, memberId);
  const tasks = [], taskIds = [], pause = familyPause(h.members);
  for (const t of (memberId.startsWith("p-") ? [] : h.tasks.values())) {
    if (!h.rooms.has(t.roomId) || !dueToday(t, today, pause)) continue;
    const a = assigneesOn(t, today, h.members);
    if (a.length && !a.includes(memberId)) continue;
    if (!a.length) continue; // « qui veut » : pas de rappel individuel
    tasks.push(t.name + (t.time && t.time.at ? ` (${t.time.mode === "before" ? "avant " : ""}${hm(t.time.at)})` : ""));
    taskIds.push(t.id);
  }
  const evs = [...h.events.values()].filter((e) => eventOn(e, today) && concerns(e, memberId))
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
    .map((e) => (e.start && !e.allDay ? `${hm(e.start)} ${e.title}` : e.title));
  if (!tasks.length && !evs.length) return null;
  const parts = [];
  if (tasks.length) parts.push(tasks.slice(0, 4).join(", ") + (tasks.length > 4 ? ` +${tasks.length - 4}` : ""));
  if (evs.length) parts.push(evs.slice(0, 3).join(" · "));
  const title = tasks.length
    ? `Bonjour ${name} ! ${tasks.length} ${tasks.length > 1 ? "tâches" : "tâche"} aujourd’hui`
    : `Bonjour ${name} ! Au programme aujourd’hui`;
  return { title, body: parts.join("\n"), tag: `morning-${today}`, url: "./", onlyTask: taskIds.length === 1 && !evs.length ? taskIds[0] : null };
}

// Nouveaux messages « Une idée ? Un souci ? » → notification aux administrateurs (table admins)
const FB_TITLE = { idee: "💡 Nouvelle idée", probleme: "🔧 Nouveau problème signalé", bravo: "💛 Nouveau bravo" };
async function notifyFeedback() {
  const { data: admins } = await db.from("admins").select("user_id");
  if (!admins || !admins.length) return 0;
  const { data: rows } = await db.from("feedback").select("id,kind,message,contact,created_at")
    .eq("traite", false).gt("created_at", new Date(Date.now() - 2 * DAY).toISOString()).order("created_at").limit(20);
  if (!rows || !rows.length) return 0;
  const { data: subs } = await db.from("push_subs").select("*").in("user_id", admins.map((a) => a.user_id));
  if (!subs || !subs.length) return 0;
  let sent = 0;
  for (const f of rows) {
    if (!(await once(`fb:${f.id}`))) continue;
    const text = String(f.message || "").replace(/\s+/g, " ");
    const payload = { title: FB_TITLE[f.kind] || "Nouveau message", body: (text.length > 140 ? text.slice(0, 140) + "…" : text) + (f.contact ? `\n✉️ ${f.contact}` : ""), tag: `fb-${f.id}`, url: "./" };
    for (const s of subs) if (await send(s, payload)) sent++;
  }
  return sent;
}

async function tick() {
  let fbSent = 0; try { fbSent = await notifyFeedback(); } catch (e) { console.error("feedback", e); }
  const { data: subs } = await db.from("push_subs").select("*");
  if (!subs || !subs.length) return { sent: fbSent };
  const H = await loadHouseholds([...new Set(subs.map((s) => s.household_id))]);
  let sent = 0;
  for (const s of subs) {
    const h = H[s.household_id]; if (!h || !s.member_id) continue;
    const now = localNow(s.tz);
    // Rappel du matin, entre 7h30 et 9h00 (une seule fois par jour)
    if (now.min >= 450 && now.min < 540) {
      const msg = morningMessage(h, s.member_id, now.date);
      if (msg && await once(`m:${s.endpoint}:${now.date}`)) {
        if (msg.onlyTask) Object.assign(msg, await doneAction(s.household_id, msg.onlyTask, s.member_id, now.date));
        delete msg.onlyTask;
        if (await send(s, msg)) sent++;
      }
    }
    // Tâche avec une heure (« à 18h » ou « avant 9h ») : rappel 30 min avant, à la personne concernée
    if (!s.member_id.startsWith("p-")) {
      const pause = familyPause(h.members);
      for (const t of h.tasks.values()) {
        if (!t.time || !t.time.at || !h.rooms.has(t.roomId) || !dueToday(t, now.date, pause)) continue;
        if (!assigneesOn(t, now.date, h.members).includes(s.member_id)) continue;
        const delta = toMin(t.time.at) - now.min;
        if (busyNow(h, s.member_id, now.date, now.min)) continue; // pas pendant le travail ou l'école : on réessaie au passage suivant
        if (delta > 0 && delta <= 35 && await once(`t:${s.endpoint}:${t.id}:${now.date}`)) {
          const body = t.time.mode === "before" ? `À faire avant ${hm(t.time.at)} · dans ${delta} min` : `Prévu à ${hm(t.time.at)} · dans ${delta} min`;
          if (await send(s, { title: t.name, body, tag: `task-${t.id}`, url: "./", ...(await doneAction(s.household_id, t.id, s.member_id, now.date)) })) sent++;
        }
      }
    }
    // 1 h avant chaque événement
    for (const e of h.events.values()) {
      if (e.allDay || !e.start || !eventOn(e, now.date)) continue;
      if (!concerns(e, s.member_id)) continue;
      const delta = toMin(e.start) - now.min;
      if (delta > 0 && delta <= 65) {
        if (await once(`e:${s.endpoint}:${e.id}:${now.date}`)) {
          if (await send(s, { title: `${e.title} à ${hm(e.start)}`, body: e.place ? `Dans ${delta} min · ${e.place}` : `Dans ${delta} min`, tag: `ev-${e.id}`, url: "./" })) sent++;
        }
      }
    }
  }
  // ménage du journal (plus de 3 jours)
  await db.from("push_log").delete().lt("sent_at", new Date(Date.now() - 3 * DAY).toISOString());
  return { sent: sent + fbSent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body = {};
  try { body = await req.json(); } catch (_) { /* vide */ }

  if (body.mode === "test") {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u || !u.user) return json({ error: "non connecté" }, 401);
    const { data: subs } = await db.from("push_subs").select("*").eq("user_id", u.user.id);
    let sent = 0;
    for (const s of subs || []) if (await send(s, { title: "CoTribu", body: "Les rappels fonctionnent sur ce téléphone.", tag: "test", url: "./" })) sent++;
    return json({ sent });
  }

  // « C'est fait ✓ » touché dans une notification (lien signé, sans connexion)
  if (body.mode === "done") return json(await markDone(body));

  // Un utilisateur vient d'envoyer un avis : on prévient tout de suite les administrateurs
  if (body.mode === "feedback") {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u || !u.user) return json({ error: "non connecté" }, 401);
    return json({ sent: await notifyFeedback() });
  }

  // Messages liés aux demandes de garde (envoyés par l'app après une action)
  if (body.mode === "notify") {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u || !u.user) return json({ error: "non connecté" }, 401);
    const hid = body.household;
    const { data: hu } = await db.from("household_users").select("role,member_id").eq("household_id", hid).eq("user_id", u.user.id).maybeSingle();
    if (!hu) return json({ error: "interdit" }, 403);
    const H = await loadHouseholds([hid]); const h = H[hid]; if (!h) return json({ sent: 0 });
    const r = h.requests.get(body.id); if (!r) return json({ sent: 0 });
    const when = `${frDate(r.date)}${r.allDay || !r.start ? "" : ` ${hm(r.start)}${r.end ? "-" + hm(r.end) : ""}`}`;
    const { data: subs } = await db.from("push_subs").select("*").eq("household_id", hid);
    let targets = [], payload;
    if (body.kind === "request" && hu.role === "member") {
      targets = (subs || []).filter((s) => (r.to || []).includes(s.member_id));
      payload = { title: `Demande de ${personName(h, r.by) || "la famille"}`, body: `${r.title} · ${when}${r.place ? " · " + r.place : ""}`, tag: `req-${r.id}`, url: "./" };
    } else if (body.kind === "response" && hu.role === "proche") {
      const resp = (r.responses || {})[hu.member_id] || {};
      const who = personName(h, hu.member_id) || "Un proche";
      const verb = resp.answer === "accept" ? "a accepté" : resp.answer === "decline" ? "ne peut pas" : "propose un autre créneau";
      targets = (subs || []).filter((s) => s.member_id && !s.member_id.startsWith("p-"));
      payload = { title: `${who} ${verb}`, body: `${r.title} · ${when}${resp.note ? " · « " + resp.note + " »" : ""}`, tag: `resp-${r.id}`, url: "./" };
    } else return json({ sent: 0 });
    let sent = 0;
    for (const s of targets) if (await send(s, payload)) sent++;
    return json({ sent });
  }

  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "interdit" }, 403);
  return json(await tick());
});
