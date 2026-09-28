// @ts-nocheck
// CoTribu — fonction serveur « cotribu-ai » (réservée aux foyers Premium, sauf la création de la maison)
// Modes : parse (phrase ou photo → ajouts), menus, balance (répartition), setup (maison auto), album
// Secrets : GEMINI_API_KEY (Google AI Studio) et/ou ANTHROPIC_API_KEY ; AI_PROVIDER = gemini | claude (facultatif), GEMINI_MODEL (facultatif). À déployer avec « Verify JWT » désactivé (la fonction vérifie elle-même l'utilisateur).
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5-20251001";
const MONTHLY_LIMIT = 300;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const AISLES = ["fruits", "frais", "viandes", "epicerie", "boulangerie", "surgeles", "boissons", "hygiene", "entretien", "bebe", "autre"];
const CATS = ["famille", "sante", "repas", "ecole", "maison", "garde", "autre"];
const ROOM_ICONS = ["house", "cooking-pot", "sofa", "bath", "toilet", "bed-double", "baby", "washing-machine", "sprout", "trees", "shirt", "armchair", "book-open", "car", "package", "sparkles"];
const S = (description, extra = {}) => ({ type: "string", description, ...extra });
const I = (description) => ({ type: "integer", description });
const ingredients = { type: "array", items: { type: "object", properties: { name: S("ingrédient"), qty: S("quantité, ex. 500 g, 6, 1 brique") }, required: ["name"] } };
const recFields = {
  rec_type: S("weekly = jours fixes, monthly = chaque mois, interval = après un délai depuis la dernière fois", { enum: ["weekly", "monthly", "interval"] }),
  weekdays: { type: "array", items: { type: "integer" }, description: "pour weekly : 0=dimanche, 1=lundi … 6=samedi" },
  every_weeks: I("pour weekly : 1 = chaque semaine, 2 = une semaine sur deux"),
  month_nth: I("pour monthly : 1 = premier, 2, 3, 4, -1 = dernier"),
  month_weekday: I("pour monthly : jour de la semaine 0=dimanche … 6=samedi"),
  interval_days: I("pour interval : nombre de jours"),
  assign_mode: S("fixed = toujours les mêmes, rotation = chacun son tour chaque semaine, anyone = qui veut", { enum: ["fixed", "rotation", "anyone"] }),
  member_ids: { type: "array", items: { type: "string" }, description: "identifiants des membres concernés" },
  time: S("heure HH:MM si précisée"),
  time_mode: S("at = à cette heure, before = avant cette heure", { enum: ["at", "before"] }),
};

const TOOLS = {
  parse: {
    name: "proposer_ajouts",
    description: "Transforme la demande en éléments à ajouter dans l'app familiale.",
    input_schema: {
      type: "object",
      properties: {
        message: S("une phrase courte en français résumant ce qui va être ajouté, ou expliquant pourquoi rien n'a été compris"),
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: S("event = rendez-vous/activité au planning, item = article de courses, task = tâche ménagère récurrente, meal = repas", { enum: ["event", "item", "task", "meal"] }),
              title: S("titre de l'événement, nom de l'article, de la tâche ou du plat"),
              date: S("YYYY-MM-DD (événement ou repas)"), start: S("HH:MM"), end: S("HH:MM"), all_day: { type: "boolean" },
              repeat: S("répétition de l'événement", { enum: ["none", "daily", "weekly", "biweekly", "monthly", "yearly"] }),
              category: S("catégorie de l'événement", { enum: CATS }),
              place: S("lieu"), note: S("note utile"),
              qty: S("quantité de l'article"), aisle: S("rayon de l'article", { enum: AISLES }),
              room_id: S("pièce de la tâche (identifiant fourni)"),
              slot: S("repas : midi ou soir", { enum: ["midi", "soir"] }),
              ingredients,
              ...recFields,
            },
            required: ["kind", "title"],
          },
        },
      },
      required: ["message", "actions"],
    },
  },
  menus: {
    name: "proposer_menus",
    description: "Propose les repas demandés avec leurs ingrédients.",
    input_schema: {
      type: "object",
      properties: {
        message: S("une phrase courte de présentation"),
        meals: { type: "array", items: { type: "object", properties: { date: S("YYYY-MM-DD"), slot: S("midi ou soir", { enum: ["midi", "soir"] }), name: S("nom du plat"), ingredients }, required: ["date", "slot", "name", "ingredients"] } },
      },
      required: ["message", "meals"],
    },
  },
  balance: {
    name: "proposer_repartition",
    description: "Analyse la répartition des tâches et propose des changements concrets.",
    input_schema: {
      type: "object",
      properties: {
        message: S("2 à 4 phrases bienveillantes en français : le constat chiffré et l'idée principale"),
        changes: { type: "array", items: { type: "object", properties: { task_id: S("identifiant de la tâche"), assign_mode: S("", { enum: ["fixed", "rotation", "anyone"] }), member_ids: { type: "array", items: { type: "string" } }, reason: S("raison courte") }, required: ["task_id", "assign_mode", "member_ids", "reason"] } },
      },
      required: ["message", "changes"],
    },
  },
  setup: {
    name: "creer_maison",
    description: "Crée les pièces et les routines ménagères adaptées au foyer décrit.",
    input_schema: {
      type: "object",
      properties: {
        rooms: { type: "array", items: { type: "object", properties: { key: S("identifiant court sans espace"), name: S("nom de la pièce"), icon: S("icône", { enum: ROOM_ICONS }) }, required: ["key", "name", "icon"] } },
        tasks: { type: "array", items: { type: "object", properties: { room_key: S("clé de la pièce"), name: S("tâche"), carry: { type: "boolean", description: "vrai si elle doit rester en retard tant qu'elle n'est pas faite (tâches rares)" }, ...recFields }, required: ["room_key", "name", "rec_type", "assign_mode"] } },
      },
      required: ["rooms", "tasks"],
    },
  },
  album: {
    name: "ecrire_album",
    description: "Écrit l'album de l'année de la famille à partir de ses souvenirs.",
    input_schema: {
      type: "object",
      properties: {
        title: S("titre de l'album, ex. Notre année 2026"),
        intro: S("2 ou 3 phrases chaleureuses d'introduction"),
        chapters: { type: "array", items: { type: "object", properties: { month: I("1 à 12"), title: S("titre court du chapitre"), text: S("2 à 4 phrases"), memory_ids: { type: "array", items: { type: "string" } } }, required: ["month", "title", "text", "memory_ids"] } },
        ending: S("une phrase de conclusion"),
      },
      required: ["title", "intro", "chapters", "ending"],
    },
  },
};

