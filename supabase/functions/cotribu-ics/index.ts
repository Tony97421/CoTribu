// @ts-nocheck
// CoTribu — fonction serveur « cotribu-ics »
// Publie le planning du foyer au format agenda (.ics) pour Google Agenda, Apple Calendrier, Outlook…
// Lien privé : .../functions/v1/cotribu-ics?t=<jeton du foyer>[&m=<id membre pour « mes événements »>]
// À déployer avec « Verify JWT » désactivé (Google Agenda ne peut pas envoyer de jeton).
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const d8 = (ds) => ds.replace(/-/g, "");
const t6 = (t) => t.replace(":", "") + "00";
function fold(line) { // lignes de 75 octets max (norme iCalendar)
  const out = []; let cur = "";
  for (const ch of line) { if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = " " + ch; } else cur += ch; }
  out.push(cur); return out.join("\r\n");
}
const addDay = (ds) => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const RRULE = { daily: "FREQ=DAILY", weekly: "FREQ=WEEKLY", biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY" };
const CATS = { famille: "Famille / Sorties", sante: "Santé / Rendez-vous", repas: "Repas", ecole: "École / Activités", maison: "Maison", garde: "Garde / Proches", autre: "Autre" };

const VTZ = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const onlyMember = url.searchParams.get("m") || "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Lien invalide", { status: 404 });

  const { data: sec } = await db.from("household_secrets").select("household_id").eq("ics_token", token).maybeSingle();
  if (!sec) return new Response("Lien invalide ou remplacé", { status: 404 });
  const hid = sec.household_id;
  const [{ data: hh }, { data: docs }] = await Promise.all([
    db.from("households").select("name").eq("id", hid).maybeSingle(),
    db.from("docs").select("col,id,data").eq("household_id", hid).in("col", ["events", "members", "proches"]),
  ]);
  const names = new Map();
  const events = [];
  for (const r of docs || []) {
    if (r.col === "events") events.push({ ...r.data, id: r.id });
    else names.set(r.id, r.data.name);
  }
  const who = onlyMember ? names.get(onlyMember) : "";
  const calName = `CoTribu · ${hh ? hh.name : "Famille"}${who ? " · " + who : ""}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CoTribu//Planning familial//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`, "X-WR-TIMEZONE:Europe/Paris", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H", ...VTZ];

  for (const e of events) {
    if (!e.date || !e.title) continue;
    if (onlyMember && (e.members || []).length && !(e.members || []).includes(onlyMember) && !(e.proches || []).includes(onlyMember)) continue;
    const people = [...(e.members || []), ...(e.proches || [])].map((id) => names.get(id)).filter(Boolean);
    L.push("BEGIN:VEVENT", `UID:${e.id}@cotribu`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(e.title)}`);
    if (e.allDay || !e.start) {
      L.push(`DTSTART;VALUE=DATE:${d8(e.date)}`, `DTEND;VALUE=DATE:${d8(addDay(e.endDate || e.date))}`);
    } else {
      const end = e.end && e.end > e.start ? e.end : e.start.replace(/^(\d\d)/, (h) => String(Math.min(23, +h + 1)).padStart(2, "0"));
      L.push(`DTSTART;TZID=Europe/Paris:${d8(e.date)}T${t6(e.start)}`, `DTEND;TZID=Europe/Paris:${d8(e.date)}T${t6(end)}`);
    }
    if (RRULE[e.repeat]) {
      L.push(`RRULE:${RRULE[e.repeat]}${e.until ? ";UNTIL=" + d8(e.until) : ""}`);
      for (const sk of e.skip || []) L.push(e.allDay || !e.start ? `EXDATE;VALUE=DATE:${d8(sk)}` : `EXDATE;TZID=Europe/Paris:${d8(sk)}T${t6(e.start)}`);
    }
    if (e.place) L.push(`LOCATION:${esc(e.place)}`);
    const desc = [people.length ? "Avec : " + people.join(", ") : "", e.note || ""].filter(Boolean).join("\n");
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
    L.push(`CATEGORIES:${esc(CATS[e.cat] || "Autre")}`, "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return new Response(L.map(fold).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=900", "Content-Disposition": 'inline; filename="cotribu.ics"' },
  });
});
