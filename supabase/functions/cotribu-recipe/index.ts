// @ts-nocheck
// CoTribu — fonction serveur « cotribu-recipe »
// Lit une page de recette (Marmiton, 750g, Cuisine AZ, Journal des Femmes, CuisineActuelle…) et renvoie
// son nom, ses ingrédients et ses étapes, grâce aux données « Recipe » que ces sites publient pour Google (schema.org),
// avec des méthodes de secours pour les sites qui ne les publient pas (Next.js, microdonnées, texte de la page).
// À déployer avec « Verify JWT » désactivé : la fonction vérifie elle-même que l'appel vient d'un utilisateur connecté de l'app.
// Aucun secret à ajouter.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

// refuse les adresses internes (sécurité)
function publicUrl(raw) {
  let u; try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":") || !h.includes(".")) return null;
  return u;
}
const ENT = { eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", icirc: "î", iuml: "ï", ugrave: "ù", ucirc: "û", oelig: "œ", Eacute: "É", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", hellip: "…" };
const decode = (s) => String(s || "")
  .replace(/&([a-zA-Z]+\d*);/g, (m, n) => ENT[n] ?? m).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function findRecipe(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const t = node["@type"]; const types = Array.isArray(t) ? t : [t];
  if (types.includes("Recipe")) return node;
  for (const k of ["@graph", "mainEntity", "itemListElement"]) if (node[k]) { const r = findRecipe(node[k]); if (r) return r; }
  return null;
}
// étapes : texte, liste de textes, HowToStep {text}, HowToSection {name, itemListElement}
function stepsOf(ins) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === "string") { decode(x).split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/).map((t) => t.replace(/^\d+[.)]\s*/, "").trim()).filter((t) => t.length > 2).forEach((t) => out.push(t)); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === "object") {
      if (x.itemListElement) { if (x.name) out.push(`— ${decode(x.name)}`); walk(x.itemListElement); return; }
      const t = decode(x.text || x.name || x.description || ""); if (t) out.push(t);
    }
  };
  walk(ins);
  return out.filter((t, k) => t && out.indexOf(t) === k).slice(0, 40);
}
function isoMin(d) { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(d || "")); return m ? (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; }
const meta = (html, prop) => decode((new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)`, "i").exec(html) || [])[1] || "");

// 1) données « Recipe » pour Google (la plupart des sites)
function fromJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocks) {
    let data; try { data = JSON.parse(b.trim()); } catch { try { data = JSON.parse(b.trim().replace(/[\u0000-\u001f]+/g, " ")); } catch { continue; } }
    const r = findRecipe(data);
    if (!r) continue;
    const ingr = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : []).map(decode).filter(Boolean);
    if (!ingr.length) continue;
    let image = r.image; if (Array.isArray(image)) image = image[0]; if (image && typeof image === "object") image = image.url;
    const y = r.recipeYield; const servings = decode(Array.isArray(y) ? y[0] : y);
    const time = isoMin(r.totalTime) || isoMin(r.prepTime) + isoMin(r.cookTime);
    return { name: decode(r.name), ingredients: ingr.slice(0, 60), steps: stepsOf(r.recipeInstructions), image: typeof image === "string" ? image : "", servings, time };
  }
  return null;
}
// 2) sites en Next.js : on cherche un objet qui a des ingrédients et des étapes
function itemText(x) {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return decode(String(x));
  if (typeof x !== "object") return "";
  const nm = (v) => typeof v === "object" && v ? (v.name || v.label || v.title || "") : (v || "");
  const q = [x.quantity ?? x.amount ?? x.qty ?? "", nm(x.unit)].filter((v) => v !== "" && v != null).join(" ");
  const n = nm(x.ingredient) || x.name || x.label || x.title || x.text || x.description || "";
  return decode([q, typeof n === "string" ? n : ""].filter(Boolean).join(" "));
}
function fromNextData(html) {
  const m = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html); if (!m) return null;
  let data; try { data = JSON.parse(m[1]); } catch { return null; }
  let best = null, seen = 0;
  const walk = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 14 || ++seen > 60000 || best) return;
    if (!Array.isArray(o)) {
      const ing = o.ingredients || o.constituents || o.recipeIngredient;
      const st = o.directions || o.steps || o.instructions || o.recipeInstructions;
      if (Array.isArray(ing) && ing.length && Array.isArray(st) && st.length) {
        const ingredients = ing.map(itemText).filter(Boolean), steps = st.map((x) => typeof x === "object" && x ? itemText({ text: x.text || x.label || x.description || x.name }) : itemText(x)).filter((t) => t && t.length > 3);
        if (ingredients.length) { best = { name: decode(o.title || o.name || ""), ingredients: ingredients.slice(0, 60), steps: steps.slice(0, 40), image: "", servings: "", time: +(o.preparationTime || 0) + +(o.cookingTime || 0) || 0 }; return; }
      }
    }
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, depth + 1);
  };
  walk(data, 0);
  return best;
}
// 3) microdonnées (itemprop) des sites plus anciens
function fromMicrodata(html) {
  const grab = (prop) => [...html.matchAll(new RegExp(`<[^>]+itemprop=["']${prop}["'][^>]*>([\\s\\S]*?)</(li|p|span|div)>`, "gi"))].map((m) => decode(m[1])).filter(Boolean);
  const ingredients = [...grab("recipeIngredient"), ...grab("ingredients")];
  if (!ingredients.length) return null;
  return { name: "", ingredients: ingredients.slice(0, 60), steps: grab("recipeInstructions").slice(0, 40), image: "", servings: "", time: 0 };
}
// 4) dernier recours : on lit le texte de la page entre « Ingrédients » et « Préparation »
function fromText(html) {
  const txt = html.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(p|li|div|h\d|tr|td|section|article|ul|ol|dl|dt|dd|button|title|header|nav|main|aside|footer|table|tbody|body|html|figure|figcaption)\b[^>]*>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  const lines = txt.split("\n").map(decode).map((l) => l.trim()).filter(Boolean);
  const isH = (l, re) => l.length < 40 && re.test(l);
  const iStart = lines.findIndex((l) => isH(l, /^ingr[ée]dients?\b/i));
  if (iStart < 0) return null;
  const sRe = /^(pr[ée]paration|[ée]tapes?|instructions|directions|recette|la recette|m[ée]thode|steps?|method)\b/i;
  const stopRe = /^(ustensiles|mat[ée]riel|nutrition|valeurs nutritionnelles|avis|commentaires|vous aimerez|partager|recettes? similaires|[àa] d[ée]couvrir|t[ée]l[ée]charge|footer|©)/i;
  const QTY = /^[\d½¼¾,.\/\s]+(g|kg|mg|ml|cl|dl|l|c\.?\s?[àa]\s?[sc]\.?|cs|cc|pinc[ée]e?s?|pièces?|tranches?|gousses?|x)?\.?$/i;
  const ingredients = []; let k = iStart + 1;
  for (; k < lines.length && ingredients.length < 60; k++) {
    const l = lines[k];
    if (isH(l, sRe) || isH(l, stopRe)) break;
    if (l.length > 90) continue;
    if (QTY.test(l) && ingredients.length) { ingredients[ingredients.length - 1] = `${l} ${ingredients[ingredients.length - 1]}`; continue; }
    if (/^\d+\s*(personnes?|portions?|pers\.?)$/i.test(l)) continue;
    ingredients.push(l);
  }
  if (ingredients.length < 2) return null;
  const sStart = lines.findIndex((l, n) => n >= k - 1 && isH(l, sRe));
  const steps = [];
  if (sStart >= 0) for (let n = sStart + 1; n < lines.length && steps.length < 40; n++) {
    const l = lines[n];
    if (isH(l, stopRe)) break;
    if (/^(étape|etape|step)\s*\d+\s*:?$/i.test(l) || /^\d+$/.test(l)) continue;
    const t = l.replace(/^(étape|etape|step)\s*\d+\s*[:.\-]\s*/i, "");
    if (t.length >= 12) steps.push(t);
  }
  return { name: "", ingredients, steps, image: "", servings: "", time: 0 };
}
function extract(html) {
  const r = fromJsonLd(html) || fromNextData(html) || fromMicrodata(html) || fromText(html);
  if (!r) return null;
  r.name = r.name || meta(html, "og:title") || decode((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "");
  r.image = r.image || meta(html, "og:image");
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = jwt ? await db.auth.getUser(jwt) : { data: null };
  if (!who || !who.user) return json({ error: "non_connecte" }, 401);
  let body = {}; try { body = await req.json(); } catch { /* vide */ }
  const u = publicUrl(body.url);
  if (!u) return json({ error: "lien_invalide" }, 400);
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(u.href, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36", "Accept-Language": "fr-FR,fr;q=0.9", "Accept": "text/html" } });
    clearTimeout(timer);
    if (!res.ok) return json({ error: "page_inaccessible", status: res.status }, 200);
    // on lit au plus 3 Mo
    const reader = res.body.getReader(); const chunks = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; if (size > 3e6) { try { reader.cancel(); } catch { /* */ } break; } }
    const all = new Uint8Array(size); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const html = new TextDecoder().decode(all);
    const r = extract(html);
    if (r) r.url = res.url || u.href;
    return json(r ? { recipe: r } : { error: "pas_de_recette" });
  } catch (e) {
    return json({ error: "page_inaccessible", detail: String(e && e.message || e) }, 200);
  }
});
