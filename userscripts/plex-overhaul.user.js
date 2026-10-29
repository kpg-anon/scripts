// ==UserScript==
// @name         Plex Overhaul
// @version      1.1.1
// @modified     2026.10.29
// @description  New look, layout and motion for Plex Web.
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://github.com/kpg-anon/scripts/raw/main/userscripts/plex-overhaul.user.js
// @updateURL    https://github.com/kpg-anon/scripts/raw/main/userscripts/plex-overhaul.user.js
// @match        *://*/web/index.html*
// @match        https://app.plex.tv/desktop*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
"use strict";

// ---- core/00-pxo.js
// A second injection (dev reload, or VM re-running) tears down the first.
if (window.__PXO) {
  try { window.__PXO.destroy(); } catch (e) { console.warn("[pxo] destroy failed", e); }
}

const PXO = {
  version: "1.1.1",
  cssModules: [],
  elements: [],
  cleanups: [],

  addCss(name, css) {
    PXO.cssModules.push({ name, css });
  },

  // Each element file calls this. init() runs once at startup and may return
  // a cleanup function that destroy() calls.
  element(def) {
    PXO.elements.push(def);
  },

  onCleanup(fn) {
    PXO.cleanups.push(fn);
  },

  log(...args) {
    console.debug("[pxo]", ...args);
  },
};

window.__PXO = PXO;

// ---- core/10-dom.js
// Plex class names look like `SourceSidebar-sidebar-hLtTJn`; the suffix changes
// with each Plex Web build, so match on the stable prefix.
PXO.sc = (name) => `[class*="${name}-"]`;
PXO.tid = (id) => `[data-testid="${id}"]`;

