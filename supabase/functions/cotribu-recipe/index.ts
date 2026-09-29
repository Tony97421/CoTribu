// @ts-nocheck
// CoTribu — fonction serveur « cotribu-recipe »
// Lit une page de recette (Marmiton, 750g, Cuisine AZ, Journal des Femmes, CuisineActuelle…) et renvoie
// son nom et ses ingrédients, grâce aux données « Recipe » que ces sites publient pour Google (schema.org).
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
function extract(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocks) {
    let data; try { data = JSON.parse(b.trim()); } catch { try { data = JSON.parse(b.trim().replace(/[\u0000-\u001f]+/g, " ")); } catch { continue; } }
    const r = findRecipe(data);
    if (!r) continue;
    const ingr = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : []).map(decode).filter(Boolean);
    if (!ingr.length) continue;
    let image = r.image; if (Array.isArray(image)) image = image[0]; if (image && typeof image === "object") image = image.url;
    const y = r.recipeYield; const servings = decode(Array.isArray(y) ? y[0] : y);
    return { name: decode(r.name), ingredients: ingr.slice(0, 60), image: typeof image === "string" ? image : "", servings };
  }
  return null;
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
    return json(r ? { recipe: r } : { error: "pas_de_recette" });
  } catch (e) {
    return json({ error: "page_inaccessible", detail: String(e && e.message || e) }, 200);
  }
});