const BASE = `Tu es l'assistant de CoTribu, une application française d'organisation familiale. Tu réponds uniquement en appelant l'outil fourni. Écris en français, simplement, avec les majuscules et accents corrects. N'invente jamais d'identifiant : utilise uniquement ceux fournis.`;
function contextBlock(ctx) {
  return `Aujourd'hui : ${ctx.todayLabel} (${ctx.today}), fuseau Europe/Paris.
Membres du foyer (identifiant : prénom) : ${(ctx.members || []).map((m) => `${m.id} : ${m.name}`).join(" ; ") || "aucun"}.
Pièces (identifiant : nom) : ${(ctx.rooms || []).map((r) => `${r.id} : ${r.name}`).join(" ; ") || "aucune"}.`;
}
const PROMPTS = {
  parse: (ctx) => `${BASE}
${contextBlock(ctx)}
Règles :
- Un rendez-vous, une activité, un anniversaire → kind=event (dates relatives calculées à partir d'aujourd'hui ; « tous les mercredis » → repeat=weekly et date = prochain mercredi ; anniversaire → repeat=yearly, all_day=true).
- Des produits à acheter → un kind=item par produit, avec qty et aisle.
- Une tâche ménagère qui revient → kind=task avec room_id le plus logique et sa récurrence.
- Un plat pour un repas → kind=meal avec ingrédients.
- Associe les prénoms cités aux identifiants des membres (member_ids).
- Sur une photo de document (mot de l'école, calendrier, programme) : extrais chaque date utile comme événement. Sur une photo de recette ou de liste : extrais les ingrédients comme articles.
- Si rien n'est exploitable, renvoie actions vide et explique-le dans message.`,
  menus: (ctx) => `${BASE}
${contextBlock(ctx)}
Propose des repas familiaux variés, réalistes et de saison, avec des ingrédients en quantités pour ${ctx.people || 4} personnes. Respecte strictement les préférences données. N'utilise que les dates et moments demandés.`,
  balance: (ctx) => `${BASE}
${contextBlock(ctx)}
On te donne les tâches du foyer (fréquence, attribution actuelle) et qui les a réellement faites ces 30 derniers jours. Repère les déséquilibres et propose au maximum 5 changements concrets (passer en « chacun son tour », changer de personne…). Tiens compte que les jeunes enfants ne peuvent pas tout faire. Sois bienveillant, jamais culpabilisant.`,
  setup: (ctx) => `${BASE}
${contextBlock(ctx)}
Crée entre 5 et 10 pièces et 25 à 45 routines ménagères réalistes pour ce foyer, bien réparties sur la semaine (pas tout le même jour). Utilise des récurrences variées : quotidiennes, hebdomadaires, une semaine sur deux, mensuelles (vitres, frigo), et « après un délai » pour les tâches flexibles. Les tâches rares ont carry=true. Répartis entre les adultes (member_ids) avec des tours de rôle ; donne aux enfants des tâches adaptées à leur âge si l'âge est indiqué, sinon laisse « anyone ».`,
  album: (ctx) => `${BASE}
Écris l'album de l'année de la famille « ${ctx.householdName || "notre famille"} » à partir de ses souvenirs. Ton chaleureux, simple, sans exagération ni mièvrerie. Ne cite que des faits présents dans les souvenirs. Un chapitre par mois qui contient des souvenirs, avec leurs identifiants.`,
};