PXO.$ = (sel, root = document) => root.querySelector(sel);
PXO.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// h("div.a.b", { onclick, style: {...}, dataset: {...}, ...attrs }, ...children)
PXO.h = (spec, props, ...children) => {
  const [tag, ...classes] = spec.split(".");
  const el = document.createElement(tag || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
};

PXO.svg = (pathD, size = 20) =>
  PXO.h("span.pxo-icon", {
    "aria-hidden": "true",
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pathD}</svg>`,
  });

PXO.icons = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};

// ---- core/20-settings.js
PXO.settings = (() => {
  const KEY = "pxo.settings";
  const defaults = {
    accent: "afterglow", // afterglow | aurora | ember | glacier
    motion: "system", // system | full | reduced
    hero: true,
    heroAutoplay: false,
    rail: true, // icon rail sidebar instead of Plex's 260px sidebar
    ambient: true, // tint the page with the current hero/item backdrop
  };
  let values = { ...defaults };
  try {
    Object.assign(values, JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch (e) {}
  const listeners = new Set();
  const mq = matchMedia("(prefers-reduced-motion: reduce)");

  // Stops Plex's own animations while reduced motion is on. It is a separate
  // element, present only then, because its universal selectors would
  // otherwise be matched against every element on every style recalc.
  const reduceStyle = PXO.h("style", { id: "pxo-reduce-motion" });
  reduceStyle.textContent =
    "*, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }";
  PXO.onCleanup(() => reduceStyle.remove());

  function apply() {
    const html = document.documentElement;
    html.dataset.pxoAccent = values.accent;
    html.dataset.pxoRail = values.rail ? "1" : "0";
    html.dataset.pxoAmbient = values.ambient ? "1" : "0";
    const reduce = values.motion === "reduced" || (values.motion === "system" && mq.matches);
    html.dataset.pxoReduce = reduce ? "1" : "0";
    if (reduce && !reduceStyle.isConnected) html.append(reduceStyle);
    else if (!reduce) reduceStyle.remove();
  }

  const onMq = () => apply();
  mq.addEventListener("change", onMq);
  PXO.onCleanup(() => mq.removeEventListener("change", onMq));

  return {
    defaults,
    apply,
    get: (k) => values[k],
    all: () => ({ ...values }),
    set(k, v) {
      values[k] = v;
      try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) {}
      apply();
      listeners.forEach((fn) => fn(k, v));
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reducedMotion: () => document.documentElement.dataset.pxoReduce === "1",
  };
})();

// ---- core/30-router.js
// Plex Web is a hash router: #!/, #!/media/<server>/..., #!/server/<id>/details?key=...
PXO.route = () => {
  const hash = location.hash.replace(/^#!?/, "") || "/";
  const [p, q = ""] = hash.split("?");
  const params = new URLSearchParams(q);
  let name = "other";
  if (p === "/" || p === "") name = "home";
  else if (/\/details$/.test(p)) name = "details";
  else if (/^\/media\/[^/]+\/com\.plexapp\.plugins\.library/.test(p)) name = "library";
  else if (/^\/settings/.test(p)) name = "settings";
  else if (/^\/search/.test(p)) name = "search";
  return { name, path: p, params, hash };
};

PXO.onRoute = (() => {
  const listeners = new Set();
  let last = null;
  const fire = () => {
    const r = PXO.route();
    if (r.hash === last) return;
    last = r.hash;
    document.documentElement.dataset.pxoRoute = r.name;
    listeners.forEach((fn) => fn(r));
  };
  window.addEventListener("hashchange", fire);
  window.addEventListener("popstate", fire);
  PXO.onCleanup(() => {
    window.removeEventListener("hashchange", fire);
    window.removeEventListener("popstate", fire);
  });
  PXO.fireRoute = () => { last = null; fire(); };
  return (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
})();

// ---- core/40-observer.js
// One MutationObserver for the whole app. By default subscribers run at most
// once per animation frame, after React has finished a batch of DOM changes.
// `{ immediate: true }` subscribers run in the observer callback itself, before
// the browser paints, for changes that must land in the same frame as Plex's
// own render (inserting the hero, starting a row's fade). Those must return
// quickly when there is nothing to do.
PXO.onMutate = (() => {
  const frame = new Set();
  const immediate = new Set();
  let queued = false;
  const call = (fn) => {
    try { fn(); } catch (e) { console.error("[pxo]", e); }
  };
  const run = () => {
    queued = false;
    frame.forEach(call);
  };
  const mo = new MutationObserver(() => {
    immediate.forEach(call);
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  });
  PXO.startObserver = () => mo.observe(document.documentElement, { childList: true, subtree: true });
  PXO.onCleanup(() => mo.disconnect());
  return (fn, opts) => {
    const set = opts && opts.immediate ? immediate : frame;
    set.add(fn);
    return () => set.delete(fn);
  };
})();

// ---- core/50-api.js
// Reads from a Plex Media Server with the token Plex Web keeps in localStorage.
// When the page is served by the server itself (any domain, :32400/web, a
// reverse proxy) requests are same-origin. On app.plex.tv the server is found
// through plex.tv's resource list and its own access token is used.
PXO.api = (() => {
  const accountToken = () => localStorage.getItem("myPlexAccessToken") || "";
  let serverPromise = null;
  let server = null; // { base, token, machineIdentifier }
  let resolvedFor = null; // account token the server was resolved with

  // Short, non-reversible id for the signed-in user, for keying caches. Plex
  // Home's "Switch User" swaps the token without reloading the page.
  function userKey() {
    let h = 0;
    for (const c of accountToken()) h = (h * 31 + c.charCodeAt(0)) | 0;
    return (h >>> 0).toString(36);
  }

  const json = async (url, token, ms = 8000) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: {
          Accept: "application/json",
          "X-Plex-Token": token,
          "X-Plex-Client-Identifier": localStorage.getItem("clientID") || "pxo",
        },
      });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  };

  async function sameOrigin() {
    const mc = (await json("/identity", accountToken(), 4000)).MediaContainer;
    if (!mc || !mc.machineIdentifier) throw new Error("not a media server");
    return { base: "", token: accountToken(), machineIdentifier: mc.machineIdentifier };
  }

  async function viaPlexTv() {
    const resources = await json("https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1", accountToken());
    const wanted = (location.hash.match(/\/server\/([0-9a-f]{40})/) || [])[1];
    const servers = resources.filter((r) => (r.provides || "").includes("server"));
    const pick = servers.find((r) => r.clientIdentifier === wanted) || servers.find((r) => r.owned) || servers[0];
    if (!pick) throw new Error("no server on this account");
    // Same order Plex Web tries: local, remote, relay; https only (the page is https).
    const conns = (pick.connections || [])
      .filter((c) => c.protocol === "https")
      .sort((a, b) => (a.relay - b.relay) || (b.local - a.local));
    for (const c of conns) {
      try {
        await json(`${c.uri}/identity`, pick.accessToken, 3000);
        return { base: c.uri, token: pick.accessToken, machineIdentifier: pick.clientIdentifier };
      } catch (e) {}
    }
    throw new Error(`no reachable connection for ${pick.name}`);
  }

  function resolve() {
    if (resolvedFor !== accountToken()) {
      resolvedFor = accountToken();
      serverPromise = null;
      server = null;
    }
    serverPromise = serverPromise || sameOrigin().catch(viaPlexTv).then((s) => (server = s));
    serverPromise.catch(() => { serverPromise = null; });
    return serverPromise;
  }

  async function get(path) {
    const s = await resolve();
    return (await json(s.base + path, s.token)).MediaContainer || {};
  }

  // Resized image through the server's transcoder, so the hero does not pull
  // full-size 4K backgrounds. Call after get() has resolved the server.
  function img(path, width, height) {
    if (!path || !server) return "";
    const q = new URLSearchParams({
      width: String(width),
      height: String(height),
      minSize: "1",
      upscale: "1",
      url: path,
      "X-Plex-Token": server.token,
    });
    return `${server.base}/photo/:/transcode?${q}`;
  }

  async function machineId() {
    return (await resolve()).machineIdentifier;
  }

  function imageOf(item, type) {
    const hit = (item.Image || []).find((i) => i.type === type);
    return hit ? hit.url : "";
  }

  return { get, img, machineId, imageOf, userKey };
})();

// ---- core/60-styles.js
// CSS shorthand `%Component-part` means "any Plex class containing
// `Component-part-`" (Plex appends a per-build hash). An attribute selector
// like [class*="Component-part-"] can't be indexed by the style engine, so it
// is tested against every element on every style recalc. Instead, read the
// class names Plex's own stylesheets define and use real class selectors;
// names with no match yet fall back to the attribute selector and are tried
// again whenever Plex loads another stylesheet.
PXO.mountStyles = () => {
  const font = PXO.h("link", {
    id: "pxo-font",
    rel: "stylesheet",
    crossorigin: "anonymous", // makes its rules readable for the alias below
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  });
  // Plex sets "-apple-system, BlinkMacSystemFont, Segoe UI, ..." directly on
  // many containers. Outside Safari, -apple-system is just a family name, so
  // registering Inter's font files under that name turns every one of those
  // stacks into Inter without a rule per element.
  const alias = PXO.h("style", { id: "pxo-font-alias" });
  font.addEventListener("load", () => {
    try {
      alias.textContent = Array.from(font.sheet.cssRules)
        .filter((r) => r instanceof CSSFontFaceRule)
        .map((r) => r.cssText.replace(/font-family:\s*["']?Inter["']?/i, 'font-family: "-apple-system"'))
        .join("\n");
    } catch (e) {
      PXO.log("font alias unavailable", e);
    }
  });
  const style = PXO.h("style", { id: "pxo-style" });
  const RE = /%([A-Z][A-Za-z0-9]*-[A-Za-z0-9]+)/g;
  const raw = PXO.cssModules.map((m) => `/* ${m.name} */\n${m.css}`).join("\n");
  const names = [...new Set(Array.from(raw.matchAll(RE), (m) => m[1]))];
  const selectors = new Map();
  let sheetCount = -1;
  let tokens = [];
  let tokensAt = -1;

  function scanClassTokens() {
    const tokens = new Set();
    const walk = (rules) => {
      for (const r of rules) {
        if (r.selectorText) for (const m of r.selectorText.matchAll(/\.([A-Za-z_][\w-]*)/g)) tokens.add(m[1]);
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const ss of document.styleSheets) {
      if (ss.ownerNode === style) continue;
      try { walk(ss.cssRules); } catch (e) {} // cross-origin (Google Fonts)
    }
    return Array.from(tokens);
  }

  // Names with no match are not searched again until another stylesheet loads.
  const misses = new Map();

  function resolve(n) {
    if (selectors.has(n)) return selectors.get(n);
    const count = document.styleSheets.length;
    if (misses.get(n) === count) return null;
    if (tokensAt !== count) {
      tokens = scanClassTokens();
      tokensAt = count;
    }
    const hits = tokens.filter((t) => t.includes(`${n}-`));
    if (!hits.length) {
      misses.set(n, count);
      return null;
    }
    const cls = hits.map((t) => `.${CSS.escape(t)}`);
    const sel = cls.length === 1 ? cls[0] : `:is(${cls.join(",")})`;
    selectors.set(n, sel);
    return sel;
  }

  function render() {
    if (document.styleSheets.length === sheetCount) return;
    sheetCount = document.styleSheets.length;
    if (style.textContent && names.every((n) => selectors.has(n))) return;
    const text = raw.replace(RE, (_, n) => resolve(n) || `[class*="${n}-"]`);
    if (text !== style.textContent) style.textContent = text;
  }

  // JS lookups (PXO.sc) use the same resolved selectors.
  const fallbackSc = PXO.sc;
  PXO.sc = (n) => resolve(n) || fallbackSc(n);

  render();
  // Appended to <html> after <head>, so these rules come after every style tag
  // Plex adds to <head> at runtime and win ties in specificity.
  document.documentElement.append(font, alias, style);
  const off = PXO.onMutate(render);
  PXO.styleStats = () => ({ names: names.length, resolved: selectors.size, unresolved: names.filter((n) => !selectors.has(n)) });
  PXO.onCleanup(() => {
    off();
    PXO.sc = fallbackSc;
    font.remove();
    alias.remove();
    style.remove();
  });
};

// ---- core/70-art.js
// Backdrop art for items: metadata lookups and decoded images, both cached, so
// a details page can show its art as soon as it opens. Hovering a poster
// starts the lookup and decode early (elements/prefetch).
PXO.art = (() => {
  const MAX = 30;
  const meta = new Map(); // ratingKey -> Promise<{ url, colors } | null>
  const images = new Map(); // url -> Promise<HTMLImageElement>

  // Map keeps insertion order, so the first key is the oldest.
  const remember = (map, key, value) => {
    map.set(key, value);
    if (map.size > MAX) map.delete(map.keys().next().value);
    return value;
  };

  // The art sits under dark gradients, so it never needs more than 1920px,
  // and less in a small window.
  function size() {
    const w = Math.min(1920, Math.ceil((innerWidth * Math.min(devicePixelRatio || 1, 1.5)) / 320) * 320);
    return [w, Math.round((w * 9) / 16)];
  }

  function forKey(key) {
    if (meta.has(key)) return meta.get(key);
    const p = PXO.api
      .get(`/library/metadata/${key}`)
      .then((mc) => {
        const item = (mc.Metadata || [])[0];
        const art = item && (item.art || item.grandparentArt || item.parentArt);
        return art ? { url: PXO.api.img(art, ...size()), colors: item.UltraBlurColors } : null;
      })
      .catch(() => {
        meta.delete(key);
        return null;
      });
    return remember(meta, key, p);
  }

  // img.decode() decodes off the main thread; the image is only shown once it
  // resolves, so the crossfade never waits on a decode.
  function decode(url) {
    if (images.has(url)) return images.get(url);
    const img = new Image();
    img.decoding = "async";
    img.alt = "";
    img.src = url;
    const p = img.decode().then(
      () => img,
      (e) => {
        images.delete(url);
        throw e;
      }
    );
    return remember(images, url, p);
  }

  function prefetch(key) {
    return forKey(key).then((a) => a && decode(a.url)).catch(() => {});
  }

  const keyFromHref = (href) => {
    const m = /key=%2Flibrary%2Fmetadata%2F(\d+)/.exec(href || "");
    return m ? m[1] : null;
  };

  return { size, forKey, decode, prefetch, keyFromHref };
})();

PXO.addCss("theme/10-tokens.css", "/* Afterglow: blue-black ink surfaces, one three-stop accent gradient.\n   Roles (kept from comfy-dark): --pxo-a1 = primary action (play, progress),\n   --pxo-a3 = active / selected / focus, --pxo-good = watched / success,\n   --pxo-bad = destructive. */\n:root {\n  --pxo-ink-0: #07080c;\n  --pxo-ink-1: #0c0e14;\n  --pxo-ink-2: #12151d;\n  --pxo-ink-3: #191d28;\n  --pxo-ink-4: #222735;\n  --pxo-line: rgba(168, 180, 225, 0.09);\n  --pxo-line-strong: rgba(168, 180, 225, 0.17);\n\n  --pxo-fg: #eef0f6;\n  --pxo-fg-2: #b3b9ca;\n  --pxo-fg-3: #737b90;\n\n  --pxo-a1: #ffa66e;\n  --pxo-a2: #ff5f8a;\n  --pxo-a3: #8d7dff;\n  --pxo-on-a1: #1a0e08;\n  --pxo-good: #5fe0b4;\n  --pxo-bad: #ff5f6e;\n\n  --pxo-grad: linear-gradient(115deg, var(--pxo-a1), var(--pxo-a2) 55%, var(--pxo-a3));\n  --pxo-grad-soft: linear-gradient(115deg,\n    color-mix(in srgb, var(--pxo-a1) 22%, transparent),\n    color-mix(in srgb, var(--pxo-a3) 22%, transparent));\n\n  --pxo-glass: rgba(12, 14, 20, 0.66);\n  --pxo-glass-strong: rgba(12, 14, 20, 0.86);\n\n  --pxo-radius-l: 18px;\n  --pxo-radius: 12px;\n  --pxo-radius-s: 8px;\n\n  --pxo-shadow-1: 0 6px 18px -8px rgba(0, 0, 0, 0.7);\n  --pxo-shadow-2: 0 24px 50px -20px rgba(0, 0, 0, 0.85);\n\n  --pxo-ease: cubic-bezier(0.22, 0.75, 0.2, 1);\n  --pxo-fast: 160ms;\n  --pxo-med: 280ms;\n  --pxo-slow: 640ms;\n\n  --pxo-font: \"Inter\", -apple-system, \"Segoe UI\", Roboto, sans-serif;\n  --pxo-rail: 76px;\n  --pxo-topbar-h: 64px;\n}\n\n:root[data-pxo-accent=\"aurora\"] {\n  --pxo-a1: #5fe0b4;\n  --pxo-a2: #4cc3ff;\n  --pxo-a3: #8d7dff;\n  --pxo-on-a1: #04140e;\n}\n:root[data-pxo-accent=\"ember\"] {\n  --pxo-a1: #ffc65c;\n  --pxo-a2: #ff7a45;\n  --pxo-a3: #ff3f6c;\n  --pxo-on-a1: #1a1004;\n}\n:root[data-pxo-accent=\"glacier\"] {\n  --pxo-a1: #e6ebf7;\n  --pxo-a2: #a8b6d9;\n  --pxo-a3: #7f8dff;\n  --pxo-on-a1: #0c0f18;\n}\n\n/* Reduced motion: our own durations collapse to ~0. Plex's animations are\n   stopped by a separate <style> that core/20-settings.js adds only while\n   reduced motion is on (a universal rule here would be checked against every\n   element on every style recalc, even with reduced motion off). */\n:root[data-pxo-reduce=\"1\"] {\n  --pxo-fast: 1ms;\n  --pxo-med: 1ms;\n  --pxo-slow: 1ms;\n}\n");

PXO.addCss("theme/20-plex-vars.css", "/* Plex Web reads its colours, fonts and radii from these variables on\n   .react-chroma-dark; remapping them re-themes the parts this script does not\n   style one by one (menus, modals, settings pages, buttons). */\nhtml body.react-chroma-dark {\n  --color-brand-accent: var(--pxo-a1);\n  --color-static-yellow: var(--pxo-a1);\n  --color-text-accent: var(--pxo-a1);\n  --color-background-accent: var(--pxo-a1);\n  --color-background-accent-focus: color-mix(in srgb, var(--pxo-a1) 82%, white);\n  --color-text-on-accent: var(--pxo-on-a1);\n  --color-keyboard-focus: var(--pxo-a3);\n  --color-highlight-control-focus: color-mix(in srgb, var(--pxo-a3) 80%, transparent);\n  --color-static-perrywinkle: var(--pxo-a3);\n\n  --color-text-primary: var(--pxo-fg);\n  --color-text-default: color-mix(in srgb, var(--pxo-fg) 86%, transparent);\n  --color-text-muted: var(--pxo-fg-3);\n\n  --color-overlay-background: var(--pxo-ink-1);\n  --color-background-modal: var(--pxo-ink-2);\n  --color-menu: var(--pxo-ink-2);\n  --color-background-backdrop: rgba(4, 5, 8, 0.78);\n  --color-background-card: rgba(255, 255, 255, 0.03);\n  --color-background-control: rgba(255, 255, 255, 0.06);\n  --color-background-control-focus: rgba(255, 255, 255, 0.12);\n  --color-confirm-highlight: var(--pxo-good);\n  --color-highlight-success: var(--pxo-good);\n  --color-static-green: var(--pxo-good);\n\n  --color-ultrablur-tl: var(--pxo-ink-1);\n  --color-ultrablur-tr: var(--pxo-ink-1);\n  --color-ultrablur-br: var(--pxo-ink-2);\n  --color-ultrablur-bl: var(--pxo-ink-1);\n\n  --border-radius-s: 6px;\n  --border-radius-m: var(--pxo-radius);\n  --border-radius-l: var(--pxo-radius-l);\n  --shadow-high: var(--pxo-shadow-1);\n  --shadow-ultra-high: var(--pxo-shadow-2);\n\n  --font-display-1-font-family: var(--pxo-font);\n  --font-display-2-font-family: var(--pxo-font);\n  --font-display-3-font-family: var(--pxo-font);\n  --font-display-copy-font-family: var(--pxo-font);\n  --font-heading-1-font-family: var(--pxo-font);\n  --font-heading-2-font-family: var(--pxo-font);\n  --font-heading-3-font-family: var(--pxo-font);\n  --font-heading-4-font-family: var(--pxo-font);\n  --font-body-1-font-family: var(--pxo-font);\n  --font-body-2-font-family: var(--pxo-font);\n  --font-body-3-font-family: var(--pxo-font);\n  --font-button-1-font-family: var(--pxo-font);\n  --font-button-2-font-family: var(--pxo-font);\n  --font-caption-font-family: var(--pxo-font);\n  --font-tiny-font-family: var(--pxo-font);\n  --font-display-1-font-weight: 800;\n  --font-display-2-font-weight: 800;\n  --font-display-1-letter-spacing: -0.03em;\n  --font-display-2-letter-spacing: -0.025em;\n  --font-heading-1-letter-spacing: -0.02em;\n  --font-heading-2-letter-spacing: -0.015em;\n}\n");

PXO.addCss("theme/30-base.css", "html body,\nhtml body #plex {\n  background: var(--pxo-ink-0);\n  color: var(--pxo-fg);\n  font-family: var(--pxo-font);\n  font-feature-settings: \"cv11\", \"ss01\";\n  -webkit-font-smoothing: antialiased;\n}\n\n::selection {\n  background: color-mix(in srgb, var(--pxo-a3) 45%, transparent);\n  color: #fff;\n}\n\n/* Scrollbars: thin and ink-coloured. scrollbar-color inherits, so it is set\n   once on <html>; scrollbar-width does not, so it goes on Plex's scroll\n   containers only. No universal (*) rules: those are matched against every\n   element on every style recalc. */\nhtml {\n  scrollbar-color: var(--pxo-ink-4) transparent;\n}\n%Scroller-scroller,\n.dark-scrollbar,\n.pxo-panel {\n  scrollbar-width: thin;\n}\n\n:focus-visible {\n  outline: 2px solid var(--pxo-a3);\n  outline-offset: 2px;\n}\n\n/* Shared pieces used by injected elements. */\n.pxo-icon { display: inline-flex; line-height: 0; }\n\n.pxo-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n  height: 44px;\n  padding: 0 20px;\n  border: 1px solid var(--pxo-line-strong);\n  border-radius: 99px;\n  background: rgba(255, 255, 255, 0.07);\n  color: var(--pxo-fg);\n  font: 600 15px/1 var(--pxo-font);\n  letter-spacing: -0.005em;\n  cursor: pointer;\n  text-decoration: none;\n  transition: background var(--pxo-fast) var(--pxo-ease), transform var(--pxo-fast) var(--pxo-ease),\n    border-color var(--pxo-fast) var(--pxo-ease), box-shadow var(--pxo-med) var(--pxo-ease);\n}\n.pxo-btn:hover { background: rgba(255, 255, 255, 0.13); border-color: rgba(255, 255, 255, 0.24); }\n.pxo-btn:active { transform: scale(0.97); }\n.pxo-btn--primary {\n  border-color: transparent;\n  background: var(--pxo-grad);\n  color: var(--pxo-on-a1);\n  box-shadow: 0 10px 30px -10px color-mix(in srgb, var(--pxo-a2) 70%, transparent);\n}\n.pxo-btn--primary:hover {\n  background: var(--pxo-grad);\n  filter: brightness(1.07);\n  box-shadow: 0 14px 36px -10px color-mix(in srgb, var(--pxo-a2) 85%, transparent);\n}\n\n@keyframes pxo-fade-up {\n  from { opacity: 0; transform: translateY(10px); }\n  to { opacity: 1; transform: none; }\n}\n@keyframes pxo-fade {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n");

PXO.addCss("elements/backdrop", "%FullPageBackground-backgroundContainer {\n  background: var(--pxo-ink-0) !important;\n}\n\n/* Plex's own item backdrop (details pages): dimmed and faded into the ink. */\n%FullPageBackground-backgroundContainer > div:not(.pxo-backdrop) {\n  opacity: 0.55;\n  transition: opacity var(--pxo-slow) var(--pxo-ease), visibility 0s linear;\n}\n/* Once our own art is showing, Plex's blurred copy is hidden outright (after\n   its fade) so it is not painted underneath. data-pxo-art is set by index.js. */\nhtml[data-pxo-art=\"1\"] %FullPageBackground-backgroundContainer > div:not(.pxo-backdrop) {\n  opacity: 0;\n  visibility: hidden;\n  transition: opacity var(--pxo-slow) var(--pxo-ease), visibility 0s linear var(--pxo-slow);\n}\n/* Plex lays a noise PNG over its backdrop (the second child); drop it. Matched\n   by position: a [style*=...] selector would be re-checked on every inline\n   style change Plex makes, and its virtual lists make many. */\n%FullPageBackground-backgroundContainer > div:not(.pxo-backdrop) > div + div {\n  display: none;\n}\n%FullPageBackground-backgroundContainer::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  pointer-events: none;\n  background:\n    linear-gradient(90deg, rgba(7, 8, 12, 0.94) 0%, rgba(7, 8, 12, 0.7) 38%, rgba(7, 8, 12, 0.12) 80%),\n    linear-gradient(0deg, var(--pxo-ink-0) 4%, rgba(7, 8, 12, 0.55) 40%, rgba(7, 8, 12, 0) 70%);\n}\nhtml[data-pxo-ambient=\"0\"] %FullPageBackground-backgroundContainer > div:not(.pxo-backdrop) {\n  display: none;\n}\n\n.pxo-backdrop {\n  position: absolute;\n  inset: 0;\n  z-index: 2;\n  opacity: 0;\n  transition: opacity var(--pxo-slow) var(--pxo-ease);\n}\n.pxo-backdrop.is-active { opacity: 1; }\nhtml[data-pxo-ambient=\"0\"] .pxo-backdrop { display: none; }\n\n/* Opacity-only crossfade on composited layers: no scale, no blend modes, no\n   filters, so the fade costs no repaints. */\n.pxo-backdrop-layer {\n  position: absolute;\n  inset: 0;\n  opacity: 0;\n  will-change: opacity;\n  transition: opacity 700ms var(--pxo-ease);\n}\n.pxo-backdrop-layer.is-on { opacity: 0.9; }\n.pxo-backdrop-layer img {\n  display: block;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  object-position: center 20%;\n}\n.pxo-backdrop-tint {\n  position: absolute;\n  inset: 0;\n  background: radial-gradient(120% 90% at 0% 0%, var(--pxo-tl, transparent), transparent 60%),\n    radial-gradient(120% 90% at 100% 100%, var(--pxo-br, transparent), transparent 60%);\n  opacity: 0.16;\n}\n\n.pxo-backdrop-shade {\n  position: absolute;\n  inset: 0;\n  background: var(--pxo-ink-0);\n  opacity: 0;\n  will-change: opacity;\n}\n\n/* On home the backdrop only covers the top of the window; rows sit on ink. */\nhtml[data-pxo-route=\"home\"] %FullPageBackground-backgroundContainer::after {\n  background:\n    linear-gradient(90deg, rgba(7, 8, 12, 0.88) 0%, rgba(7, 8, 12, 0.35) 50%, rgba(7, 8, 12, 0.05) 100%),\n    linear-gradient(0deg, var(--pxo-ink-0) 22%, rgba(7, 8, 12, 0.7) 45%, rgba(7, 8, 12, 0) 78%);\n}\n");

// ---- elements/backdrop
// A full-window backdrop layer inside Plex's FullPageBackground container.
// Other elements call PXO.backdrop.show(url, colors) / PXO.backdrop.clear().
// Two stacked <img> layers crossfade with opacity only; a new image is decoded
// (PXO.art.decode) before it is shown.
PXO.element({
  name: "backdrop",
  init() {
    const html = document.documentElement;
    const root = PXO.h("div.pxo-backdrop", { "aria-hidden": "true" });
    const layers = [PXO.h("div.pxo-backdrop-layer"), PXO.h("div.pxo-backdrop-layer")];
    const tint = PXO.h("div.pxo-backdrop-tint");
    // Darkens the art as the home page scrolls (hero/index.js); opacity only.
    const shade = PXO.h("div.pxo-backdrop-shade");
    root.append(...layers, tint, shade);
    let front = 0;
    let current = "";
    let shadeValue = 0;

    const ensure = () => {
      if (root.isConnected) return;
      const host = PXO.$(PXO.sc("FullPageBackground-backgroundContainer"));
      if (host) host.append(root);
    };

    const setActive = (on) => {
      root.classList.toggle("is-active", on);
      if (on) html.dataset.pxoArt = "1";
      else delete html.dataset.pxoArt;
    };

    PXO.backdrop = {
      show(url, colors) {
        // With Backdrops off the layer is hidden; skip the fetch and decode.
        if (!url || url === current || !PXO.settings.get("ambient")) return;
        current = url;
        PXO.art.decode(url).then((img) => {
          if (current !== url) return;
          front = 1 - front;
          layers[front].replaceChildren(img);
          layers[front].classList.add("is-on");
          layers[1 - front].classList.remove("is-on");
          setActive(true);
        }, () => {});
        // UltraBlurColors gives four corner colours for the artwork.
        if (colors) {
          root.style.setProperty("--pxo-tl", `#${colors.topLeft}`);
          root.style.setProperty("--pxo-br", `#${colors.bottomRight}`);
        }
      },
      clear() {
        current = "";
        setActive(false);
        layers.forEach((l) => l.classList.remove("is-on"));
      },
      shade(v) {
        const q = Math.round(v * 50) / 50;
        if (q === shadeValue) return;
        shadeValue = q;
        shade.style.opacity = String(q * 0.8);
      },
    };

    const offMut = PXO.onMutate(ensure);
    const offRoute = PXO.onRoute((r) => {
      PXO.backdrop.shade(0);
      if (r.name !== "home" && r.name !== "details") PXO.backdrop.clear();
    });
    ensure();

    return () => {
      offMut();
      offRoute();
      root.remove();
      delete html.dataset.pxoArt;
      delete PXO.backdrop;
    };
  },
});

