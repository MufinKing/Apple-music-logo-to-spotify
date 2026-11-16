// Apple Music logos for Spotify: Spicetify extension.
// Replaces the artist name on Spotify artist pages with the logo shown on Apple Music (when the artist uploaded one).
// Needs your own Cloudflare Worker: see README.md. MIT licence.
(async function appleLogos() {
  // showNotification is sometimes defined later than Platform: wait for both, otherwise the extension crashes at startup
  while (!(Spicetify?.showNotification && Spicetify?.Platform?.History)) await new Promise(r => setTimeout(r, 100));

  // ---- Settings ----
  const API = "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/logo?name="; // your Worker URL, keeping the "/logo?name=" ending
  const COUNTRY = "fr"; // two-letter country code of the Apple Music store used for the artist search
  const POSITION = "center"; // "center" | "right": bottom of the banner, on the "monthly listeners" row; "inline": above the name, on the left
  const HEIGHT = 72; // logo height in px
  const PLATE = "#fff"; // background behind dark logos (invisible on Spotify's dark banner); "" to disable
  const DEBUG = false; // true = small notifications in Spotify showing what happens
  const TITLE = '[data-encore-id="adaptiveTitle"]'; // the artist name in Spotify's markup: adjust if Spotify changes it
  const LISTENERS = /monthly listeners|auditeurs mensuels/i; // finds the artist banner (English/French UI): add your language
  // ------------------

  const ITUNES = `https://itunes.apple.com/search?entity=musicArtist&country=${COUNTRY}&limit=5&term=`;
  const cache = new Map(); // name -> Promise<{ status, url?, dark?, local?, msg? }>
  const onArtist = () => Spicetify.Platform.History.location.pathname.startsWith("/artist/");
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const note = msg => DEBUG && Spicetify.showNotification("Apple Music logos: " + msg);
  let warned = false; // real errors are only shown once
  const warn = msg => { if (!warned) { warned = true; Spicetify.showNotification("Apple Music logos: " + msg, true); } };
  if (API.includes("YOUR-WORKER")) return warn("set your Worker URL (API) at the top of apple-logos.js");
  note("extension loaded, server = " + new URL(API).host);

  // !important to beat the inline style Spotify puts on the title
  document.head.appendChild(Object.assign(document.createElement("style"), {
    textContent: `${TITLE}[data-logo-hidden]{display:none!important}`,
  }));

  // A dark logo (e.g. black on transparent) is invisible on the dark banner: it gets a light plate behind it.
  async function isDark(url) {
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = Math.max(1, Math.round(64 * img.naturalHeight / img.naturalWidth));
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
      return n > 0 && sum / n < 100;
    } catch { return false; }
  }

  // The iTunes search is rate-limited per IP address, and the Worker's (Cloudflare, shared) is sometimes blocked ("Rate limit").
  // So the artist is searched from your computer; if that fails (network, CORS), the Worker searches by itself.
  async function appleLink(name) {
    try {
      const r = await fetch(ITUNES + encodeURIComponent(name));
      return (await r.json()).results.find(a => norm(a.artistName) === norm(name))?.artistLinkUrl ?? null;
    } catch { return null; }
  }

  const logo = name => {
    if (!cache.has(name)) {
      cache.set(name, appleLink(name)
        .then(link => fetch(API + encodeURIComponent(name) + (link ? "&link=" + encodeURIComponent(link) : ""), { cache: "no-cache" }) // no-cache: never reuse an old answer kept in Spotify's HTTP cache
          .then(async r => {
            if (r.status === 404) return { status: 404 }; // this artist has no logo: normal
            if (!r.ok) { cache.delete(name); return { status: r.status, msg: (await r.text()).slice(0, 150) }; } // error: retry on the next visit
            const url = URL.createObjectURL(await r.blob());
            return { status: r.status, url, dark: !!PLATE && await isDark(url), local: !!link };
          }))
        .catch(() => { cache.delete(name); warn("logo server unreachable (is the Worker URL correct?)"); return { status: 0 }; }));
    }
    return cache.get(name);
  };

  // Smallest ancestor of the title that also contains the "monthly listeners" line = the artist banner.
  // Safety: if it is taller than 70% of the window it is not the banner -> null (falls back to "inline").
  function banner(title) {
    for (let a = title.parentElement; a && a !== document.body; a = a.parentElement) {
      if (LISTENERS.test(a.textContent)) return a.offsetHeight < innerHeight * 0.7 ? a : null;
    }
    return null;
  }

  let missing;
  async function apply() {
    if (!onArtist()) return;
    const title = document.querySelector(TITLE);
    if (!title) {
      clearTimeout(missing);
      missing = setTimeout(() => onArtist() && !document.querySelector(TITLE) && warn("artist title not found (did Spotify change its layout? see TITLE)"), 3000);
      return;
    }
    const name = title.textContent.trim();
    const shown = () => document.querySelector("img[data-apple-logo]");
    if (!name || (title.dataset.logoFor === name && (!title.dataset.hasLogo || shown()))) return;
    title.dataset.logoFor = name;
    delete title.dataset.hasLogo;
    title.removeAttribute("data-logo-hidden");
    document.querySelectorAll("img[data-apple-logo]").forEach(i => i.remove());
    const { url, dark, status, msg, local } = await logo(name);
    if (title.dataset.logoFor !== name) return; // navigated away meanwhile
    if (!url) return status === 404 ? note(`${name}: no logo (404), keeping the text name`) : status && warn(`${name}: ${msg || "error " + status}`);

    const img = document.createElement("img");
    img.setAttribute("data-apple-logo", "");
    img.alt = name;
    img.src = url;
    const host = POSITION !== "inline" && banner(title);
    const side = POSITION === "right" ? "right:24px" : "left:50%;transform:translateX(-50%)";
    img.style.cssText = `height:${HEIGHT}px;max-width:50%;object-fit:contain;pointer-events:none;` +
      (dark ? `background:${PLATE};padding:6px 14px;border-radius:10px;` : "") +
      (host ? `position:absolute;z-index:2;bottom:16px;${side}` : "display:block;margin:8px 0");
    if (host) {
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.append(img);
    } else title.after(img);
    title.dataset.hasLogo = "1";
    title.setAttribute("data-logo-hidden", "");
    note(`${name}: logo shown${dark ? " (light plate: dark logo)" : ""}${host ? "" : " (banner not found, placed above the name)"}, artist search by ${local ? "your computer" : "the Worker"}`);
  }

  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(() => apply().catch(e => warn("error: " + e.message)), 150); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule(); // one pass at load, in case the artist page is already displayed
})();