// Fournisseur d'IA : AI_PROVIDER = "gemini" ou "claude" (par défaut : gemini si GEMINI_API_KEY existe, sinon claude)
function provider() {
  const p = (Deno.env.get("AI_PROVIDER") || "").toLowerCase();
  if (p === "gemini" || p === "claude") return p;
  return Deno.env.get("GEMINI_API_KEY") ? "gemini" : "claude";
}
async function ask(system, content, tool) {
  return provider() === "gemini" ? gemini(system, content, tool) : claude(system, content, tool);
}

async function gemini(system, content, tool) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw Object.assign(new Error("ia_non_configuree"), { status: 503 });
  // On essaie plusieurs modèles : si l'un n'a pas de quota gratuit ou est surchargé, on passe au suivant.
  const models = [...new Set([Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(Boolean))];
  const parts = content.map((c) => c.type === "image"
    ? { inline_data: { mime_type: c.source.media_type, data: c.source.data } }
    : { text: c.text });
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    tools: [{ functionDeclarations: [{ name: tool.name, description: tool.description, parameters: tool.input_schema }] }],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [tool.name] } },
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
  });
  let last = { status: 0, text: "" };
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body,
    });
    if (res.ok) {
      const data = await res.json();
      const fc = (((data.candidates || [])[0] || {}).content || {}).parts?.find((p) => p.functionCall);
      if (fc) return fc.functionCall.args || {};
      last = { status: 200, text: `${model} : réponse sans résultat (${JSON.stringify(data).slice(0, 200)})` };
      continue;
    }
    const t = await res.text();
    console.error("gemini", model, res.status, t);
    last = { status: res.status, text: `${model} : ${t.slice(0, 300)}` };
    if (![404, 429, 500, 503].includes(res.status)) break; // clé invalide, requête refusée… : inutile d'insister
  }
  const code = last.status === 429 ? "ia_quota" : last.status === 503 ? "ia_occupee" : (last.status === 400 || last.status === 403) && /API key|PERMISSION|API_KEY/i.test(last.text) ? "ia_cle" : "ia_erreur";
  throw Object.assign(new Error(code), { status: 502, detail: last.text });
}

async function claude(system, content, tool) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw Object.assign(new Error("ia_non_configuree"), { status: 503 });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("anthropic", res.status, t);
    throw Object.assign(new Error(res.status === 429 || res.status === 529 ? "ia_occupee" : res.status === 400 && /credit/i.test(t) ? "ia_credit" : "ia_erreur"), { status: 502 });
  }
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use");
  if (!block) throw Object.assign(new Error("ia_erreur"), { status: 502 });
  return block.input;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u || !u.user) return json({ error: "non_connecte" }, 401);
    const hid = body.household;
    const { data: hu } = await db.from("household_users").select("role").eq("household_id", hid).eq("user_id", u.user.id).maybeSingle();
    if (!hu || hu.role !== "member") return json({ error: "pas_membre" }, 403);
    const mode = body.mode;
    if (!TOOLS[mode]) return json({ error: "mode_inconnu" }, 400);

    const { data: hh } = await db.from("households").select("name,premium_until,created_at").eq("id", hid).maybeSingle();
    const premium = hh && hh.premium_until && new Date(hh.premium_until) > new Date();
    const month = new Date().toISOString().slice(0, 7);
    if (mode === "setup") {
      // gratuit une fois, à la création du foyer
      const { data: used } = await db.from("ai_usage").select("calls").eq("household_id", hid).eq("month", "setup").maybeSingle();
      if (used && used.calls >= 2 && !premium) return json({ error: "premium_requis" }, 402);
    } else if (!premium) return json({ error: "premium_requis" }, 402);

    const usageKey = mode === "setup" ? "setup" : month;
    const { data: usage } = await db.from("ai_usage").select("calls").eq("household_id", hid).eq("month", usageKey).maybeSingle();
    const calls = usage ? usage.calls : 0;
    if (mode !== "setup" && calls >= MONTHLY_LIMIT) return json({ error: "limite_mensuelle" }, 429);

    const ctx = { ...(body.context || {}), householdName: hh && hh.name };
    const content = [];
    if (body.image && typeof body.image === "string" && body.image.length < 6_000_000) {
      content.push({ type: "image", source: { type: "base64", media_type: body.imageType || "image/jpeg", data: body.image } });
    }
    content.push({ type: "text", text: String(body.input || "").slice(0, 20000) || "Analyse cette image." });

    const result = await ask(PROMPTS[mode](ctx), content, TOOLS[mode]);
    await db.from("ai_usage").upsert({ household_id: hid, month: usageKey, calls: calls + 1 });
    return json({ result, used: calls + 1, limit: MONTHLY_LIMIT });
  } catch (e) {
    console.error(e);
    return json({ error: e.message || "ia_erreur", detail: e.detail || "" }, e.status || 500);
  }
});