PXO.addCss("elements/forms", "/* Plex's older Bootstrap forms: settings pages (#!/settings/...) and legacy\n   dialogs such as Edit metadata (.modal, appended to <body>). Plain class\n   names, stable across builds. */\n#plex select,\n#plex .form-control,\n.modal select,\n.modal .form-control,\n#plex input[type=\"text\"]:not(#quickSearchInput),\n#plex input[type=\"number\"],\n#plex input[type=\"password\"],\n#plex input[type=\"email\"],\n#plex textarea {\n  min-height: 36px;\n  padding: 6px 12px;\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius-s) !important;\n  background-color: var(--pxo-ink-2) !important;\n  color: var(--pxo-fg) !important;\n  font: 500 14px var(--pxo-font) !important;\n  box-shadow: none !important;\n  transition: border-color var(--pxo-fast) var(--pxo-ease), box-shadow var(--pxo-fast) var(--pxo-ease);\n}\n#plex select:focus,\n#plex .form-control:focus,\n.modal select:focus,\n.modal .form-control:focus,\n#plex input:focus:not(#quickSearchInput),\n#plex textarea:focus {\n  outline: none;\n  border-color: var(--pxo-a3) !important;\n  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pxo-a3) 22%, transparent) !important;\n}\n#plex select option { background: var(--pxo-ink-2); color: var(--pxo-fg); }\n\n#plex input[type=\"checkbox\"],\n#plex input[type=\"radio\"],\n.modal input[type=\"checkbox\"],\n.modal input[type=\"radio\"] {\n  accent-color: var(--pxo-a3);\n  width: 16px;\n  height: 16px;\n  margin-right: 8px;\n  vertical-align: -2px;\n}\ninput[type=\"range\"] { accent-color: var(--pxo-a1); }\n\n.form-group .control-label,\n.form-group label { color: var(--pxo-fg) !important; font-family: var(--pxo-font) !important; }\n.help-block { color: var(--pxo-fg-3) !important; }\n.help-block a, .form-group a { color: var(--pxo-a1) !important; }\n\n/* Buttons */\n#plex .btn,\n.modal .btn {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: 99px !important;\n  background: rgba(255, 255, 255, 0.07) !important;\n  color: var(--pxo-fg) !important;\n  font: 600 13px var(--pxo-font) !important;\n  text-shadow: none !important;\n  box-shadow: none !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), filter var(--pxo-fast) var(--pxo-ease);\n}\n#plex .btn:hover,\n.modal .btn:hover { background: rgba(255, 255, 255, 0.13) !important; }\n#plex .btn-lg, .modal .btn-lg { padding: 10px 22px !important; font-size: 15px !important; }\n#plex .btn-primary,\n.modal .btn-primary {\n  border-color: transparent !important;\n  background: var(--pxo-grad) !important;\n  color: var(--pxo-on-a1) !important;\n}\n#plex .btn-primary:hover,\n.modal .btn-primary:hover { background: var(--pxo-grad) !important; filter: brightness(1.07); }\n#plex .btn.disabled,\n#plex .btn:disabled,\n.modal .btn.disabled,\n.modal .btn:disabled { opacity: 0.45; filter: saturate(0.6); }\n#plex .btn-danger,\n.modal .btn-danger {\n  border-color: transparent !important;\n  background: color-mix(in srgb, var(--pxo-bad) 75%, var(--pxo-ink-2)) !important;\n  color: #fff !important;\n}\n\n/* Section dividers and panels on settings pages */\n#plex hr { border-color: var(--pxo-line) !important; }\n#plex .panel,\n#plex .well,\n#plex .settings-advanced-container {\n  border: 1px solid var(--pxo-line) !important;\n  border-radius: var(--pxo-radius) !important;\n  background: rgba(255, 255, 255, 0.025) !important;\n}\n\n/* Legacy Bootstrap modal frame (Edit metadata, Match, Refresh dialogs) */\n.modal-backdrop.in { opacity: 1 !important; background: rgba(4, 5, 8, 0.72) !important; }\n.modal:not(.user-select-modal) .modal-content {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius-l) !important;\n  background: var(--pxo-ink-2) !important;\n  box-shadow: var(--pxo-shadow-2) !important;\n  overflow: hidden;\n  font-family: var(--pxo-font);\n}\n.modal:not(.user-select-modal) .modal-header,\n.modal:not(.user-select-modal) .modal-footer {\n  border-color: var(--pxo-line) !important;\n  background: var(--pxo-ink-1) !important;\n}\n.modal:not(.user-select-modal) .modal-title {\n  color: var(--pxo-fg) !important;\n  font: 700 20px var(--pxo-font) !important;\n  letter-spacing: -0.015em;\n}\n.modal .modal-icon { color: var(--pxo-a1) !important; }\n.modal .close { color: var(--pxo-fg-2) !important; opacity: 1 !important; text-shadow: none !important; }\n.modal .close:hover { color: var(--pxo-fg) !important; }\n.modal .modal-nav-pane { background: var(--pxo-ink-1) !important; border-color: var(--pxo-line) !important; }\n.modal .change-pane-btn {\n  margin: 2px 6px;\n  white-space: nowrap;\n  border-radius: var(--pxo-radius-s);\n  color: var(--pxo-fg-2) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n.modal .change-pane-btn:hover { background: rgba(255, 255, 255, 0.06) !important; color: var(--pxo-fg) !important; }\n.modal .change-pane-btn.selected {\n  background: var(--pxo-grad-soft) !important;\n  color: var(--pxo-fg) !important;\n}\n.modal .change-pane-btn.selected .modal-nav-icon { color: var(--pxo-a1) !important; }\n.modal .input-group-addon,\n.modal .input-group-btn .btn {\n  border-color: var(--pxo-line-strong) !important;\n  background: var(--pxo-ink-3) !important;\n  color: var(--pxo-a1) !important;\n}\n.modal .selectize-input {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius-s) !important;\n  background: var(--pxo-ink-2) !important;\n  color: var(--pxo-fg) !important;\n  box-shadow: none !important;\n}\n/* Selectize wraps a bare <input>; the wrapper has the border, the input none. */\n.modal .selectize-input input,\n#plex .selectize-input input {\n  min-height: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  background: transparent !important;\n  box-shadow: none !important;\n}\n/* .selectize-control also carries .form-control; only its inner\n   .selectize-input should draw the field. */\n.modal .selectize-control.form-control,\n#plex .selectize-control.form-control {\n  min-height: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  background: transparent !important;\n}\n.modal .selectize-dropdown,\n#plex .selectize-dropdown {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius-s) !important;\n  background: var(--pxo-ink-2) !important;\n  box-shadow: var(--pxo-shadow-1) !important;\n}\n.selectize-dropdown .active { background: rgba(255, 255, 255, 0.08) !important; color: var(--pxo-fg) !important; }\n");

PXO.addCss("elements/hero", ".pxo-hero {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-end;\n  min-height: clamp(460px, 68vh, 680px);\n  padding: 76px var(--layout-page-padding-x, 40px) 28px;\n  margin-bottom: 8px;\n}\n\n.pxo-hero-body { min-height: 300px; display: flex; align-items: flex-end; }\n.pxo-hero-content {\n  max-width: 620px;\n  animation: pxo-fade-up var(--pxo-slow) var(--pxo-ease) both;\n}\n.pxo-hero-content > * { animation: pxo-fade-up var(--pxo-slow) var(--pxo-ease) both; }\n.pxo-hero-content > :nth-child(2) { animation-delay: 40ms; }\n.pxo-hero-content > :nth-child(3) { animation-delay: 80ms; }\n.pxo-hero-content > :nth-child(n + 4) { animation-delay: 120ms; }\n\n.pxo-hero-label {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 14px;\n  color: var(--pxo-fg-2);\n  font: 600 12px/1 var(--pxo-font);\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n.pxo-hero-label i {\n  width: 18px;\n  height: 3px;\n  border-radius: 3px;\n  background: var(--pxo-grad);\n}\n\n.pxo-hero-logo {\n  display: block;\n  max-width: min(420px, 80%);\n  max-height: 120px;\n  margin-bottom: 18px;\n  object-fit: contain;\n  object-position: left bottom;\n  filter: drop-shadow(0 6px 24px rgba(0, 0, 0, 0.55));\n}\n.pxo-hero-title {\n  margin: 0 0 14px;\n  font: 800 clamp(36px, 4.2vw, 64px)/1.02 var(--pxo-font);\n  letter-spacing: -0.035em;\n  color: #fff;\n  text-wrap: balance;\n}\n\n.pxo-hero-meta {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 6px 14px;\n  margin-bottom: 12px;\n  color: var(--pxo-fg-2);\n  font: 500 14px/1.2 var(--pxo-font);\n}\n.pxo-hero-meta span + span::before {\n  content: \"\";\n  display: inline-block;\n  width: 3px;\n  height: 3px;\n  margin: 0 12px 3px -8px;\n  border-radius: 50%;\n  background: var(--pxo-fg-3);\n}\n.pxo-hero-rating {\n  color: var(--pxo-a1);\n  font-weight: 700;\n}\n.pxo-hero-subtitle {\n  margin-bottom: 8px;\n  color: var(--pxo-fg);\n  font: 600 16px/1.3 var(--pxo-font);\n}\n.pxo-hero-summary {\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  margin: 0 0 18px;\n  color: var(--pxo-fg-2);\n  font: 400 15px/1.55 var(--pxo-font);\n}\n.pxo-hero-progress {\n  width: 260px;\n  height: 4px;\n  margin-bottom: 20px;\n  border-radius: 4px;\n  background: rgba(255, 255, 255, 0.14);\n  overflow: hidden;\n}\n.pxo-hero-progress i {\n  display: block;\n  height: 100%;\n  border-radius: inherit;\n  background: var(--pxo-grad);\n}\n.pxo-hero-actions { display: flex; gap: 12px; }\n\n/* Thumbnail strip */\n.pxo-hero-nav {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-top: 30px;\n}\n.pxo-hero-strip {\n  display: flex;\n  gap: 10px;\n  overflow-x: auto;\n  padding: 8px 4px;\n  scrollbar-width: none;\n}\n.pxo-hero-strip::-webkit-scrollbar { display: none; }\n.pxo-hero-thumb {\n  position: relative;\n  flex: 0 0 auto;\n  width: 132px;\n  aspect-ratio: 16 / 9;\n  border: 0;\n  border-radius: var(--pxo-radius-s);\n  background: var(--pxo-ink-3) center / cover no-repeat;\n  opacity: 0.5;\n  cursor: pointer;\n  overflow: hidden;\n  transition: opacity var(--pxo-med) var(--pxo-ease), transform var(--pxo-med) var(--pxo-ease),\n    box-shadow var(--pxo-med) var(--pxo-ease);\n}\n.pxo-hero-thumb:hover { opacity: 0.85; transform: translateY(-2px); }\n.pxo-hero-thumb.is-on { opacity: 1; }\n/* Ring drawn inside the thumbnail so the strip's overflow cannot clip it. */\n.pxo-hero-thumb::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  box-shadow: inset 0 0 0 2px var(--pxo-a3), inset 0 0 0 4px rgba(7, 8, 12, 0.6);\n  opacity: 0;\n  transition: opacity var(--pxo-med) var(--pxo-ease);\n}\n.pxo-hero-thumb.is-on::after { opacity: 1; }\n.pxo-hero-thumb i {\n  position: absolute;\n  left: 0;\n  bottom: 0;\n  height: 3px;\n  background: var(--pxo-grad);\n}\n.pxo-hero-arrow {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex: 0 0 36px;\n  height: 36px;\n  border: 1px solid var(--pxo-line-strong);\n  border-radius: 50%;\n  background: var(--pxo-glass);\n  color: var(--pxo-fg);\n  cursor: pointer;\n  transition: background var(--pxo-fast) var(--pxo-ease);\n}\n.pxo-hero-arrow:hover { background: rgba(255, 255, 255, 0.14); }\n\n/* Dims the backdrop as the page scrolls; set by hero/index.js. */\n\n/* Home page header floats over the hero instead of pushing it down; only\n   while the hero is in the page (data-pxo-hero, set by index.js). */\nhtml[data-pxo-route=\"home\"][data-pxo-hero=\"1\"] %PageHeader-pageHeader {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 10px;\n  z-index: 5;\n  transition: background var(--pxo-med) var(--pxo-ease), box-shadow var(--pxo-med) var(--pxo-ease);\n}\nhtml[data-pxo-route=\"home\"][data-pxo-hero=\"1\"][data-pxo-scrolled=\"1\"] %PageHeader-pageHeader {\n  background: rgba(12, 14, 20, 0.94) !important;\n  box-shadow: 0 1px 0 var(--pxo-line);\n}\nhtml[data-pxo-route=\"home\"][data-pxo-hero=\"1\"] %PageContent-pageContentScroller {\n  top: 0 !important;\n}\n\n@media (max-width: 720px) {\n  .pxo-hero {\n    min-height: 0;\n    padding-top: 64px;\n  }\n  .pxo-hero-body { min-height: 0; }\n  .pxo-hero-logo { max-height: 84px; }\n  .pxo-hero-title { font-size: 32px; }\n  .pxo-hero-summary { -webkit-line-clamp: 2; font-size: 14px; }\n  .pxo-hero-thumb { width: 104px; }\n  .pxo-hero-arrow { display: none; }\n  .pxo-hero-nav { margin-top: 20px; }\n}\n");

