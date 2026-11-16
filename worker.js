// Apple Music artist logos for Spotify: Cloudflare Worker (the free plan is enough).
//   GET /logo?name=Eminem                    -> the artist's Apple Music logo as an image (404 if there is none)
//   GET /logo?name=Eminem&link=<Apple page>  -> same, without the iTunes search (the extension does it from your computer)
//   add &debug=1 for a JSON diagnostic: code version, template found, result of each image attempt
const VERSION = 4; // shown in debug mode so you can check that the right code is deployed
const COUNTRY = "fr"; // two-letter country code of the Apple Music store used for the artist search
const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36" };
const ITUNES = `https://itunes.apple.com/search?entity=musicArtist&country=${COUNTRY}&limit=5&term=`;
const LOGO_URL = /https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\/[^"'\s,\\]+/;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-private-network": "true" };
const SIZES = [[1200, 480], [800, 320], [400, 133]];
const STYLES = [["bb", "png"], ["bb", "webp"], ["bb", "jpg"], ["bb-60", "webp"], ["bb-60", "jpg"]]; // png/webp keep transparency
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// cf: Cloudflare caches Apple's answers for 24 h, so each artist is only looked up once
const get = u => fetch(u, { headers: UA, cf: { cacheEverything: true, cacheTtl: 86400 } });

// Image template of the logo: first image URL right after `"artistLogo":{` in the page (both URL styles Apple uses).
// "artistLogo":null or a missing key means no logo. No JSON.parse: the page is huge and the free plan allows only 10 ms of CPU per request.
function logoTemplate(html) {
  const i = html.indexOf('"artistLogo":{');
  const u = i < 0 ? null : html.slice(i, i + 1500).match(LOGO_URL)?.[0];
  return u && (u.includes("{w}") ? u : u.replace(/\/[^/]*$/, "/{w}x{h}bb.{f}"));
}

// The iTunes search is rate-limited per IP address, and Cloudflare's addresses are shared: it sometimes answers "Rate limit".
async function findArtist(name) {
  const r = await get(ITUNES + encodeURIComponent(name));
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`iTunes search: HTTP ${r.status}, response "${text.slice(0, 60)}"`); }
  return json.results.find(a => norm(a.artistName) === norm(name)); // exact name only: no logo rather than the wrong logo
}

// The link sent by the extension is only accepted if it points to a music.apple.com page
function appleLink(link) {
  try { const u = new URL(link); return u.protocol === "https:" && u.hostname === "music.apple.com" ? u.href : null; } catch { return null; }
}

// Tries several sizes/formats: the first answer that is an image wins. `tries` keeps a trace for debug mode.
async function firstImage(tpl, tries) {
  for (const [w, h] of SIZES) for (const [c, f] of STYLES) {
    const u = tpl.replaceAll("{w}", w).replaceAll("{h}", h).replaceAll("{c}", c).replaceAll("{f}", f);
    const r = await get(u);
    const type = r.headers.get("content-type") || "";
    tries.push([r.status, type, u]);
    if (r.ok && type.startsWith("image/")) return r;
  }
}

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS, "access-control-allow-headers": "*" } });
    const q = new URL(req.url).searchParams;
    const name = q.get("name");
    if (!name) return new Response("usage: /logo?name=Artist", { status: 400, headers: CORS });
    try {
      let page = appleLink(q.get("link"));
      const a = page ? null : await findArtist(name);
      page ??= a?.artistLinkUrl;
      const html = page ? await (await get(page)).text() : "";
      const tpl = logoTemplate(html);
      const tries = [];
      const img = tpl && await firstImage(tpl, tries);
      if (q.has("debug")) {
        const i = html.indexOf('"artistLogo"');
        return Response.json({
          version: VERSION,
          artist: a && [a.artistName, a.artistId, a.artistLinkUrl],
          page: page ?? null,
          htmlLength: html.length,
          artistLogoAt: i,
          template: tpl ?? null,
          tries, // [status, type, url] for each image attempt
          snippet: i < 0 ? null : html.slice(i, i + 400),
        }, { headers: CORS });
      }
      if (img) return new Response(img.body, { headers: { ...CORS, "content-type": img.headers.get("content-type"), "cache-control": "public, max-age=604800" } });
      return new Response(null, { status: 404, headers: { ...CORS, "cache-control": "public, max-age=3600" } });
    } catch (e) {
      return new Response(String(e), { status: 502, headers: CORS });
    }
  },
};