// ---- elements/hero
// Home page hero: Continue Watching items first, then recently added movies
// and shows. Manual navigation only, unless "Hero autoplay" is on.
PXO.element({
  name: "hero",
  init() {
    const { h, api } = PXO;
    const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 2000 }) : (fn) => setTimeout(fn, 300);
    let node = null;
    let slides = [];
    let index = 0;
    let timer = 0;
    let loading = null;

    const fmtDuration = (ms) => {
      const m = Math.round(ms / 60000);
      return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
    };

    function toSlide(item, kind, mid) {
      const ep = item.type === "episode";
      const showKey = ep ? item.grandparentRatingKey : item.ratingKey;
      const art = ep ? item.grandparentArt || item.art : item.art;
      const logo = ep ? `/library/metadata/${item.grandparentRatingKey}/clearLogo` : api.imageOf(item, "clearLogo");
      const meta = [];
      if (ep) meta.push(`S${item.parentIndex} · E${item.index}`);
      if (item.year && !ep) meta.push(String(item.year));
      if (item.contentRating) meta.push(item.contentRating);
      if (item.duration) meta.push(fmtDuration(item.duration));
      (item.Genre || []).slice(0, 2).forEach((g) => meta.push(g.tag));
      return {
        id: item.ratingKey,
        showKey,
        kind,
        label: kind === "deck" ? "Continue watching" : `New in ${item.librarySectionTitle || "your library"}`,
        title: ep ? item.grandparentTitle : item.title,
        subtitle: ep ? item.title : item.tagline || "",
        summary: item.summary || "",
        meta,
        rating: item.audienceRating,
        art: api.img(art, 1920, 1080),
        thumb: api.img(art, 400, 225),
        logo: logo ? api.img(logo, 840, 320) : "",
        progress: item.viewOffset && item.duration ? item.viewOffset / item.duration : 0,
        colors: item.UltraBlurColors,
        href: `#!/server/${mid}/details?key=${encodeURIComponent(`/library/metadata/${item.ratingKey}`)}`,
      };
    }

    async function load() {
      const mid = await api.machineId();
      const [deck, movies, shows] = await Promise.all([
        api.get("/hubs/home/continueWatching?X-Plex-Container-Size=6").catch(() => ({})),
        api.get("/hubs/home/recentlyAdded?type=1&X-Plex-Container-Size=6").catch(() => ({})),
        api.get("/hubs/home/recentlyAdded?type=2&X-Plex-Container-Size=4").catch(() => ({})),
      ]);
      const seen = new Set();
      const out = [];
      const add = (list, kind) =>
        (list || []).forEach((it) => {
          const s = toSlide(it, kind, mid);
          if (!s.art || seen.has(s.showKey)) return;
          seen.add(s.showKey);
          out.push(s);
        });
      add((deck.Metadata || []).slice(0, 5), "deck");
      add(movies.Metadata, "new");
      add(shows.Metadata, "new");
      return out.slice(0, 10);
    }

    // Plays through Plex's own UI: open the item, press its Play button, and for
    // a partly watched item answer Plex's "Resume Playback" list with its first
    // entry ("Resume from …").
    function play(slide) {
      location.hash = slide.href.slice(1);
      const started = Date.now();
      const waitFor = (find, then, ms) => {
        const tick = () => {
          const el = find();
          if (el) return then(el);
          if (Date.now() - started < ms) setTimeout(tick, 120);
        };
        setTimeout(tick, 120);
      };
      waitFor(() => PXO.$(PXO.tid("preplay-play")), (btn) => {
        btn.click();
        if (slide.progress) {
          waitFor(() => PXO.$(`#modal-root ${PXO.sc("ListModalItem-listModalItem")}`), (item) => item.click(), 10000);
        }
      }, 8000);
    }

    function renderSlide() {
      if (!node || !slides.length) return;
      const s = slides[index];
      const body = node.querySelector(".pxo-hero-body");
      const title = s.logo
        ? h("img.pxo-hero-logo", { src: s.logo, alt: s.title, onerror: (e) => e.target.replaceWith(h("h1.pxo-hero-title", {}, s.title)) })
        : h("h1.pxo-hero-title", {}, s.title);
      body.replaceChildren(
        h("div.pxo-hero-content", {},
          h("div.pxo-hero-label", {}, h("i"), s.label),
          title,
          h("div.pxo-hero-meta", {},
            s.rating ? h("span.pxo-hero-rating", {}, `★ ${Number(s.rating).toFixed(1)}`) : null,
            ...s.meta.map((m) => h("span", {}, m))),
          s.subtitle ? h("div.pxo-hero-subtitle", {}, s.subtitle) : null,
          h("p.pxo-hero-summary", {}, s.summary),
          s.progress ? h("div.pxo-hero-progress", {}, h("i", { style: { width: `${Math.round(s.progress * 100)}%` } })) : null,
          h("div.pxo-hero-actions", {},
            h("button.pxo-btn.pxo-btn--primary", { type: "button", onclick: () => play(s) },
              PXO.svg(PXO.icons.play, 18), s.progress ? "Resume" : "Play"),
            h("a.pxo-btn", { href: s.href }, PXO.svg(PXO.icons.info, 18), "Details")))
      );
      node.querySelectorAll(".pxo-hero-thumb").forEach((t, i) => t.classList.toggle("is-on", i === index));
      // Scroll only the strip (scrollIntoView would also scroll the page), and
      // read its geometry a frame later: reading it right after replacing the
      // hero content would force a synchronous layout of the whole page.
      if (index > 0 || node.querySelector(".pxo-hero-strip").scrollLeft > 0) {
        requestAnimationFrame(() => {
          const strip = node.querySelector(".pxo-hero-strip");
          const on = strip && strip.children[index];
          if (!on) return;
          const left = on.offsetLeft - (strip.clientWidth - on.clientWidth) / 2;
          strip.scrollTo({ left, behavior: PXO.settings.reducedMotion() ? "auto" : "smooth" });
        });
      }
      PXO.backdrop && PXO.backdrop.show(s.art, s.colors);
      // Decode the next slide's art while idle, so the arrow is instant.
      const next = slides[(index + 1) % slides.length];
      idle(() => PXO.art.decode(next.art).catch(() => {}));
      schedule();
    }

    function go(i) {
      index = (i + slides.length) % slides.length;
      renderSlide();
    }

    function schedule() {
      clearTimeout(timer);
      if (PXO.settings.get("heroAutoplay") && !PXO.settings.reducedMotion() && !document.hidden && node && !node.matches(":hover")) {
        timer = setTimeout(() => go(index + 1), 9000);
      }
    }

    function build() {
      const strip = h("div.pxo-hero-strip", {},
        ...slides.map((s, i) =>
          h("button.pxo-hero-thumb", { type: "button", title: s.title, onclick: () => go(i), style: { backgroundImage: `url("${s.thumb}")` } },
            s.progress ? h("i", { style: { width: `${Math.round(s.progress * 100)}%` } }) : null)));
      const onKey = (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        go(index + (e.key === "ArrowRight" ? 1 : -1));
      };
      const el = h("section.pxo-hero", {
        "aria-roledescription": "carousel",
        "aria-label": "Featured",
        onmouseenter: () => clearTimeout(timer),
        onmouseleave: schedule,
        onkeydown: onKey,
      },
        h("div.pxo-hero-body"),
        h("div.pxo-hero-nav", {},
          h("button.pxo-hero-arrow", { type: "button", "aria-label": "Previous", onclick: () => go(index - 1) }, PXO.svg(PXO.icons.left, 18)),
          strip,
          h("button.pxo-hero-arrow", { type: "button", "aria-label": "Next", onclick: () => go(index + 1) }, PXO.svg(PXO.icons.right, 18))));
      return el;
    }

    function remove() {
      clearTimeout(timer);
      node && node.remove();
      delete document.documentElement.dataset.pxoHero;
    }

    // Slides from the last visit, shown at once while fresh data loads, so the
    // hero is in place when the rows render instead of pushing them down later.
    // Kept per user: Plex Home users share the browser.
    const CACHE = "pxo.hero.v2";
    const readCache = () => {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE) || "null");
        return c && c.user === api.userKey() ? c.slides : [];
      } catch (e) { return []; }
    };
    const writeCache = (list) => {
      try { localStorage.setItem(CACHE, JSON.stringify({ user: api.userKey(), slides: list })); } catch (e) {}
    };
    let slidesUser = null;

    // A failed or empty load is not retried on every DOM change; wait 5 min.
    let lastLoad = 0;
    function refresh() {
      if (loading || Date.now() - lastLoad < 5 * 60 * 1000) return;
      lastLoad = Date.now();
      loading = load().then((fresh) => {
        loading = null;
        writeCache(fresh);
        const same = fresh.map((s) => s.id).join() === slides.map((s) => s.id).join();
        slides = fresh;
        if (!same && node) {
          const was = node;
          node = build();
          index = 0;
          if (was.isConnected) { was.replaceWith(node); renderSlide(); }
        }
        ensure();
      }, (e) => { loading = null; PXO.log("hero load failed", e); });
    }

    function ensure() {
      if (!PXO.settings.get("hero") || PXO.route().name !== "home") return remove();
      // A different Plex Home user: drop the previous user's slides.
      if (slidesUser !== api.userKey()) {
        slidesUser = api.userKey();
        if (slides.length) {
          slides = [];
          remove();
          node = null;
        }
      }
      // Cheap exit for the common case: already first in the page content.
      if (node && node.isConnected && node.parentElement.firstElementChild === node) return;
      // Insert as soon as the home page's content scroller exists, before the
      // rows render, so adding the hero does not shift them. During a route
      // change the previous page's scroller can still be in place for a frame,
      // and Plex shows a spinner page while loading; both are skipped.
      const host = PXO.$(PXO.sc("PageContent-pageContentScroller"));
      if (!host || host.matches(PXO.sc("EmptyPageContent-emptyPageContentScroller")) ||
        host.querySelector(PXO.sc("PrePlayPageContent-prePlayContentWrapper"))) return;
      if (!slides.length) slides = readCache();
      if (!slides.length) {
        refresh();
        return;
      }
      if (!node) {
        node = build();
        refresh();
      }
      host.prepend(node);
      document.documentElement.dataset.pxoHero = "1";
      renderSlide();
    }

    // Darken the backdrop as the rows scroll up over it, once per frame at most.
    let scrollQueued = false;
    const onScroll = (e) => {
      const t = e.target;
      if (scrollQueued || !node || !(t instanceof Element) || !t.contains(node)) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        PXO.backdrop && PXO.backdrop.shade(Math.min(1, t.scrollTop / 520));
      });
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });

    const offMut = PXO.onMutate(ensure, { immediate: true });
    const offRoute = PXO.onRoute(() => ensure());
    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);
    const offSet = PXO.settings.onChange((k) => {
      if (k === "hero") ensure();
      if (k === "heroAutoplay") schedule();
    });
    ensure();

    return () => {
      offMut();
      offRoute();
      offSet();
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      remove();
    };
  },
});

PXO.addCss("elements/hubs", "/* Horizontal rows (\"hubs\") on home, library and details pages. */\n%VirtualHubScroller-hub {\n  position: relative;\n}\n/* Opacity only: Plex's virtual lists track row positions, and a moving\n   transform makes them recompute on every frame of the animation. */\n%VirtualHubScroller-hub.pxo-in {\n  animation: pxo-fade var(--pxo-slow) var(--pxo-ease) both;\n  animation-delay: calc(var(--pxo-i, 0) * 60ms);\n}\n\n%VirtualHubScroller-hubHeader {\n  align-items: flex-end;\n  margin-bottom: 4px;\n}\n%VirtualHubScroller-hubHeader [data-testid=\"hubTitle\"],\n%VirtualHubScroller-hubHeader h2 {\n  font: 700 21px/1.2 var(--pxo-font) !important;\n  letter-spacing: -0.02em !important;\n  color: var(--pxo-fg) !important;\n}\n%VirtualHubScroller-hubHeader a:hover [data-testid=\"hubTitle\"],\n%VirtualHubScroller-hubHeader a[data-testid=\"hubTitle\"]:hover {\n  background: var(--pxo-grad);\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent !important;\n}\n\n/* Prev / next page: round glass buttons. */\n%VirtualHubScroller-hubActions { gap: 6px; }\n%VirtualHubScroller-hubScrollButton {\n  width: 32px !important;\n  height: 32px !important;\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: 50% !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  color: var(--pxo-fg) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), opacity var(--pxo-fast) var(--pxo-ease);\n}\n%VirtualHubScroller-hubScrollButton svg { width: 14px !important; height: 14px !important; }\n%VirtualHubScroller-hubScrollButton:hover { background: rgba(255, 255, 255, 0.14) !important; }\n%VirtualHubScroller-hubScrollButton%IconButton-isDisabled { opacity: 0.25; }\n\n/* Page header (breadcrumb + pivot tabs) */\n%PageHeader-pageHeader {\n  background: transparent !important;\n}\n%PageHeaderBreadcrumbButton-link,\n%PageHeaderTitle-title {\n  font: 700 18px var(--pxo-font) !important;\n  letter-spacing: -0.015em;\n}\n%PageHeaderTitle-detail { color: var(--pxo-fg-3) !important; }\n%PivotTabsPageHeaderCenter-pageHeaderCenter {\n  gap: 2px;\n}\n%TabButton-button {\n  position: relative;\n  display: inline-flex !important;\n  align-items: center;\n  align-self: center;\n  height: 34px !important;\n  line-height: 34px !important;\n  margin: 0 2px;\n  padding: 0 16px !important;\n  border-radius: 99px !important;\n  color: var(--pxo-fg-2) !important;\n  font: 600 14px var(--pxo-font) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n%TabButton-button::after { display: none !important; }\n%TabButton-button:hover { color: var(--pxo-fg) !important; background: rgba(255, 255, 255, 0.06); }\n%TabButton-button%TabButton-selected {\n  color: var(--pxo-fg) !important;\n  background: rgba(255, 255, 255, 0.1);\n  box-shadow: inset 0 0 0 1px var(--pxo-line-strong);\n}\n%TabButton-button%TabButton-selected > * { border-bottom-color: transparent !important; }\n\n/* Poster size slider */\n%MetadataListStylesMenu-slider %Slider-track { background: var(--pxo-ink-4) !important; }\n%Slider-thumb {\n  background: var(--pxo-fg) !important;\n  box-shadow: 0 0 0 4px color-mix(in srgb, var(--pxo-a3) 30%, transparent);\n}\n\n/* Detail / list view rows in libraries */\n%ListRow-row {\n  border-radius: var(--pxo-radius);\n  transition: background var(--pxo-fast) var(--pxo-ease);\n}\n%ListRow-row:hover { background: rgba(255, 255, 255, 0.05) !important; }\n%MetadataDetailsRow-title { font-weight: 600 !important; letter-spacing: -0.01em; }\n");

// ---- elements/hubs
// Rows fade up once, in order, the first time they appear after a navigation.
PXO.element({
  name: "hubs",
  init() {
    const seen = new WeakSet();
    let batch = 0;

    const scan = () => {
      const hubs = PXO.$$(PXO.sc("VirtualHubScroller-hub"));
      let i = 0;
      for (const hub of hubs) {
        if (seen.has(hub)) continue;
        seen.add(hub);
        hub.style.setProperty("--pxo-i", String(Math.min(batch + i++, 8)));
        hub.classList.add("pxo-in");
      }
      batch += i;
    };

    const offRoute = PXO.onRoute(() => { batch = 0; });
    // Immediate, so a new row is hidden before its first paint instead of
    // showing for a frame and then fading in.
    const offMut = PXO.onMutate(scan, { immediate: true });
    scan();

    return () => {
      offRoute();
      offMut();
      PXO.$$(".pxo-in").forEach((n) => n.classList.remove("pxo-in"));
    };
  },
});

PXO.addCss("elements/menus", "/* Radix popovers and menus (account menu, overflow \"...\", sort/filter). */\n[data-radix-popper-content-wrapper] > div,\n[role=\"menu\"],\n[role=\"listbox\"]:not([id^=\"downshift-\"]) {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius) !important;\n  background: var(--pxo-glass-strong) !important;\n  backdrop-filter: blur(20px) saturate(1.3);\n  box-shadow: var(--pxo-shadow-2) !important;\n  animation: pxo-menu-in var(--pxo-med) var(--pxo-ease) both;\n}\n[role=\"menuitem\"],\n[role=\"menuitemradio\"],\n[role=\"menuitemcheckbox\"],\n[role=\"option\"] {\n  margin: 2px 6px;\n  border-radius: var(--pxo-radius-s) !important;\n  font-family: var(--pxo-font) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n[role=\"menuitem\"]:hover,\n[role=\"menuitem\"][data-highlighted],\n[role=\"menuitemradio\"][data-highlighted],\n[role=\"menuitemcheckbox\"][data-highlighted],\n[role=\"option\"][aria-selected=\"true\"],\n[role=\"option\"]:hover {\n  background: rgba(255, 255, 255, 0.08) !important;\n  color: var(--pxo-fg) !important;\n}\n[role=\"menuitemradio\"][data-state=\"checked\"],\n[role=\"menuitemcheckbox\"][data-state=\"checked\"] { color: var(--pxo-a1) !important; }\n\n/* Universal search results dropdown. Plex's menu element is ~0px tall; its\n   child is a popper wrapper (position: fixed, placed with an inline transform),\n   so it gets colours only: no margin, and no transform animation, which would\n   override the positioning transform. */\n[id^=\"downshift-\"][id$=\"-menu\"] > div {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius-l) !important;\n  background: rgba(12, 14, 20, 0.97) !important;\n  box-shadow: var(--pxo-shadow-2);\n  overflow: hidden;\n}\n\n/* Modals */\n#modal-root [role=\"dialog\"] {\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius-l) !important;\n  background: var(--pxo-ink-2) !important;\n  box-shadow: var(--pxo-shadow-2) !important;\n  overflow: hidden;\n  animation: pxo-dialog-in var(--pxo-med) var(--pxo-ease) both;\n}\n\n/* Tooltips */\n[role=\"tooltip\"] {\n  border-radius: var(--pxo-radius-s) !important;\n  background: var(--pxo-ink-4) !important;\n  color: var(--pxo-fg) !important;\n  font: 500 12px var(--pxo-font) !important;\n}\n\n@keyframes pxo-menu-in {\n  from { opacity: 0; transform: translateY(-4px) scale(0.98); }\n  to { opacity: 1; transform: none; }\n}\n@keyframes pxo-dialog-in {\n  from { opacity: 0; transform: translateY(12px) scale(0.985); }\n  to { opacity: 1; transform: none; }\n}\n\n/* React modals in #modal-root (Resume Playback, confirmations, info dialogs) */\n%Modal-modalBackdrop {\n  background: rgba(4, 5, 8, 0.72) !important;\n  backdrop-filter: blur(8px);\n}\n%ModalContent-modalContent {\n  border: 1px solid var(--pxo-line-strong);\n  border-radius: var(--pxo-radius-l) !important;\n  background: var(--pxo-glass-strong) !important;\n  backdrop-filter: blur(24px) saturate(1.2);\n  box-shadow: var(--pxo-shadow-2) !important;\n  overflow: hidden;\n  animation: pxo-dialog-in var(--pxo-med) var(--pxo-ease) both;\n}\n%ModalHeader-modalHeader {\n  color: var(--pxo-fg) !important;\n  font: 700 18px var(--pxo-font) !important;\n  letter-spacing: -0.015em;\n}\n%ModalHeader-modalHeader * { font-family: var(--pxo-font) !important; }\n%ModalContent-closeButton { color: var(--pxo-fg-2) !important; }\n%ModalContent-closeButton:hover { color: var(--pxo-fg) !important; }\n%ModalBody-modalBody { background: transparent !important; }\n%ListModal-listModalInnerBody { padding: 0 10px 12px; }\n%ListModalItem-listModalItem {\n  margin: 2px 0;\n  border: 0 !important;\n  border-radius: var(--pxo-radius) !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  color: var(--pxo-fg-2) !important;\n  font: 500 15px var(--pxo-font) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n%ListModalItem-listModalItem:hover,\n%ListModalItem-listModalItem.isFocused {\n  background: rgba(255, 255, 255, 0.07) !important;\n  color: var(--pxo-fg) !important;\n}\n\n/* Account menu: profile header at the top of the popout */\n%NavBarAccountMenu-profile {\n  position: relative;\n  width: auto !important;\n  margin: 6px 6px 4px;\n  border-radius: calc(var(--pxo-radius) - 2px);\n  background: var(--pxo-grad-soft) !important;\n  box-shadow: inset 0 0 0 1px var(--pxo-line);\n  overflow: hidden;\n}\n%NavBarAccountMenu-profile [role=\"menuitem\"] {\n  margin: 0 !important;\n  border-radius: inherit !important;\n}\n%NavBarAccountMenu-profile [role=\"menuitem\"]:hover,\n%NavBarAccountMenu-profile [role=\"menuitem\"][data-highlighted] {\n  background: rgba(255, 255, 255, 0.05) !important;\n}\n%NavBarAccountMenu-avatarWrapper > div {\n  border-radius: 50% !important;\n  box-shadow: 0 0 0 3px var(--pxo-ink-2), 0 0 0 5px var(--pxo-a3);\n}\n%NavBarAccountMenu-profileContainer span {\n  color: var(--pxo-fg) !important;\n  font: 700 16px var(--pxo-font) !important;\n  letter-spacing: -0.01em;\n}\n[role=\"menu\"] [role=\"separator\"] {\n  height: 1px;\n  margin: 6px 12px;\n  background: var(--pxo-line-strong) !important;\n}\n\n/* Plex's older menu component (list style, sort, filter, \"...\" menus). It is\n   not a role=\"menu\" element, so it needs its own rules. */\n%Menu-menu {\n  padding: 4px 0;\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: var(--pxo-radius) !important;\n  background: var(--pxo-glass-strong) !important;\n  backdrop-filter: blur(20px) saturate(1.3);\n  box-shadow: var(--pxo-shadow-2) !important;\n  overflow: hidden;\n}\n%MenuItem-menuItem { font-family: var(--pxo-font) !important; }\n%MenuItem-menuItem:hover,\n%MenuItem-menuItem:focus-visible {\n  background: rgba(255, 255, 255, 0.08) !important;\n}\n%SelectedMenuItem-menuLabel { font-family: var(--pxo-font) !important; }\n");

PXO.addCss("elements/page-transition", ".pxo-enter {\n  animation: pxo-fade var(--pxo-med) var(--pxo-ease) both;\n}\n");

// ---- elements/page-transition
// Each navigation fades the new page's content in. Plex swaps the content
// scroller on route change, so the class is applied to whichever is current.
PXO.element({
  name: "page-transition",
  init() {
    let pending = false;
    let tagged = null;

    const apply = () => {
      if (!pending) return;
      const page = PXO.$(PXO.sc("PageContent-pageContentScroller"));
      if (!page) return;
      pending = false;
      tagged && tagged.classList.remove("pxo-enter");
      tagged = page;
      page.classList.remove("pxo-enter");
      void page.offsetWidth; // restart the animation when the node is reused
      page.classList.add("pxo-enter");
    };

    const offRoute = PXO.onRoute(() => {
      pending = true;
      requestAnimationFrame(apply);
    });
    const offMut = PXO.onMutate(apply);

    return () => {
      offRoute();
      offMut();
      tagged && tagged.classList.remove("pxo-enter");
    };
  },
});

PXO.addCss("elements/player", "/* Player controls: the bottom bar shown while something plays in the\n   background (mini player) and the control bar of the full-screen player.\n   Both use the same SeekBar / PlayerIconButton components. */\n\n/* Mini player: a floating glass bar instead of Plex's grey strip. */\n%Player-miniPlayerContainer {\n  background: transparent !important;\n}\n%Player-miniPlayerContainer %BottomBar-bottomBar {\n  /* Plex positions it relative, full width; inset it with margins. */\n  width: auto !important;\n  margin: 0 12px;\n  top: -10px;\n  border: 1px solid var(--pxo-line-strong);\n  border-radius: var(--pxo-radius-l);\n  /* No backdrop-filter or transform here: either makes the bar a stacking\n     context, which drops the poster's \"Expand Player\" button (z-index 2)\n     under the preview video's wrapper (z-index 1). */\n  background: rgba(14, 16, 22, 0.94) !important;\n  box-shadow: 0 -10px 40px -18px rgba(0, 0, 0, 0.9), var(--pxo-shadow-2);\n}\n%Player-miniPlayerContainer video,\n%MiniPlayerPoster-miniPlayerPoster,\n%MiniPlayerPoster-card,\n%MiniPlayerPoster-expandButton {\n  border-radius: var(--pxo-radius) !important;\n  overflow: hidden;\n}\n/* The preview video sits on top of the poster's \"Expand Player\" button; keep\n   it exactly over the button (bar inset 12px, raised 10px) and let clicks\n   through to the button. */\n%Player-miniPlayerContainer video {\n  left: 13px !important;\n  bottom: 11px !important;\n  pointer-events: none;\n}\n%MiniPlayerPoster-expandButton {\n  transition: background var(--pxo-fast) var(--pxo-ease) !important;\n}\n%MiniPlayerPoster-expandButton:not(:hover) { background: transparent !important; }\n\n/* Title / year / time */\n%PlayerControlsMetadata-container * { font-family: var(--pxo-font) !important; }\n%PlayerControlsMetadata-container [data-testid=\"metadataTitleLink\"],\n%PlayerControlsMetadata-container %MetadataPosterTitle-title:first-child {\n  color: var(--pxo-fg) !important;\n  font-weight: 700 !important;\n  letter-spacing: -0.01em;\n}\n%MetadataPosterTitle-isSecondary,\n%DurationRemaining-container {\n  color: var(--pxo-fg-3) !important;\n  font-variant-numeric: tabular-nums;\n}\n%MediaInfo-info {\n  border-radius: 6px !important;\n  background: rgba(255, 255, 255, 0.07) !important;\n}\n\n/* Seek bar */\n/* Plex sizes and moves these with transforms (scaleX on the fills, translate\n   on the track), so no transitions or radii on them: both distort. */\n%SeekBar-seekBarTrack,\n%Slider-track {\n  background: rgba(255, 255, 255, 0.1) !important;\n}\n%SeekBar-seekBarBuffer { background: rgba(255, 255, 255, 0.16) !important; }\n%SeekBar-seekBarFill,\n%VolumeSlider-fill {\n  background: var(--pxo-grad) !important;\n}\n%SeekBar-seekBar %Slider-thumb,\n%VolumeSlider-slider %Slider-thumb {\n  background: #fff !important;\n  box-shadow: 0 0 0 4px color-mix(in srgb, var(--pxo-a2) 35%, transparent), 0 2px 8px rgba(0, 0, 0, 0.5);\n}\n\n/* Buttons */\n%PlayerIconButton-playerButton {\n  border-radius: 50% !important;\n  color: var(--pxo-fg-2) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease),\n    transform var(--pxo-fast) var(--pxo-ease) !important;\n}\n%PlayerIconButton-playerButton:hover {\n  background: rgba(255, 255, 255, 0.09) !important;\n  color: var(--pxo-fg) !important;\n}\n%PlayerIconButton-playerButton:active { transform: scale(0.92); }\n%PlayerIconButton-playerButton%IconButton-isDisabled { opacity: 0.3; }\n/* Play / pause: gradient disc */\n%PlayerIconButton-isPrimary {\n  background: var(--pxo-grad) !important;\n  color: var(--pxo-on-a1) !important;\n  box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--pxo-a2) 80%, transparent);\n  transform: scale(1.25);\n}\n%PlayerIconButton-isPrimary:hover {\n  background: var(--pxo-grad) !important;\n  color: var(--pxo-on-a1) !important;\n  filter: brightness(1.08);\n}\n%PlayerIconButton-isPrimary:active { transform: scale(1.15); }\n%PlayerControls-buttonGroupCenter { gap: 6px; }\n\n/* Full-screen player: softer gradient behind the control bar. */\n%Player-fullPlayerContainer %BottomBar-bottomBar,\n%FullPlayerTopControls-topControls {\n  font-family: var(--pxo-font) !important;\n}\n");

PXO.addCss("elements/poster-card", "/* Poster cards: rounded, lift on hover, gradient progress. The cells are\n   positioned by Plex's virtual list, so only the inner parts move. The lift\n   uses the `translate` property, which adds to an element's `transform`:\n   some of these parts (the details-page play button) are centred by Plex\n   with transform: translate(-50%, -50%), which `transform` would replace. */\n%PosterCard-card,\n%MetadataSimplePosterCard-card {\n  border-radius: var(--pxo-radius) !important;\n  overflow: visible !important;\n}\n%MetadataSimplePosterCard-image,\n%PosterCard-card %ImagePoster-flex {\n  border-radius: var(--pxo-radius) !important;\n  overflow: hidden;\n  background-color: var(--pxo-ink-2) !important;\n  box-shadow: var(--pxo-shadow-1), inset 0 0 0 1px var(--pxo-line);\n  transition: translate var(--pxo-med) var(--pxo-ease), box-shadow var(--pxo-med) var(--pxo-ease);\n}\n%MetadataSimplePosterCard-image > *,\n%MetadataSimplePosterCard-image img {\n  border-radius: inherit;\n}\n/* Hover ring is drawn inside the poster: Plex's row scrollers clip anything\n   outside the card, and there are only 4px above it. */\n%MetadataSimplePosterCard-image { position: relative; }\n%MetadataSimplePosterCard-image::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: 2;\n  border-radius: inherit;\n  box-shadow: inset 0 0 0 2px var(--pxo-a3);\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity var(--pxo-med) var(--pxo-ease);\n}\n\n%PosterCard-card:hover %MetadataSimplePosterCard-image,\n%MetadataSimplePosterCard-card:hover %MetadataSimplePosterCard-image,\n%PosterCardLink-link:focus-visible ~ %MetadataSimplePosterCard-image {\n  translate: 0 -3px;\n  box-shadow: var(--pxo-shadow-2);\n}\n%PosterCard-card:hover %MetadataSimplePosterCard-image::after,\n%MetadataSimplePosterCard-card:hover %MetadataSimplePosterCard-image::after,\n%PosterCardLink-link:focus-visible ~ %MetadataSimplePosterCard-image::after {\n  opacity: 1;\n}\n\n/* Plex's hover overlay: soften it and tint toward the accent. */\n%PosterCardLink-link {\n  border-radius: var(--pxo-radius) !important;\n  transition: translate var(--pxo-med) var(--pxo-ease), background var(--pxo-med) var(--pxo-ease) !important;\n}\n%PosterCard-card:hover %PosterCardLink-link,\n%MetadataSimplePosterCard-card:hover %PosterCardLink-link {\n  translate: 0 -3px;\n  background: linear-gradient(0deg, rgba(7, 8, 12, 0.55), rgba(7, 8, 12, 0) 55%) !important;\n  border: 0 !important;\n  box-shadow: none !important;\n}\n%PosterCardLink-link * { border-color: transparent !important; }\n\n/* Progress bar sits inside the bottom of the image. */\n%MetadataPosterCardProgressBar-progress {\n  left: 8px !important;\n  right: 8px !important;\n  width: auto !important;\n  bottom: 8px !important;\n  height: 4px !important;\n  border-radius: 4px;\n  overflow: hidden;\n  transition: translate var(--pxo-med) var(--pxo-ease);\n}\n%PosterCard-card:hover %MetadataPosterCardProgressBar-progress,\n%MetadataSimplePosterCard-card:hover %MetadataPosterCardProgressBar-progress {\n  translate: 0 -3px;\n}\n%MetadataPosterCardProgressBar-track { background: rgba(255, 255, 255, 0.22) !important; }\n%MetadataPosterCardProgressBar-bar {\n  background: var(--pxo-grad) !important;\n  border-radius: 4px;\n}\n\n/* Watched / unwatched-count badges. The offset is for full-size cards in\n   rows and grids; list views keep Plex's own placement. */\n%MetadataPosterListItem-card %MetadataPosterCardBadge-badge {\n  top: 8px !important;\n  right: 8px !important;\n}\n%MetadataPosterCardBadge-badge {\n  transition: translate var(--pxo-med) var(--pxo-ease);\n}\n%MetadataPosterCardBadge-badgeBackground {\n  border-radius: 99px !important;\n  background: var(--pxo-glass-strong) !important;\n  box-shadow: inset 0 0 0 1px var(--pxo-line-strong);\n}\n%MetadataPosterCardBadge-badge svg { color: var(--pxo-good) !important; }\n%PosterCard-card:hover %MetadataPosterCardBadge-badge,\n%MetadataSimplePosterCard-card:hover %MetadataPosterCardBadge-badge {\n  translate: 0 -3px;\n}\n\n/* Titles under the card */\n%MetadataPosterCardTitle-title {\n  font: 500 13.5px/1.35 var(--pxo-font) !important;\n  color: var(--pxo-fg-3) !important;\n  text-align: left !important;\n  padding: 0 2px;\n}\na%MetadataPosterCardTitle-title:first-of-type,\n[data-testid=\"metadataTitleLink\"] {\n  margin-top: 6px;\n  color: var(--pxo-fg) !important;\n  font-weight: 600 !important;\n}\na%MetadataPosterCardTitle-title:hover,\n%MetadataPosterCardTitle-title a:hover {\n  color: var(--pxo-a1) !important;\n  text-decoration: none !important;\n}\n\n\n/* Play circle shown on hover (Plex hard-codes its yellow here). */\n%PlayButton-playCircle {\n  background: var(--pxo-grad) !important;\n  color: var(--pxo-on-a1) !important;\n  box-shadow: 0 8px 24px -8px color-mix(in srgb, var(--pxo-a2) 80%, transparent);\n  transition: scale var(--pxo-fast) var(--pxo-ease) !important;\n}\n%PlayButton-playCircle svg { fill: currentColor; color: inherit !important; }\n%PosterCardLink-link:hover %PlayButton-playCircle,\n%PlayButton-playCircle:hover { scale: 1.08; }\n");

// ---- elements/prefetch
// Hovering a link to a details page for 120ms fetches and decodes that item's
// backdrop art, so it is ready when the page opens.
PXO.element({
  name: "prefetch",
  init() {
    let timer = 0;
    let pending = null;

    const onOver = (e) => {
      const a = e.target instanceof Element && e.target.closest('a[href*="/details?key="]');
      if (!a || a === pending) return;
      clearTimeout(timer);
      pending = a;
      const key = PXO.art.keyFromHref(a.getAttribute("href"));
      if (key) timer = setTimeout(() => PXO.art.prefetch(key), 120);
    };
    const onOut = (e) => {
      if (pending && !pending.contains(e.relatedTarget)) {
        clearTimeout(timer);
        pending = null;
      }
    };

    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
    };
  },
});

PXO.addCss("elements/preplay", "/* Details (\"pre-play\") page for movies, shows, seasons and episodes. */\n%PrePlayMetadata-container {\n  padding-top: clamp(24px, 8vh, 96px);\n  animation: pxo-fade var(--pxo-slow) var(--pxo-ease) both;\n}\n\n[data-testid=\"metadata-poster\"] %PosterCard-card %MetadataSimplePosterCard-image {\n  border-radius: var(--pxo-radius-l) !important;\n  box-shadow: 0 30px 60px -24px rgba(0, 0, 0, 0.9), inset 0 0 0 1px var(--pxo-line);\n}\n/* The details poster does not lift: everything on it stays put on hover. */\n[data-testid=\"metadata-poster\"] %PosterCard-card:hover * { translate: none !important; }\n%PrePlayPosterCardPlayedStatus-status {\n  background: transparent !important;\n  color: var(--pxo-fg-3) !important;\n  font: 500 13px var(--pxo-font);\n}\n\n[data-testid=\"metadata-title\"] {\n  font: 800 clamp(34px, 3.6vw, 60px)/1.04 var(--pxo-font) !important;\n  letter-spacing: -0.035em !important;\n  color: #fff !important;\n  text-wrap: balance;\n  margin-bottom: 6px;\n}\n[data-testid=\"metadata-subtitle\"] {\n  color: var(--pxo-fg-2) !important;\n  font: 500 15px var(--pxo-font) !important;\n}\n[data-testid=\"metadata-line1\"] {\n  color: var(--pxo-fg-2) !important;\n  font: 500 14px var(--pxo-font) !important;\n}\n[data-testid=\"metadata-line1\"] > * { color: inherit; }\n\n/* Ratings and the Rate & Review chip */\n[data-testid=\"metadata-ratings\"] {\n  gap: 4px;\n}\n[data-testid=\"metadata-ratings\"] > * {\n  padding: 5px 10px;\n  border-radius: 99px;\n  background: rgba(255, 255, 255, 0.06);\n  box-shadow: inset 0 0 0 1px var(--pxo-line);\n}\n[data-testid=\"metadata-starRatings\"] button,\n[data-testid=\"metadata-ratings\"] button {\n  border-radius: 99px !important;\n}\n\n/* Play button: gradient pill. Other actions: round glass buttons. */\n[data-testid=\"preplay-play\"] {\n  height: 48px !important;\n  padding: 0 28px 0 22px !important;\n  border: 0 !important;\n  border-radius: 99px !important;\n  background: var(--pxo-grad) !important;\n  color: var(--pxo-on-a1) !important;\n  font: 700 16px var(--pxo-font) !important;\n  box-shadow: 0 12px 34px -12px color-mix(in srgb, var(--pxo-a2) 80%, transparent);\n  transition: transform var(--pxo-fast) var(--pxo-ease), filter var(--pxo-fast) var(--pxo-ease),\n    box-shadow var(--pxo-med) var(--pxo-ease) !important;\n}\n[data-testid=\"preplay-play\"] * { color: inherit !important; fill: currentColor; }\n[data-testid=\"preplay-play\"]:hover {\n  filter: brightness(1.07);\n  box-shadow: 0 16px 40px -12px color-mix(in srgb, var(--pxo-a2) 95%, transparent);\n}\n[data-testid=\"preplay-play\"]:active { transform: scale(0.97); }\n\n[data-testid^=\"preplay-\"]:not([data-testid=\"preplay-play\"]) {\n  width: 48px !important;\n  height: 48px !important;\n  margin-left: 4px;\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: 50% !important;\n  background: rgba(255, 255, 255, 0.06) !important;\n  color: var(--pxo-fg) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), transform var(--pxo-fast) var(--pxo-ease),\n    border-color var(--pxo-fast) var(--pxo-ease) !important;\n}\n[data-testid^=\"preplay-\"]:not([data-testid=\"preplay-play\"]):hover {\n  background: rgba(255, 255, 255, 0.13) !important;\n  border-color: rgba(255, 255, 255, 0.28) !important;\n  transform: translateY(-2px);\n}\n[data-testid^=\"preplay-\"]:not([data-testid=\"preplay-play\"]) svg {\n  width: 20px !important;\n  height: 20px !important;\n}\n\n/* Summary + stream table */\n[data-testid=\"metadataSummary-summary\"] {\n  max-width: 68ch;\n  color: var(--pxo-fg-2) !important;\n  font: 400 15.5px/1.65 var(--pxo-font) !important;\n}\n[data-testid=\"metadataSummary-summary\"] button { color: var(--pxo-a1) !important; }\n%StreamDetailPropertiesTable-container {\n  display: inline-block;\n  margin-top: 18px;\n  padding: 14px 18px;\n  border-radius: var(--pxo-radius);\n  background: rgba(255, 255, 255, 0.035);\n  box-shadow: inset 0 0 0 1px var(--pxo-line);\n  font: 500 13.5px var(--pxo-font);\n}\n%StreamDetailPropertiesTable-container * { font-family: var(--pxo-font) !important; }\n\n/* Breadcrumb header on details pages */\n%PrePlayPageHeader-pageHeader { background: transparent !important; }\n\n/* Availability (\"Where to watch\") cells */\n%PrePlayAvailabilityItem-availabilityCell {\n  border-radius: var(--pxo-radius) !important;\n  background: rgba(255, 255, 255, 0.04) !important;\n  box-shadow: inset 0 0 0 1px var(--pxo-line);\n  transition: background var(--pxo-fast) var(--pxo-ease);\n}\n%PrePlayAvailabilityItem-availabilityCell:hover { background: rgba(255, 255, 255, 0.08) !important; }\n%ProviderAvailabilityItem-thumb { border-radius: 10px !important; overflow: hidden; }\n");

// ---- elements/preplay
// Details pages: show the item's own background art in the shared backdrop
// (Plex shows a blurred, darkened copy). Episodes and seasons use the show
// art. The lookup and decode are cached and usually already done by a hover
// prefetch (elements/prefetch).
PXO.element({
  name: "preplay",
  init() {
    let token = 0;

    const onRoute = async (r) => {
      if (r.name !== "details") return;
      const mine = ++token;
      // Cast pages and Discover items (#!/provider/...) are not items on this
      // server; clear the backdrop so the previous item's art doesn't linger.
      const m = /^\/library\/metadata\/(\d+)$/.exec(r.params.get("key") || "");
      if (!m || r.path.startsWith("/provider/")) {
        PXO.backdrop && PXO.backdrop.clear();
        return;
      }
      const art = await PXO.art.forKey(m[1]);
      if (mine !== token || !PXO.backdrop) return;
      if (art) PXO.backdrop.show(art.url, art.colors);
      else PXO.backdrop.clear(); // item without background art
    };

    const off = PXO.onRoute(onRoute);
    onRoute(PXO.route());
    return off;
  },
});

PXO.addCss("elements/search", "/* Search results page (#!/search) and the rows in the search dropdown. */\n%SearchResultListRow-container {\n  position: relative;\n  border-radius: var(--pxo-radius);\n  transition: background var(--pxo-fast) var(--pxo-ease);\n}\n%SearchResultListRow-container:hover,\n%SearchResultListRow-container:focus-within {\n  background: rgba(255, 255, 255, 0.05);\n}\n%SearchResultListRow-container img,\n%SearchResultListRow-container %ImagePoster-flex {\n  border-radius: var(--pxo-radius-s) !important;\n  overflow: hidden;\n}\n%SearchResultLinkUnderlay-underlay,\n%SearchResultCell-overlay {\n  border-radius: var(--pxo-radius) !important;\n}\n%SearchResultItemContentActions-actionLink,\n%SearchResultItemContentActions-toggleLink {\n  border-radius: 50% !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n%SearchResultItemContentActions-actionLink:hover,\n%SearchResultItemContentActions-toggleLink:hover {\n  background: rgba(255, 255, 255, 0.09) !important;\n}\n%SearchResultsPageHeader-chipsContainer { gap: 8px; }\n");

PXO.addCss("elements/settings-panel", ".pxo-panel {\n  position: fixed;\n  top: 68px;\n  right: 16px;\n  z-index: 2000;\n  width: min(340px, calc(100vw - 32px));\n  max-height: calc(100vh - 90px);\n  overflow-y: auto;\n  padding: 8px 18px 18px;\n  border: 1px solid var(--pxo-line-strong);\n  border-radius: var(--pxo-radius-l);\n  background: var(--pxo-glass-strong);\n  backdrop-filter: blur(24px) saturate(1.3);\n  box-shadow: var(--pxo-shadow-2);\n  color: var(--pxo-fg);\n  font: 400 14px var(--pxo-font);\n  transform-origin: top right;\n  animation: pxo-menu-in var(--pxo-med) var(--pxo-ease) both;\n}\n.pxo-panel:focus { outline: none; }\n.pxo-panel.is-closing {\n  opacity: 0;\n  transform: translateY(-4px) scale(0.98);\n  transition: opacity 180ms var(--pxo-ease), transform 180ms var(--pxo-ease);\n}\n\n.pxo-panel-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 8px 0 4px;\n}\n.pxo-panel-head b { font: 800 18px var(--pxo-font); letter-spacing: -0.02em; }\n.pxo-panel-head small { margin-left: 8px; color: var(--pxo-fg-3); font-size: 12px; }\n.pxo-panel-close {\n  display: inline-flex;\n  padding: 8px;\n  border: 0;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--pxo-fg-2);\n  cursor: pointer;\n}\n.pxo-panel-close:hover { background: rgba(255, 255, 255, 0.08); color: var(--pxo-fg); }\n\n.pxo-panel section { padding-top: 14px; }\n.pxo-panel h3 {\n  margin: 0 0 10px;\n  color: var(--pxo-fg-3);\n  font: 600 11px var(--pxo-font);\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n}\n\n.pxo-swatches { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }\n.pxo-swatch {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 10px;\n  border: 1px solid var(--pxo-line);\n  border-radius: var(--pxo-radius-s);\n  background: rgba(255, 255, 255, 0.03);\n  color: var(--pxo-fg-2);\n  font: 600 13px var(--pxo-font);\n  cursor: pointer;\n  transition: border-color var(--pxo-fast) var(--pxo-ease), background var(--pxo-fast) var(--pxo-ease);\n}\n.pxo-swatch i { width: 22px; height: 22px; border-radius: 50%; flex: 0 0 auto; }\n.pxo-swatch:hover { background: rgba(255, 255, 255, 0.07); }\n.pxo-swatch[aria-pressed=\"true\"] {\n  border-color: var(--pxo-a3);\n  color: var(--pxo-fg);\n  background: rgba(255, 255, 255, 0.07);\n}\n\n.pxo-seg {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  padding: 3px;\n  border-radius: 99px;\n  background: rgba(255, 255, 255, 0.05);\n  box-shadow: inset 0 0 0 1px var(--pxo-line);\n}\n.pxo-seg-btn {\n  min-width: 0;\n  height: 32px;\n  padding: 0 6px;\n  text-align: center;\n  border: 0;\n  border-radius: 99px;\n  background: transparent;\n  color: var(--pxo-fg-2);\n  font: 600 12.5px var(--pxo-font);\n  cursor: pointer;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n.pxo-seg-btn[aria-checked=\"true\"] { background: var(--pxo-fg); color: var(--pxo-ink-0); }\n\n.pxo-toggle {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  padding: 10px 0;\n  border-top: 1px solid var(--pxo-line);\n  cursor: pointer;\n}\n.pxo-toggle:first-of-type { border-top: 0; }\n.pxo-toggle-text { display: flex; flex-direction: column; gap: 2px; }\n.pxo-toggle-text b { font: 600 14px var(--pxo-font); }\n.pxo-toggle-text small { color: var(--pxo-fg-3); font-size: 12px; line-height: 1.35; }\n.pxo-toggle input { position: absolute; opacity: 0; pointer-events: none; }\n.pxo-toggle-track {\n  position: relative;\n  flex: 0 0 40px;\n  height: 24px;\n  border-radius: 99px;\n  background: var(--pxo-ink-4);\n  transition: background var(--pxo-med) var(--pxo-ease);\n}\n.pxo-toggle-track::after {\n  content: \"\";\n  position: absolute;\n  top: 3px;\n  left: 3px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\n  transition: transform var(--pxo-med) var(--pxo-ease);\n}\n.pxo-toggle input:checked + .pxo-toggle-track { background: var(--pxo-grad); }\n.pxo-toggle input:checked + .pxo-toggle-track::after { transform: translateX(16px); }\n.pxo-toggle input:focus-visible + .pxo-toggle-track { outline: 2px solid var(--pxo-a3); outline-offset: 2px; }\n");

// ---- elements/settings-panel
// Panel opened from the sliders button in the top bar.
PXO.element({
  name: "settings-panel",
  init() {
    const { h, settings } = PXO;
    let panel = null;

    const accents = [
      { id: "afterglow", name: "Afterglow", stops: ["#ffa66e", "#ff5f8a", "#8d7dff"] },
      { id: "aurora", name: "Aurora", stops: ["#5fe0b4", "#4cc3ff", "#8d7dff"] },
      { id: "ember", name: "Ember", stops: ["#ffc65c", "#ff7a45", "#ff3f6c"] },
      { id: "glacier", name: "Glacier", stops: ["#e6ebf7", "#a8b6d9", "#7f8dff"] },
    ];

    const segmented = (key, options) =>
      h("div.pxo-seg", { role: "radiogroup" },
        ...options.map(([value, label]) =>
          h("button.pxo-seg-btn", {
            type: "button",
            role: "radio",
            "aria-checked": String(settings.get(key) === value),
            onclick: () => { settings.set(key, value); render(); },
          }, label)));

    const toggle = (key, label, hint) =>
      h("label.pxo-toggle", {},
        h("span.pxo-toggle-text", {}, h("b", {}, label), hint ? h("small", {}, hint) : null),
        h("input", { type: "checkbox", checked: settings.get(key), onchange: (e) => settings.set(key, e.target.checked) }),
        h("i.pxo-toggle-track"));

    function render() {
      if (!panel) return;
      panel.replaceChildren(
        h("header.pxo-panel-head", {},
          h("div", {}, h("b", {}, "Overhaul"), h("small", {}, `v${PXO.version}`)),
          h("button.pxo-panel-close", { type: "button", "aria-label": "Close", onclick: close }, PXO.svg(PXO.icons.close, 18))),
        h("section", {},
          h("h3", {}, "Accent"),
          h("div.pxo-swatches", {},
            ...accents.map((a) =>
              h("button.pxo-swatch", {
                type: "button",
                "aria-pressed": String(settings.get("accent") === a.id),
                onclick: () => { settings.set("accent", a.id); render(); },
              },
              h("i", { style: { background: `linear-gradient(115deg, ${a.stops[0]}, ${a.stops[1]} 55%, ${a.stops[2]})` } }),
              a.name)))),
        h("section", {},
          h("h3", {}, "Animations"),
          segmented("motion", [["system", "Follow system"], ["full", "Full"], ["reduced", "Reduced"]])),
        h("section", {},
          h("h3", {}, "Layout"),
          toggle("hero", "Home hero", "Large backdrop with Continue Watching and new items"),
          toggle("heroAutoplay", "Hero autoplay", "Advance every 9 s; pauses while the pointer is over it"),
          toggle("rail", "Icon rail sidebar", "Collapses the sidebar to icons; expands on hover"),
          toggle("ambient", "Backdrops", "Show artwork behind home and details pages"))
      );
    }

    const trigger = () => PXO.$(".pxo-topbar-btn");

    function open() {
      if (panel) return;
      panel = h("div.pxo-panel", { role: "dialog", "aria-label": "Overhaul settings", tabindex: "-1" });
      document.body.append(panel);
      render();
      trigger() && trigger().setAttribute("aria-expanded", "true");
      panel.focus({ preventScroll: true });
      setTimeout(() => document.addEventListener("pointerdown", outside, true));
      document.addEventListener("keydown", onKey, true);
    }

    function close() {
      if (!panel) return;
      const p = panel;
      panel = null;
      p.classList.add("is-closing");
      setTimeout(() => p.remove(), 200);
      const t = trigger();
      if (t) {
        t.setAttribute("aria-expanded", "false");
        if (p.contains(document.activeElement)) t.focus({ preventScroll: true });
      }
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", onKey, true);
    }

    const outside = (e) => {
      if (panel && !panel.contains(e.target) && !e.target.closest(".pxo-topbar-btn")) close();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };

    PXO.toggleSettings = () => (panel ? close() : open());

    return () => {
      close();
      delete PXO.toggleSettings;
    };
  },
});

PXO.addCss("elements/sidebar", "/* Common to both modes */\n%SourceSidebar-sidebar,\n%SourceSidebar-pane {\n  background: transparent !important;\n}\n%SidebarLink-sidebarLink {\n  position: relative;\n  margin: 2px 10px;\n  border-radius: var(--pxo-radius);\n  color: var(--pxo-fg-2);\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n%SidebarLink-sidebarLink:hover {\n  background: rgba(255, 255, 255, 0.06);\n  color: var(--pxo-fg);\n}\n%SidebarLink-sidebarLink%SourceSidebarLink-isSelected {\n  background: var(--pxo-grad-soft);\n  color: var(--pxo-fg);\n}\n/* Plex's selected marker is a left border; replace with a gradient pill. */\n%SidebarLink-sidebarLink%SourceSidebarLink-isSelected::before {\n  content: \"\";\n  position: absolute;\n  left: -10px;\n  top: 10px;\n  bottom: 10px;\n  width: 3px;\n  border-radius: 0 3px 3px 0;\n  background: var(--pxo-grad);\n}\n%SidebarLink-sidebarLink a,\n%SidebarLink-sidebarLink a * { border-left-color: transparent !important; }\n%SidebarLink-sidebarLink%SourceSidebarLink-isSelected svg,\n%SidebarLink-sidebarLink%SourceSidebarLink-isSelected %SourceSidebarLink-iconContainer { color: var(--pxo-a1) !important; }\n%SidebarLink-sidebarLink%SourceSidebarLink-isSelected %SidebarLink-title { color: var(--pxo-fg) !important; }\n%SidebarLink-title {\n  font: 500 14px var(--pxo-font) !important;\n  letter-spacing: -0.005em;\n}\n%SourcesToggleButton-link { color: var(--pxo-fg-3) !important; }\n\n/* Rail mode: 76px icon column, expands over the page on hover. */\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-sidebar {\n  width: var(--pxo-rail) !important;\n  min-width: var(--pxo-rail) !important;\n  flex: 0 0 var(--pxo-rail) !important;\n  position: relative;\n  z-index: 30;\n  overflow: visible !important;\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane {\n  position: absolute !important;\n  top: 0;\n  left: 0;\n  bottom: 0;\n  width: var(--pxo-rail) !important;\n  border-radius: 0 var(--pxo-radius-l) var(--pxo-radius-l) 0;\n  overflow: hidden;\n  transition: width var(--pxo-med) var(--pxo-ease), background var(--pxo-med) var(--pxo-ease),\n    box-shadow var(--pxo-med) var(--pxo-ease);\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:hover,\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:focus-within {\n  width: 248px !important;\n  background: var(--pxo-glass-strong) !important;\n  backdrop-filter: blur(18px);\n  box-shadow: 1px 0 0 var(--pxo-line), 24px 0 50px -20px rgba(0, 0, 0, 0.9);\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebarScroller-scroller {\n  width: 248px !important;\n}\nhtml[data-pxo-rail=\"1\"] %SidebarLink-sidebarLink {\n  width: 56px;\n  transition: width var(--pxo-med) var(--pxo-ease), background var(--pxo-fast) var(--pxo-ease);\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:hover %SidebarLink-sidebarLink,\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:focus-within %SidebarLink-sidebarLink {\n  width: 228px;\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebarLink-titles,\nhtml[data-pxo-rail=\"1\"] %SourcesToggleButton-link > :not(%SourcesToggleButton-icon) {\n  opacity: 0;\n  transition: opacity var(--pxo-fast) var(--pxo-ease);\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:hover %SourceSidebarLink-titles,\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:focus-within %SourceSidebarLink-titles,\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:hover %SourcesToggleButton-link > *,\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-pane:focus-within %SourcesToggleButton-link > * {\n  opacity: 1;\n  transition-delay: 80ms;\n}\nhtml[data-pxo-rail=\"1\"] %SourcesToggleButton-link {\n  width: 56px;\n  margin: 6px 10px;\n  border-radius: var(--pxo-radius);\n  overflow: hidden;\n  white-space: nowrap;\n}\n\n/* Plex's hamburger toggles collapsedSidebar, which adds a 64px underlay and\n   positions the sidebar absolutely. The rail is already collapsed, so in rail\n   mode the toggle hides it completely instead. */\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-sidebarUnderlay { display: none !important; }\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-collapsedSidebar {\n  width: 0 !important;\n  min-width: 0 !important;\n  max-width: 0 !important;\n  flex-basis: 0 !important;\n  margin: 0 !important;\n  overflow: hidden !important;\n}\nhtml[data-pxo-rail=\"1\"] %SourceSidebar-collapsedSidebar %SourceSidebar-pane { width: 0 !important; }\n");

// ---- elements/sidebar
// The rail expands on :hover and on :focus-within (for keyboard users). After a
// mouse click the clicked link keeps focus, which held the rail open on the
// new page until the user clicked elsewhere. When a navigation follows a
// pointer interaction, drop focus from the rail; keyboard focus is left alone.
PXO.element({
  name: "sidebar",
  init() {
    let pointer = false;
    const onPointer = () => { pointer = true; };
    const onKey = () => { pointer = false; };

    const offRoute = PXO.onRoute(() => {
      const a = document.activeElement;
      if (pointer && a instanceof HTMLElement && a.closest(PXO.sc("SourceSidebar-pane"))) a.blur();
    });
    document.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    document.addEventListener("keydown", onKey, { capture: true, passive: true });

    return () => {
      offRoute();
      document.removeEventListener("pointerdown", onPointer, { capture: true });
      document.removeEventListener("keydown", onKey, { capture: true });
    };
  },
});

PXO.addCss("elements/topbar", ".pxo-topbar {\n  border-radius: var(--pxo-radius-l) !important;\n  background: linear-gradient(180deg, rgba(7, 8, 12, 0.72), rgba(7, 8, 12, 0)) !important;\n  border: 0 !important;\n  box-shadow: none !important;\n  transition: background var(--pxo-med) var(--pxo-ease);\n}\n.pxo-topbar > * { background-color: transparent; }\n.pxo-topbar.pxo-scrolled {\n  background: var(--pxo-glass-strong) !important;\n  box-shadow: 0 1px 0 var(--pxo-line), 0 12px 30px -18px rgba(0, 0, 0, 0.9) !important;\n}\n\n/* Logo → wordmark */\n%NavBar-logoContainer svg,\n%NavBar-logoContainer img { display: none !important; }\n.pxo-wordmark {\n  display: inline-flex;\n  align-items: baseline;\n  gap: 2px;\n  font: 800 23px/1 var(--pxo-font);\n  letter-spacing: -0.045em;\n  color: var(--pxo-fg);\n}\n.pxo-wordmark-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--pxo-grad);\n  box-shadow: 0 0 14px color-mix(in srgb, var(--pxo-a2) 80%, transparent);\n}\n\n/* Search */\n%UniversalSearch-searchInputContainer {\n  max-width: 560px;\n  min-width: 0;\n  flex-shrink: 1;\n  margin-right: auto;\n}\n%UniversalSearch-searchInputContainer > div:first-child {\n  min-width: 0;\n  max-width: 100%;\n}\n%UniversalSearch-searchInputContainer > div,\n#quickSearchInput {\n  border-radius: 99px !important;\n}\n%UniversalSearch-searchInputContainer > div:first-child {\n  background: rgba(255, 255, 255, 0.055) !important;\n  border: 1px solid var(--pxo-line) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), border-color var(--pxo-fast) var(--pxo-ease),\n    box-shadow var(--pxo-med) var(--pxo-ease);\n}\n%UniversalSearch-searchInputContainer > div:first-child:focus-within {\n  background: rgba(255, 255, 255, 0.09) !important;\n  border-color: color-mix(in srgb, var(--pxo-a3) 60%, transparent) !important;\n  box-shadow: 0 0 0 4px color-mix(in srgb, var(--pxo-a3) 18%, transparent);\n}\n#quickSearchInput {\n  background: transparent !important;\n  color: var(--pxo-fg) !important;\n  font: 500 14px var(--pxo-font) !important;\n}\n/* The pill shows focus (focus-within above); no second ring on the input. */\n#quickSearchInput:focus,\n#quickSearchInput:focus-visible {\n  outline: none !important;\n  box-shadow: none !important;\n}\n#quickSearchInput::placeholder { color: var(--pxo-fg-3); }\n\n/* Right-hand buttons */\n.pxo-topbar button {\n  border-radius: 99px;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n.pxo-topbar button:hover { background: rgba(255, 255, 255, 0.08); }\n.pxo-topbar-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 40px;\n  height: 40px;\n  margin-right: 6px;\n  border: 0;\n  border-radius: 99px;\n  background: transparent;\n  color: var(--pxo-fg-2);\n  cursor: pointer;\n}\n.pxo-topbar-btn:hover { color: var(--pxo-fg); }\n%NotificationBadge-badge {\n  background: var(--pxo-grad) !important;\n  color: var(--pxo-on-a1) !important;\n  font-weight: 700;\n}\n\n/* Narrow windows: Plex's right-hand buttons are 56px wide; with the extra\n   settings button the account menu would be pushed off-screen. */\n@media (max-width: 720px) {\n  .pxo-topbar button,\n  .pxo-topbar a[href] {\n    min-width: 36px;\n  }\n  %NavBarActivityButton-container,\n  %NavBarActivityButton-container + a,\n  %NavBarActivityButton-container ~ button:not([data-testid=\"navbarAccountMenuTrigger\"]) {\n    width: 40px !important;\n  }\n  .pxo-topbar-btn {\n    width: 36px;\n    margin-right: 0;\n  }\n  .pxo-wordmark { font-size: 19px; }\n}\n");

// ---- elements/topbar
PXO.element({
  name: "topbar",
  init() {
    let bar = null;
    let settingsBtn = null;
    let wordmark = null;

    const ensure = () => {
      if (bar && bar.isConnected && settingsBtn && settingsBtn.isConnected && wordmark && wordmark.isConnected) return;
      const logo = PXO.$(PXO.sc("NavBar-logoContainer"));
      if (!logo) return;
      const next = logo.closest(PXO.sc("NavBar-container")) || logo.parentElement;
      if (bar !== next) {
        bar && bar.classList.remove("pxo-topbar");
        bar = next;
        bar.classList.add("pxo-topbar");
      }

      // Wordmark in place of the Plex logo; the original link stays clickable.
      if (!wordmark || !wordmark.isConnected) {
        const host = logo.querySelector("a") || logo;
        wordmark = PXO.h("span.pxo-wordmark", {}, "stream", PXO.h("i.pxo-wordmark-dot"));
        host.append(wordmark);
      }

      const account = PXO.$(PXO.tid("navbarAccountMenuTrigger"), bar);
      const anchor = account && account.closest("button");
      if (anchor && (!settingsBtn || !settingsBtn.isConnected)) {
        settingsBtn = PXO.h(
          "button.pxo-topbar-btn",
          {
            type: "button",
            title: "Overhaul settings",
            "aria-label": "Overhaul settings",
            "aria-haspopup": "dialog",
            "aria-expanded": "false",
            onclick: () => PXO.toggleSettings && PXO.toggleSettings(),
          },
          PXO.svg(PXO.icons.sliders, 20)
        );
        anchor.before(settingsBtn);
      }
    };

    // The bar turns solid once the page under it has scrolled. Attributes on
    // <html> restyle the whole document, so they are written only on change.
    let scrolled = false;
    const setScrolled = (v) => {
      if (v === scrolled) return;
      scrolled = v;
      bar && bar.classList.toggle("pxo-scrolled", v);
      document.documentElement.dataset.pxoScrolled = v ? "1" : "0";
    };
    const scrollerSel = `${PXO.sc("PageContent-pageContentScroller")}, ${PXO.sc("Page-pageScroller")}`;
    const onScroll = (e) => {
      const t = e.target;
      if (t instanceof Element && (t.scrollTop > 12) !== scrolled && t.matches(scrollerSel)) setScrolled(t.scrollTop > 12);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    const offRoute = PXO.onRoute(() => setScrolled(false));
    const offMut = PXO.onMutate(ensure);
    ensure();

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      offRoute();
      offMut();
      bar && bar.classList.remove("pxo-topbar", "pxo-scrolled");
      settingsBtn && settingsBtn.remove();
      PXO.$$(".pxo-wordmark").forEach((n) => n.remove());
    };
  },
});

PXO.addCss("elements/user-select", "/* Plex Home profile picker and PIN entry (\"Select User\" / \"Enter PIN\").\n   These use Plex's older Bootstrap markup, so the class names are stable. */\n%UserSelectModal-darkModalBackdrop {\n  background:\n    radial-gradient(60% 50% at 18% 20%, color-mix(in srgb, var(--pxo-a1) 16%, transparent), transparent 70%),\n    radial-gradient(55% 55% at 85% 85%, color-mix(in srgb, var(--pxo-a3) 18%, transparent), transparent 70%),\n    var(--pxo-ink-0) !important;\n}\n\n.user-select-modal .modal-dialog {\n  position: fixed !important;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: auto !important;\n  margin: 0 !important;\n  animation: pxo-fade-up var(--pxo-slow) var(--pxo-ease) both;\n}\n.user-select-modal .modal-content {\n  width: auto !important;\n  padding: 36px 44px 40px;\n  border: 1px solid var(--pxo-line-strong) !important;\n  border-radius: 28px !important;\n  background: var(--pxo-glass) !important;\n  backdrop-filter: blur(24px) saturate(1.2);\n  box-shadow: var(--pxo-shadow-2) !important;\n  font-family: var(--pxo-font);\n}\n.user-select-modal .modal-header {\n  padding: 0 0 22px !important;\n  border: 0 !important;\n  text-align: center;\n}\n.user-select-modal .modal-title {\n  display: inline-flex;\n  align-items: center;\n  gap: 12px;\n  color: var(--pxo-fg) !important;\n  font: 800 30px/1.1 var(--pxo-font) !important;\n  letter-spacing: -0.03em;\n}\n.user-select-modal .modal-body { padding: 0 !important; }\n\n/* Back button on the PIN step */\n.user-select-modal .back-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border: 1px solid var(--pxo-line-strong);\n  border-radius: 50%;\n  background: rgba(255, 255, 255, 0.05);\n  color: var(--pxo-fg-2) !important;\n  transition: background var(--pxo-fast) var(--pxo-ease), color var(--pxo-fast) var(--pxo-ease);\n}\n.user-select-modal .back-btn:hover { background: rgba(255, 255, 255, 0.12); color: var(--pxo-fg) !important; }\n.user-select-modal .back-btn .glyphicon { top: 0; font-size: 14px; }\n\n/* Profile tiles */\n.user-select-list {\n  display: flex !important;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: 18px;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n.user-select-list-item {\n  float: none !important;\n  margin: 0 !important;\n  list-style: none;\n}\n.user-select-container {\n  display: block;\n  width: 148px !important;\n  height: auto !important;\n  padding: 22px 12px 16px;\n  border-radius: var(--pxo-radius-l) !important;\n  background: rgba(255, 255, 255, 0.035) !important;\n  box-shadow: inset 0 0 0 1px var(--pxo-line) !important;\n  text-decoration: none !important;\n  transition: background var(--pxo-med) var(--pxo-ease), transform var(--pxo-med) var(--pxo-ease),\n    box-shadow var(--pxo-med) var(--pxo-ease);\n}\na.user-select-container:hover,\na.user-select-container:focus-visible {\n  background: rgba(255, 255, 255, 0.07) !important;\n  box-shadow: inset 0 0 0 2px var(--pxo-a3), var(--pxo-shadow-2) !important;\n  transform: translateY(-3px);\n}\n.user-select-top {\n  position: relative;\n  width: auto !important;\n  height: auto !important;\n  background: transparent !important;\n}\n.user-select-top .user-poster {\n  position: relative !important;\n  top: auto !important;\n  left: auto !important;\n  width: 92px !important;\n  height: 92px !important;\n  margin: 0 auto;\n  border: 0 !important;\n  border-radius: 50% !important;\n  box-shadow: 0 0 0 3px var(--pxo-ink-1), 0 0 0 5px transparent;\n  transition: box-shadow var(--pxo-med) var(--pxo-ease);\n}\na.user-select-container:hover .user-poster {\n  box-shadow: 0 0 0 3px var(--pxo-ink-1), 0 0 0 5px var(--pxo-a1);\n}\n.user-select-top .user-icon {\n  top: auto !important;\n  bottom: -2px !important;\n  width: 26px !important;\n  height: 26px !important;\n  line-height: 26px !important;\n  border-radius: 50%;\n  background: var(--pxo-ink-3) !important;\n  box-shadow: 0 0 0 2px var(--pxo-ink-1);\n  font-size: 12px !important;\n  text-align: center;\n}\n.user-select-top .protected-icon { left: 18px !important; color: var(--pxo-good) !important; }\n.user-select-top .admin-icon { right: 18px !important; left: auto !important; color: var(--pxo-a1) !important; }\n.user-select-container .add-icon {\n  color: var(--pxo-a1) !important;\n  fill: var(--pxo-a1) !important;\n}\n.user-select-container .caption {\n  height: auto !important;\n  padding: 14px 0 0 !important;\n  background: transparent !important;\n}\n.user-select-container .username {\n  color: var(--pxo-fg) !important;\n  font: 600 15px/1.3 var(--pxo-font) !important;\n  text-align: center;\n}\n.user-select-container .managed-title {\n  color: var(--pxo-fg-3) !important;\n  font: 500 12px var(--pxo-font) !important;\n}\n\n/* PIN step: profile tile on the left, four digit boxes on the right. */\n.user-select-modal-pin-container .modal-body {\n  display: flex;\n  align-items: center;\n  gap: 32px;\n}\n.user-select-modal-pin-container .user-select-list { flex: 0 0 auto; }\n.user-select-modal-pin-container .user-select-list.disabled .user-select-container:hover { transform: none; }\n.pin-digit-container {\n  position: relative;\n  display: flex !important;\n  gap: 14px;\n  width: auto !important;\n  margin: 0 !important;\n}\n.pin-digit-container .pin-digit {\n  float: none !important;\n  width: 68px !important;\n  height: 88px !important;\n  margin: 0 !important;\n  border-radius: var(--pxo-radius-l) !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  box-shadow: inset 0 0 0 1px var(--pxo-line-strong);\n  transition: background var(--pxo-med) var(--pxo-ease), box-shadow var(--pxo-med) var(--pxo-ease),\n    transform var(--pxo-med) var(--pxo-ease);\n}\n.pin-digit-container .pin-digit.current {\n  background: rgba(255, 255, 255, 0.08) !important;\n  box-shadow: inset 0 0 0 2px var(--pxo-a3), 0 0 0 6px color-mix(in srgb, var(--pxo-a3) 18%, transparent);\n}\n/* Plex writes a \"•\" into each entered box; hide the glyph and draw a centred\n   gradient dot instead. */\n.pin-digit-container .pin-digit {\n  position: relative;\n  color: transparent !important;\n  font-size: 0 !important;\n}\n.pin-digit-container .pin-digit:not(:empty)::after {\n  content: \"\";\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 16px;\n  height: 16px;\n  margin: -8px 0 0 -8px;\n  border-radius: 50%;\n  background: var(--pxo-grad);\n  box-shadow: 0 0 16px color-mix(in srgb, var(--pxo-a2) 70%, transparent);\n  animation: pxo-pin-pop var(--pxo-med) var(--pxo-ease) both;\n}\n@keyframes pxo-pin-pop {\n  from { transform: scale(0.3); opacity: 0; }\n  to { transform: none; opacity: 1; }\n}\n.pin-forgot-link {\n  position: absolute !important;\n  right: 44px;\n  bottom: 14px;\n  top: auto !important;\n  color: var(--pxo-fg-3) !important;\n  font: 500 13px var(--pxo-font) !important;\n}\n.pin-forgot-link:hover { color: var(--pxo-fg) !important; }\n\n/* Wrong-PIN / error message */\n.user-select-alert-bar {\n  border-radius: var(--pxo-radius) !important;\n  background: color-mix(in srgb, var(--pxo-bad) 18%, var(--pxo-ink-2)) !important;\n  color: var(--pxo-fg) !important;\n  font: 500 14px var(--pxo-font) !important;\n}\n.user-select-modal .modal-alert { position: absolute; top: -64px; left: 0; right: 0; }\n");

// ---- main.js
PXO.destroy = () => {
  const html = document.documentElement;
  for (const fn of PXO.cleanups.splice(0).reverse()) {
    try { fn(); } catch (e) { console.error("[pxo]", e); }
  }
  html.classList.remove("pxo");
  for (const k of Object.keys(html.dataset)) if (k.startsWith("pxo")) delete html.dataset[k];
  if (window.__PXO === PXO) delete window.__PXO;
};

// @match *://*/web/index.html* also hits non-Plex sites with that path.
// 383457673 is Plex's App Store id, in Plex Web's static index.html; the title
// is not used because Plex Web rewrites it while playing.
const isPlexWeb = () =>
  !!document.querySelector("#plex.application") &&
  !!document.querySelector('meta[name="apple-itunes-app"][content*="383457673"]');

function start() {
  if (!isPlexWeb()) return PXO.destroy();
  document.documentElement.classList.add("pxo");
  PXO.settings.apply();
  PXO.mountStyles();
  for (const el of PXO.elements) {
    try {
      const cleanup = el.init();
      if (typeof cleanup === "function") PXO.onCleanup(cleanup);
    } catch (e) {
      console.error(`[pxo] ${el.name} failed to start`, e);
    }
  }
  PXO.startObserver();
  PXO.fireRoute();
  PXO.log(`started ${PXO.version}, ${PXO.elements.length} elements`);
}

// @run-at document-start: wait for <body> so the style tag lands after <head>.
if (document.body) start();
else document.addEventListener("DOMContentLoaded", start, { once: true });

})();
