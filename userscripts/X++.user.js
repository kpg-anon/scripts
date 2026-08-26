// ==UserScript==
// @name         X++
// @version      1.1.1
// @modified     2026.08.26
// @description  Widens and centres the timeline, restores the media grid, and adds a download button to posts on X.
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://github.com/kpg-anon/scripts/raw/main/userscripts/X++.user.js
// @updateURL    https://github.com/kpg-anon/scripts/raw/main/userscripts/X++.user.js
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// ==/UserScript==

/**
 * The downloader section is a fork of Twitter/X Media Downloader
 * Upstream: https://github.com/ChinaGodMan/UserScripts
 * Authors: goemon2017, 天音, Tiande, molanp, 人民的勤务员@ChinaGodMan
 * License: MIT — Copyright © 2024-2025 ChinaGodMan & molanp
 */

// --- Layout: centre and widen the timeline, cut the sidebar, add a zoom slider.

(function() {
    'use strict';

    const COLUMN_WIDTH = '1000px';   // X's default is 600px
    const ZOOM_KEY = 'xct-zoom';
    const POS_KEY = 'xct-zoom-pos';
    const ZOOM_MIN = 50;
    const ZOOM_MAX = 130;

    const css = `
        header[role="banner"] {
            flex-grow: 0 !important;
        }

        /* Sidebar keeps only the search field, pinned to the top right. Taking
           it out of flow also leaves the timeline alone in its flex row. */
        [data-testid="sidebarColumn"] {
            position: fixed !important;
            top: 0 !important;
            right: 16px !important;
            width: 350px !important;
            height: auto !important;
            z-index: 5 !important;
            pointer-events: none !important;
        }

        [data-testid="sidebarColumn"] div:not(:has(form[role="search"])):not(form[role="search"] *) {
            display: none !important;
        }

        [data-testid="sidebarColumn"] form[role="search"] {
            pointer-events: auto !important;
        }

        /* Class names on these wrappers are hashed and change between builds,
           so they are matched by the column they contain. */
        main div:has([data-testid="primaryColumn"]) {
            width: 100% !important;
            max-width: none !important;
        }

        /* Pull the row back across the nav so that centering is against the
           viewport rather than against the space beside the nav. */
        main div:has(> [data-testid="primaryColumn"]) {
            justify-content: center !important;
            margin-left: calc(-1 * var(--xct-nav-w, 0px)) !important;
            width: calc(100% + var(--xct-nav-w, 0px)) !important;
        }

        /* Zooming the column rather than its contents keeps the scaling
           proportional: posts shrink by the zoom factor instead of reflowing
           wider and growing their media back. Width is set from JS because a
           px length inside a zoomed element renders at length * zoom. */
        [data-testid="primaryColumn"] {
            /* Without this the column's own flex-grow overrides the width. */
            flex: 0 0 auto !important;
            width: var(--xct-col-w, ${COLUMN_WIDTH}) !important;
            max-width: none !important;
            zoom: var(--xct-zoom, 1) !important;
        }

        /* X caps the timeline at 600px inside the column, which would otherwise
           hold the posts and their media at the old width. */
        [data-testid="primaryColumn"] div:has(> section) {
            max-width: none !important;
        }

        /* Same cap on the action bar. Lifting it spreads reply/repost/like/views
           and the download button the downloader section inserts into the
           same flex row. */
        [data-testid="primaryColumn"] article [role="group"] {
            max-width: none !important;
        }

        /* The slider is fixed at z-index 9999, so it floats on top of X's photo
           viewer and of every other full-screen dialog. They all mount inside
           #layers and carry aria-modal, which is a hook that needs no script and
           reverses itself when the overlay closes. The !important is required:
           the slider sets its own display from an inline style. */
        body:has(#layers [aria-modal="true"]) > #xct-zoom {
            display: none !important;
        }

        /* A post with one portrait image is sized by an inline max-width and
           would otherwise sit against the left edge of the wider column.

           The width is required. This wrapper is a stretched item of a column
           flex container, and an auto cross-axis margin cancels the stretch, so
           the item falls back to its content's own width. A photo has an img to
           measure; a video is a padding-bottom aspect box with absolutely
           positioned children and measures 0, which collapsed every video
           player in the timeline to a 2px dot. Setting the width back to 100%
           restores the stretched size, and the inline max-width still caps it. */
        [data-testid="primaryColumn"] article div[style*="max-width"]:has([data-testid="tweetPhoto"]) {
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    // At document-start there is no <head> yet.
    (document.head || document.documentElement).appendChild(style);

    const BASE_WIDTH = parseInt(COLUMN_WIDTH, 10);
    const GUTTER = 24;         // kept between the column and the nav at high zoom
    const BOTTOM_GAP = 48;     // slider's resting distance from the bottom edge
    const EDGE = 8;            // smallest gap the slider may be dragged to

    const readPos = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(POS_KEY));
            return raw && typeof raw.x === 'number' && typeof raw.y === 'number' ? raw : null;
        } catch (e) {
            return null;
        }
    };

    // Null until the slider is dragged, which is what keeps it following the
    // column when the zoom changes the column's width.
    let customPos = readPos();

    const placeSlider = () => {
        const wrap = document.getElementById('xct-zoom');
        if (!wrap) return;

        const w = wrap.offsetWidth;
        const h = wrap.offsetHeight;
        let x, y;

        if (customPos) {
            x = customPos.x;
            y = customPos.y;
        } else {
            // Centred in the free space to the right of the column.
            const col = document.querySelector('[data-testid="primaryColumn"]');
            const right = col ? col.getBoundingClientRect().right : window.innerWidth;
            x = right + (window.innerWidth - right - w) / 2;
            y = window.innerHeight - h - BOTTOM_GAP;
        }

        x = Math.max(EDGE, Math.min(x, window.innerWidth - w - EDGE));
        y = Math.max(EDGE, Math.min(y, window.innerHeight - h - EDGE));
        wrap.style.left = Math.round(x) + 'px';
        wrap.style.top = Math.round(y) + 'px';

        // Store the clamped values, so a drag past the edge is not saved as a
        // position outside the window.
        if (customPos) customPos = { x, y };
    };

    const readZoom = () => {
        const stored = Number(localStorage.getItem(ZOOM_KEY));
        return stored >= ZOOM_MIN && stored <= ZOOM_MAX ? stored : 100;
    };

    let zoom = readZoom();

    // The centering offset is the nav's rendered width, which changes at X's
    // breakpoints, so it is measured rather than hard-coded. The column width
    // is clamped here too: at high zoom the rendered column would otherwise
    // grow past the nav and sit under it.
    const relayout = () => {
        const nav = document.querySelector('header[role="banner"]');
        if (!nav) return;
        const navW = Math.round(nav.getBoundingClientRect().width);
        if (navW <= 0) return;

        const z = zoom / 100;
        const rendered = Math.min(BASE_WIDTH * z, window.innerWidth - 2 * (navW + GUTTER));

        const root = document.documentElement.style;
        root.setProperty('--xct-nav-w', navW + 'px');
        root.setProperty('--xct-zoom', z);
        root.setProperty('--xct-col-w', Math.round(rendered / z) + 'px');

        // The free space the slider rests in moves when the column resizes.
        placeSlider();
    };

    const applyZoom = (percent) => {
        zoom = percent;
        relayout();
    };

    const buildSlider = () => {
        if (document.getElementById('xct-zoom')) return;

        const wrap = document.createElement('div');
        wrap.id = 'xct-zoom';
        wrap.style.cssText = [
            'position:fixed', 'left:0', 'top:0', 'z-index:9999',
            'display:flex', 'flex-direction:column', 'align-items:center', 'gap:6px',
            'padding:10px 12px', 'border-radius:12px',
            'background:rgba(22,24,28,0.92)', 'border:1px solid rgba(255,255,255,0.15)',
            'font:12px system-ui,sans-serif', 'color:#e7e9ea', 'user-select:none',
            'cursor:move', 'touch-action:none'
        ].join(';');

        const label = document.createElement('span');

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(ZOOM_MIN);
        input.max = String(ZOOM_MAX);
        input.step = '5';
        input.style.cssText = 'width:140px;accent-color:#1d9bf0;cursor:pointer';

        const set = (percent) => {
            applyZoom(percent);
            label.textContent = percent + '%';
        };

        input.value = String(readZoom());
        set(Number(input.value));

        input.addEventListener('input', () => {
            const percent = Number(input.value);
            set(percent);
            try {
                localStorage.setItem(ZOOM_KEY, String(percent));
            } catch (e) {
                // private windows and blocked site data throw here
            }
        });

        // Dragging from the slider track has to keep adjusting the zoom, so the
        // panel is only moved when the press starts off the input.
        wrap.addEventListener('pointerdown', (e) => {
            if (e.target === input) return;
            e.preventDefault();

            const rect = wrap.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            const onMove = (ev) => {
                customPos = { x: ev.clientX - offsetX, y: ev.clientY - offsetY };
                placeSlider();
            };

            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                try {
                    localStorage.setItem(POS_KEY, JSON.stringify(customPos));
                } catch (err) {
                    // private windows and blocked site data throw here
                }
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        wrap.append(label, input);
        document.body.appendChild(wrap);
        placeSlider();
    };

    const attach = () => {
        const nav = document.querySelector('header[role="banner"]');
        if (!nav || !document.body) return false;
        relayout();
        new ResizeObserver(relayout).observe(nav);
        buildSlider();
        return true;
    };

    if (!attach()) {
        const mo = new MutationObserver(() => {
            if (attach()) mo.disconnect();
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener('resize', relayout);
})();

// --- Media: turn X's scrolling media carousel back into a thumbnail grid.

(function() {
    'use strict';

    const CONFIG = {
        gap: '4px',            // spacing between thumbnails
        radius: '16px',        // outer corner rounding of the whole grid
        multiAspect: '16 / 9', // overall aspect for 2-4 item posts (old X used 16:9)
        manyColumns: 3,        // columns used when a post has 5+ items
        hideArrows: true,
        hoverEffect: true,     // darken + zoom a thumbnail on hover
        hoverBrightness: 0.8,  // 1 = no darkening
        hoverZoom: 1.06,       // 1 = no zoom
        dedupeOverlays: true,  // hide duplicate download buttons within one tile
        debug: false           // logs every carousel it converts
    };

    // X ships several frontends (the logged-out rewrite uses Tailwind utility
    // classes, the main app uses hashed css-* names) and neither has a stable
    // hook for this component. So identify the carousel by how it behaves -
    // a horizontally scrollable element whose children each contain media -
    // rather than by any class name or test id.
    const MEDIA = 'img[src*="pbs.twimg.com/media"], img[src*="video_thumb"], video';
    const MAX_WALK = 14;   // video players nest the media deeper than photos do

    // The downloader section injects overlay controls into the carousel as
    // .tmd-down buttons. They must never be treated as thumbnails, or they
    // throw the column count off and shift tiles around.
    const OVERLAY = '.tmd-down, .tmd-img, .tmd-media';

    const css = `
    [data-xgrid] {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        /* Must be explicit. Clearing the slides' inner aspect-ratio boxes (see
           below) leaves the tiles with no intrinsic height, so an auto-sized
           row collapses to ~0 - which is what broke 2-image posts. */
        grid-template-rows: 1fr;
        gap: ${CONFIG.gap} !important;
        aspect-ratio: ${CONFIG.multiAspect};
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: hidden !important;
        scroll-snap-type: none !important;
        border-radius: ${CONFIG.radius};
    }

    /* Slides are sized for a scroller (fixed width, non-shrinking) - let the
       grid lay them out instead. overflow:hidden keeps a tile's content from
       spilling over its neighbours. position:relative makes each tile its own
       containing block, so the downloader's absolutely-positioned overlays
       anchor to their own thumbnail instead of the whole grid. */
    [data-xgrid] > *:not(${OVERLAY}) {
        position: relative !important;
        width: auto !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
        flex: 0 1 auto !important;
        scroll-snap-align: none !important;
        border: none !important;
        border-radius: 0 !important;
    }

    /* An overlay injected as a direct child of the scroller must not become a
       grid item and consume a cell. */
    [data-xgrid] > ${OVERLAY} {
        position: absolute !important;
    }

    /* X sizes each slide's inner box with a fixed aspect-ratio (e.g. 1.33/1),
       so it keeps its full natural height inside a much shorter grid cell.
       The tile's overflow:hidden then crops it - the thumbnail looks sliced
       flat across the bottom, and any overlay anchored to the box's bottom
       edge (a downloader button at bottom:8px) is cut off entirely. Drop the
       aspect boxes and make every wrapper in the chain fill the cell.

       The chain is matched with :has() on the media itself rather than by
       naming known wrappers: video posts nest the player several levels below
       tweetPhoto with no photo link or img to key off, so an enumerated list
       stops short and leaves dead space under the video. */
    [data-xgrid] > *:not(${OVERLAY}) *:not(${OVERLAY}) {
        aspect-ratio: auto !important;
    }
    [data-xgrid] > *:not(${OVERLAY}) > *:not(${OVERLAY}),
    [data-xgrid] a[role="link"],
    [data-xgrid] [data-testid="tweetPhoto"],
    [data-xgrid] > *:not(${OVERLAY}) *:has(img[src*="pbs.twimg.com/media"]),
    [data-xgrid] > *:not(${OVERLAY}) *:has(img[src*="video_thumb"]),
    [data-xgrid] > *:not(${OVERLAY}) *:has(video) {
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: none !important;
        max-height: none !important;
        inset: 0 !important;
        flex: 1 1 auto !important;
    }

    /* The image itself is absolutely positioned in this frontend. */
    [data-xgrid] > *:not(${OVERLAY}) img,
    [data-xgrid] > *:not(${OVERLAY}) video {
        width: 100% !important;
        height: 100% !important;
        inset: 0 !important;
        object-fit: cover !important;
    }
    ${CONFIG.hoverEffect ? `
    /* Darken + zoom the image rather than the tile, so overlay buttons sitting
       on top of it keep their own colours and don't scale with it. The tile's
       overflow:hidden crops the zoom. */
    [data-xgrid] > *:not(${OVERLAY}) img,
    [data-xgrid] > *:not(${OVERLAY}) video {
        transition: filter .18s ease, transform .18s ease;
        transform-origin: center center;
    }
    [data-xgrid] > *:not(${OVERLAY}):hover img,
    [data-xgrid] > *:not(${OVERLAY}):hover video {
        filter: brightness(${CONFIG.hoverBrightness}) !important;
        transform: scale(${CONFIG.hoverZoom}) !important;
    }` : ''}
    ${CONFIG.dedupeOverlays ? `
    /* Some frontends wrap each photo in two /photo/ links, so the downloader
       adds its button twice per tile, stacked in the same corner. */
    [data-xgrid] [data-xgrid-dupe] { display: none !important; }` : ''}

    /* 3 items: tall one on the left, two stacked on the right. */
    [data-xgrid="3"] { grid-template-rows: 1fr 1fr; }
    [data-xgrid="3"] > *:not(${OVERLAY}):first-child { grid-row: span 2; }

    /* 4 items: 2x2. */
    [data-xgrid="4"] { grid-template-rows: 1fr 1fr; }

    /* 5+ items: square tiles, wrapping - rows come from the tiles themselves. */
    [data-xgrid="many"] {
        grid-template-columns: repeat(${CONFIG.manyColumns}, 1fr);
        grid-template-rows: auto;
        aspect-ratio: auto;
    }
    [data-xgrid="many"] > *:not(${OVERLAY}) { aspect-ratio: 1; }

    /* The carousel sits in a fixed-aspect box that would clip the taller grid. */
    [data-xgrid-wrap] {
        aspect-ratio: auto !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
    }

    /* X reserves the carousel's shape with the percentage-padding hack -
       height:0 plus a padding-bottom sized to the media. The grid is shorter
       than the carousel was, so that padding survives as a tall empty band
       under the post. Drop it and let the box take its height from the grid
       (height:auto comes from [data-xgrid-wrap], which is set alongside). */
    [data-xgrid-pad] {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
    }

    /* The hack lifts its content out of flow to overlay that padding. With the
       padding gone the content has to flow again, or the media block measures
       zero and the post's text and action bar render on top of the grid. */
    [data-xgrid-abs] {
        position: relative !important;
        inset: auto !important;
    }
    ${CONFIG.hideArrows ? `
    /* Arrows are meaningless once everything is on screen. Which element they
       hang off varies by frontend, so they're tagged in JS rather than matched
       structurally here. */
    [data-xgrid-arrow] { display: none !important; }` : ''}
    `;

    // Direct children that are actual thumbnails - overlays injected by other
    // scripts don't count towards the layout.
    function tilesOf(el) {
        return [...el.children].filter(kid =>
            !kid.matches(OVERLAY) && (kid.matches(MEDIA) || kid.querySelector(MEDIA)));
    }

    function isCarousel(el) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') return false;
        // Overflow alone is unreliable: a 2-image post can fit its slides
        // exactly, so the same carousel converts on one load and not the next.
        // A horizontal scroll-snap axis identifies it either way.
        return el.scrollWidth > el.clientWidth + 4 || /\bx\b/.test(cs.scrollSnapType);
    }

    function applyCount(scroller) {
        const count = tilesOf(scroller).length;
        const value = count >= 5 ? 'many' : String(count);
        if (scroller.dataset.xgrid !== value) {
            scroller.dataset.xgrid = value;
            if (CONFIG.debug) console.log('[x-media-grid] tiles:', value, scroller);
        }
    }

    // The downloader keys off links, and some frontends render two /photo/
    // links per image, yielding two identical buttons stacked in one corner.
    // Match them by position rather than by count, so a tile that legitimately
    // has a single button can never have it hidden.
    function dedupeOverlays(scroller) {
        if (!CONFIG.dedupeOverlays) return;
        tilesOf(scroller).forEach(tile => {
            const kept = [];
            [...tile.querySelectorAll('.tmd-down.tmd-img')].forEach(el => {
                el.removeAttribute('data-xgrid-dupe');
                const r = el.getBoundingClientRect();
                if (!r.width && !r.height) return;      // hidden until hover - leave alone
                const covered = kept.some(k =>
                    Math.abs(k.left - r.left) < 4 && Math.abs(k.top - r.top) < 4);
                if (covered) el.setAttribute('data-xgrid-dupe', '');
                else kept.push(r);
            });
        });
    }

    // The prev/next buttons live outside the scroller, at a depth that differs
    // between frontends, so find them by walking up from the carousel and tag
    // them for the stylesheet. Scoped to the carousel's own ancestors so an
    // unrelated "Next" button elsewhere on the page is never touched.
    function tagArrows(scroller) {
        if (!CONFIG.hideArrows) return;
        let el = scroller.parentElement;
        for (let i = 0; i < 4 && el && el !== document.body; i++, el = el.parentElement) {
            el.querySelectorAll('button[aria-label], div[role="button"][aria-label]').forEach(btn => {
                if (scroller.contains(btn)) return;
                if (/^(next|previous)( slide| image)?$/i.test(btn.getAttribute('aria-label') || '')) {
                    btn.setAttribute('data-xgrid-arrow', '');
                }
            });
            if (el.tagName === 'ARTICLE') break;
        }
    }

    // The carousel sits inside a fixed-aspect, overflow-hidden box. If any is
    // left intact the taller grid gets cropped - which shows up as the bottom
    // row being sliced off square. How deep that box sits varies by frontend,
    // so clear every constraining ancestor up to the post itself.
    //
    // Safe to re-run: every branch only ever adds a marker, and a box already
    // neutralised no longer matches the test that tagged it.
    function tagWrappers(scroller) {
        // Absolutely-positioned ancestors seen so far. They're only put back in
        // flow once a padding hack turns up above them - that's what they were
        // lifted out to overlay. Left unconditional, this would flatten
        // absolute positioning that the post legitimately relies on.
        const lifted = [];
        let el = scroller.parentElement;
        for (let i = 0; i < 6 && el && el !== document.body; i++, el = el.parentElement) {
            const cs = getComputedStyle(el);
            const clips = cs.overflowX === 'hidden' || cs.overflowY === 'hidden';
            // Only neutralise a box that actually constrains the grid, so we
            // don't strip clipping that the rest of the post relies on.
            if (cs.aspectRatio !== 'auto' || cs.maxHeight !== 'none' ||
                (clips && el.clientHeight < scroller.scrollHeight - 2)) {
                el.dataset.xgridWrap = '';
            }
            // The padding hack, identified by the box being essentially all
            // padding - its content is out of flow, so nothing else can leave
            // a box whose own content height rounds to zero. A container with
            // ordinary padding around real content can't be mistaken for it.
            const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
            if (pad > 0 && el.clientHeight - pad < 4) {
                el.dataset.xgridPad = '';
                el.dataset.xgridWrap = '';   // the hack pins height:0 as well
                lifted.forEach(a => { a.dataset.xgridAbs = ''; a.dataset.xgridWrap = ''; });
                lifted.length = 0;
            }
            if (cs.position === 'absolute') lifted.push(el);
            if (el.tagName === 'ARTICLE') break;
        }
    }

    function convert(scroller) {
        applyCount(scroller);
        tagArrows(scroller);
        tagWrappers(scroller);
    }

    function scan() {
        document.querySelectorAll(MEDIA).forEach(media => {
            let el = media.parentElement;
            for (let depth = 0; el && depth < MAX_WALK; depth++, el = el.parentElement) {
                if (el.dataset.xgrid !== undefined) break;   // already converted
                if (tilesOf(el).length >= 2 && isCarousel(el)) {
                    convert(el);
                    break;
                }
            }
        });
        // Other scripts add their buttons after we convert, which changes the
        // child count, so re-derive the layout for carousels we already own.
        document.querySelectorAll('[data-xgrid]').forEach(grid => {
            applyCount(grid);
            tagArrows(grid);      // arrows can mount after the carousel does
            tagWrappers(grid);    // X sizes the wrappers once the media loads,
                                  // which can be after the first conversion
            dedupeOverlays(grid);
        });
    }

    let queued = false;
    function scheduleScan() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; scan(); });
    }

    function start() {
        if (!document.getElementById('x-media-grid')) {
            const style = document.createElement('style');
            style.id = 'x-media-grid';
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        }
        scan();
        // X is a SPA that streams posts in, so keep watching. Only childList is
        // observed - our own marker writes are attribute changes, so this can't
        // feed back into itself.
        new MutationObserver(scheduleScan)
            .observe(document.documentElement, { childList: true, subtree: true });
    }

    // At document-start even <html> may not exist yet (Firefox in particular),
    // so touching it unconditionally can throw and silently kill the script.
    if (document.documentElement) {
        start();
    } else {
        new MutationObserver((_, obs) => {
            if (document.documentElement) { obs.disconnect(); start(); }
        }).observe(document, { childList: true });
    }
})();

// --- Downloader: add a download button to posts and to the media tab.

/* jshint esversion: 8 */
const filename = '@{user-id} {file-name} [{status-id}]'
const invalid_chars = { '\\': '＼', '\/': '／', '\|': '｜', '<': '＜', '>': '＞', ':': '：', '*': '＊', '?': '？', '"': '＂', '\u200b': '', '\u200c': '', '\u200d': '', '\u2060': '', '\ufeff': '', '🔞': '' }
const TMD = (function () {
    let lang, host, history, show_sensitive, is_tweetdeck
    return {
        init: async function () {
            GM_registerMenuCommand((this.language[navigator.language] || this.language.en).settings, this.settings)
            GM_registerMenuCommand('Export History (Markdown)', async () => this.exportHistory())
            lang = this.language[document.querySelector('html').lang] || this.language.en
            host = location.hostname
            is_tweetdeck = host.indexOf('tweetdeck') >= 0
            history = this.storage_obsolete()
            if (history.length) {
                this.storage(history)
                this.storage_obsolete(true)
            } else history = await this.storage()
            show_sensitive = GM_getValue('show_sensitive', true)
            document.head.insertAdjacentHTML('beforeend', '<style>' + this.css + (show_sensitive ? this.css_ss : '') + '</style>')
            let observer = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(node => this.detect(node))))
            observer.observe(document.body, { childList: true, subtree: true })
        },
        exportHistory: async function () {
            try {
                const history = await GM_getValue('download_history', [])
                if (!history || !Array.isArray(history) || history.length === 0) {
                    return
                }
                const markdownContent = '# Twitter/X Media Downloader history\n\n' +
                    (await Promise.all(history.map(id => this.generateMarkdown(id)))).join('\n')
                const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' })
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `twitter_download_history_(${history.length}).md`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(link.href)
            } catch (error) {
                console.error('An error occurred while exporting Markdown history:', error)
                alert('An error occurred while exporting Markdown history, please check the console for details.')
            }
        },
        generateMarkdown: async function (tweet_id, fetch = true) {
            if (!fetch) return `[Tweet] - ${tweet_id} (https://x.com/i/web/status/${tweet_id})`
            let json = await this.fetchJson(tweet_id)
            let source = this.sourceOf(json)
            let tweet = source.legacy
            let user = source.core.user_results.result.legacy
            let user_name = user.name.replace(/([\\/|*?:"\u200b-\u200d\u2060\ufeff]|🔞)/g, v => invalid_chars[v])
            let full_text = tweet.full_text.split('\n').join(' ').replace(/\s*https:\/\/t\.co\/\w+/g, '').replace(/[\\/|<>*?:"\u200b-\u200d\u2060\ufeff]/g, v => invalid_chars[v])
            return `[${user_name} (@${user.screen_name})](https://x.com/i/web/status/${tweet_id})\n>  ${full_text}\n`
        },
        // A quoted post whose replies are restricted comes back as
        // TweetWithVisibilityResults, which holds the real tweet in .tweet.
        // fetchJson already unwraps that for the outer post; the quoted one
        // needs the same treatment or its legacy block reads as undefined.
        quotedOf: function (json) {
            let result = json.quoted_status_result?.result
            return result?.tweet || result
        },
        // The post a download should come from: the clicked one when it carries
        // media of its own, otherwise the post it quotes.
        sourceOf: function (json) {
            let outer_media = json.legacy?.extended_entities?.media
            if (Array.isArray(outer_media) && outer_media.length > 0) return json
            let quoted = this.quotedOf(json)
            let quoted_media = quoted?.legacy?.extended_entities?.media
            return Array.isArray(quoted_media) && quoted_media.length > 0 ? quoted : json
        },
        // The id of the post an article renders. Upstream took this from the
        // page URL whenever it held /status/, which stamps one id on every
        // article the page shows: on a status page the replies and the posts
        // listed beside it all inherited the focused post's id, so they came up
        // already ticked as downloaded and their button would have fetched the
        // focused post's media. Every article carries its own permalink on its
        // timestamp, so read it from there instead.
        statusIdOf: function (article) {
            let time = article.querySelector('a[href*="/status/"] time')
            let link = time ? time.closest('a[href*="/status/"]') : article.querySelector('a[href*="/status/"]')
            return link && link.href.split('/status/').pop().split('/').shift()
        },
        detect: function (node) {
            let article = node.tagName == 'ARTICLE' && node || node.tagName == 'DIV' && (node.querySelector('article') || node.closest('article'))
            if (article) this.addButtonTo(article)
            let listitems = node.tagName == 'LI' && node.getAttribute('role') == 'listitem' && [node] || node.tagName == 'DIV' && node.querySelectorAll('li[role="listitem"]')
            if (listitems) this.addButtonToMedia(listitems)
        },
        addButtonTo: function (article) {
            if (article.dataset.detected) return
            let media_selector = [
                'a[href*="/photo/1"]',
                'div[role="progressbar"]',
                'button[data-testid="playButton"]',
                // A video post matches nothing else once it has finished
                // loading: playButton is not rendered on a status page and the
                // progressbar only exists while the player is coming up. These
                // two are what the loaded player leaves behind.
                'div[data-testid="videoComponent"]',
                'div[data-testid="videoPlayer"]',
                'a[href="/settings/content_you_see"]', //hidden content
                'div.media-image-container', // for tweetdeck
                'div.media-preview-container', // for tweetdeck
                'div[aria-labelledby]>div:first-child>div[role="button"][tabindex="0"]' //for audio (experimental)
            ]
            let media = article.querySelector(media_selector.join(','))
            let imgs = article.querySelectorAll('a[href*="/photo/"]')
            // X inserts the article before it inserts the player, so the first
            // pass over a video post sees no media at all. Marking the article
            // as done at that point is what left video posts with no download
            // button. Leave it unmarked until there is something to attach to,
            // and a later mutation on the same article tries again.
            if (!media && imgs.length < 2) return
            let status_id = this.statusIdOf(article)
            // With no permalink there is nothing to attribute the media to, and
            // a guessed id would download a different post. Leaving the article
            // unmarked means a later mutation tries again.
            if (!status_id) return
            article.dataset.detected = 'true'
            if (media) {
                let btn_group = article.querySelector('div[role="group"]:last-of-type, ul.tweet-actions, ul.tweet-detail-actions')
                let btn_share = Array.from(btn_group.querySelectorAll(':scope>div>div, li.tweet-action-item>a, li.tweet-detail-action-item>a')).pop().parentNode
                let btn_down = btn_share.cloneNode(true)
                btn_down.querySelector('button').removeAttribute('disabled')
                if (is_tweetdeck) {
                    btn_down.firstElementChild.innerHTML = '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px;">' + this.svg + '</svg>'
                    btn_down.firstElementChild.removeAttribute('rel')
                    btn_down.classList.replace('pull-left', 'pull-right')
                } else {
                    btn_down.querySelector('svg').innerHTML = this.svg
                }
                let is_exist = history.indexOf(status_id) >= 0
                this.status(btn_down, 'tmd-down')
                this.status(btn_down, is_exist ? 'completed' : 'download', is_exist ? lang.completed : lang.download)
                btn_group.insertBefore(btn_down, btn_share.nextSibling)
                btn_down.onclick = () => this.click(btn_down, status_id, is_exist)
                if (show_sensitive) {
                    let btn_show = article.querySelector('div[aria-labelledby] div[role="button"][tabindex="0"]:not([data-testid]) > div[dir] > span > span')
                    if (btn_show) btn_show.click()
                }
            }
            if (imgs.length > 1) {
                let btn_group = article.querySelector('div[role="group"]:last-of-type')
                let btn_share = Array.from(btn_group.querySelectorAll(':scope>div>div')).pop().parentNode
                imgs.forEach(img => {
                    // A photo link points at the post that owns the photo:
                    // /{user}/status/{id}/photo/{n}. When the article also
                    // renders a quoted post, that id is the quoted post's, not
                    // the outer one's. Reading it here makes each thumbnail
                    // button unambiguous about what it downloads.
                    let parts = img.href.split('/status/').pop().split('/')
                    let img_status_id = parts.shift() || status_id
                    let index = parts.pop()
                    let is_exist = history.indexOf(img_status_id) >= 0
                    let btn_down = document.createElement('div')
                    btn_down.innerHTML = '<div><div><svg viewBox="0 0 24 24" style="width: 18px; height: 18px;">' + this.svg + '</svg></div></div>'
                    btn_down.classList.add('tmd-down', 'tmd-img')
                    this.status(btn_down, 'download')
                    img.parentNode.appendChild(btn_down)
                    btn_down.onclick = e => {
                        e.preventDefault()
                        this.click(btn_down, img_status_id, is_exist, index)
                    }
                })
            }
        },
        addButtonToMedia: function (listitems) {
            listitems.forEach(li => {
                if (li.dataset.detected) return
                li.dataset.detected = 'true'
                let status_id = li.querySelector('a[href*="/status/"]').href.split('/status/').pop().split('/').shift()
                let is_exist = history.indexOf(status_id) >= 0
                let btn_down = document.createElement('div')
                btn_down.innerHTML = '<div><div><svg viewBox="0 0 24 24" style="width: 18px; height: 18px;">' + this.svg + '</svg></div></div>'
                btn_down.classList.add('tmd-down', 'tmd-media')
                this.status(btn_down, is_exist ? 'completed' : 'download', is_exist ? lang.completed : lang.download)
                li.appendChild(btn_down)
                btn_down.onclick = () => this.click(btn_down, status_id, is_exist)
            })
        },
        click: async function (btn, status_id, is_exist, index) {
            if (btn.classList.contains('loading')) return
            this.status(btn, 'loading')
            let out = (await GM_getValue('filename', filename)).split('\n').join('')
            let save_history = await GM_getValue('save_history', true)
            let json = await this.fetchJson(status_id)

            // Work out which post the media belongs to instead of asking.
            //
            // Upstream showed a chooser whenever the quoted post had media, even
            // when the post being clicked had its own. That fires on every quote
            // post that carries an image, which is most of them.
            //
            // A thumbnail button already passes the id taken from its photo
            // link, so by this point status_id is the post that owns the image
            // and sourceOf returns that post. The quoted branch only matters for
            // the post-level button on a quote post with no media of its own.
            let source = this.sourceOf(json)
            let tweet = source.legacy
            // The name in the filename has to follow the post the media came
            // from, not whoever quoted it.
            let user = source.core.user_results.result.legacy

            let datetime = out.match(/\{date-time(-local)?:[^{}]+\}/) ? out.match(/\{date-time(?:-local)?:([^{}]+)\}/)[1].replace(/[\\/|<>*?:"]/g, v => invalid_chars[v]) : 'YYYYMMDD-hhmmss'
            let info = {}
            // Follows the chosen post, so the filename cannot name one post and
            // contain another post's media.
            info['status-id'] = tweet.id_str || status_id
            info['user-name'] = user.name.replace(/([\\/|*?:"\u200b-\u200d\u2060\ufeff]|🔞)/g, v => invalid_chars[v])
            info['user-id'] = user.screen_name
            info['date-time'] = this.formatDate(tweet.created_at, datetime)
            info['date-time-local'] = this.formatDate(tweet.created_at, datetime, true)
            info['full-text'] = tweet.full_text.split('\n').join(' ').replace(/\s*https:\/\/t\.co\/\w+/g, '').replace(/[\\/|<>*?:"\u200b-\u200d\u2060\ufeff]/g, v => invalid_chars[v])
            let medias = tweet.extended_entities && tweet.extended_entities.media
            // A card only blocks the download when it is all the post has. X also
            // attaches a player card to native video posts, so failing on the
            // presence of a card alone rejected every video while photos - which
            // never get a card - kept working.
            if (!Array.isArray(medias) || medias.length == 0) {
                this.status(btn, 'failed', json?.card
                    ? 'This tweet contains a link, which is not supported by this script.'
                    : 'MEDIA_NOT_FOUND')
                return
            }
            if (index) medias = [medias[index - 1]]
            if (medias.length > 0) {
                let tasks = medias.map((media, i) => {
                    info.url = media.type == 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type == 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url
                    info.file = info.url.split('/').pop().split(/[:?]/).shift()
                    info['file-name'] = info.file.split('.').shift()
                    info['file-ext'] = info.file.split('.').pop();
                    info['file-type'] = media.type.replace('animated_', '')
                    info.out = (out.replace(/\.?\{file-ext\}/, '') + ((medias.length > 1 || index) && !out.match('{file-name}') ? '-' + (index ? index - 1 : i) : '') + '.{file-ext}').replace(/\{([^{}:]+)(:[^{}]+)?\}/g, (match, name) => info[name])
                    return { url: info.url, name: info.out }
                })
                this.downloader.add(tasks, btn, save_history, is_exist, status_id, GM_getValue('enable_packaging', false))
            } else {
                this.status(btn, 'failed', 'MEDIA_NOT_FOUND')
            }
        }, downloader: (function () {
            let tasks = [], thread = 0, failed = 0, notifier, has_failed = false
            return {
                add: function (taskList, btn, save_history, is_exist, status_id, enable_packaging) {
                    if (taskList.length > 1) {
                        tasks.push(...taskList)
                        this.update()
                        if (enable_packaging) {
                            let zip = new JSZip()
                            let completedCount = 0
                            taskList.forEach((task, i) => {
                                thread++
                                this.update()
                                fetch(task.url)
                                    .then(response => {
                                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                                        return response.arrayBuffer()   // ← 关键修改
                                    })
                                    .then(buffer => {
                                        const uint8Array = new Uint8Array(buffer)
                                        zip.file(task.name, uint8Array);
                                        tasks = tasks.filter(t => t.url !== task.url)
                                        thread--
                                        this.update()
                                        completedCount++
                                        if (completedCount === taskList.length) {
                                            zip.generateAsync({ type: 'blob' }).then(content => {
                                                const zipBlob = new Blob([content], { type: 'application/zip' })
                                                const zipUrl = URL.createObjectURL(zipBlob)
                                                const zipFileName = `${taskList[0].name}.zip`

                                                // 检测是否为 Firefox
                                                const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1

                                                // Firefox 使用 GM_download
                                                if (isFirefox) {
                                                    GM_download({
                                                        url: zipUrl,
                                                        name: zipFileName,
                                                        onload: () => {
                                                            URL.revokeObjectURL(zipUrl)
                                                            this.status(btn, 'completed', lang.completed)
                                                            if (save_history && !is_exist) {
                                                                history.push(status_id)
                                                                this.storage(status_id)
                                                            }
                                                        },
                                                        onerror: (err) => {
                                                            URL.revokeObjectURL(zipUrl)
                                                            this.status(btn, 'failed', err.details?.current || 'ZIP download failed')
                                                        }
                                                    })
                                                } else {
                                                    // Chrome / Edge / Opera 等使用传统 a.click 方式
                                                    const a = document.createElement('a')
                                                    a.href = zipUrl
                                                    a.download = zipFileName
                                                    document.body.appendChild(a)
                                                    a.click()
                                                    // 延迟移除，确保下载开始
                                                    setTimeout(() => {
                                                        document.body.removeChild(a)
                                                        URL.revokeObjectURL(zipUrl)
                                                    }, 100)
                                                    this.status(btn, 'completed', lang.completed)
                                                    if (save_history && !is_exist) {
                                                        history.push(status_id)
                                                        this.storage(status_id)
                                                    }
                                                }
                                            }).catch(err => {
                                                this.status(btn, 'failed', err.message)
                                            })
                                        }
                                    })
                                    .catch(error => {
                                        failed++
                                        tasks = tasks.filter(t => t.url !== task.url)
                                        this.status(btn, 'failed', error.message)
                                        this.update()
                                    })
                            })
                        } else {
                            taskList.forEach((task) => {
                                thread++
                                this.update()

                                GM_download({
                                    url: task.url,
                                    name: task.name,
                                    onload: () => {
                                        thread--
                                        tasks = tasks.filter(t => t.url !== task.url)
                                        this.status(btn, 'completed', lang.completed)
                                        if (save_history && !is_exist) {
                                            history.push(status_id)
                                            this.storage(status_id)
                                        }
                                        this.update()
                                    },
                                    onerror: result => {
                                        thread--
                                        failed++
                                        tasks = tasks.filter(t => t.url !== task.url)
                                        this.status(btn, 'failed', result.details.current)
                                        this.update()
                                    }
                                })
                            })
                        }
                    } else {
                        tasks.push(taskList[0])
                        thread++
                        this.update()
                        GM_download({
                            url: taskList[0].url,
                            name: taskList[0].name,
                            onload: () => {
                                thread--
                                tasks = tasks.filter(t => t.url !== taskList[0].url)
                                this.status(btn, 'completed', lang.completed)

                                if (save_history && !is_exist) {
                                    history.push(status_id)
                                    this.storage(status_id)
                                }
                                this.update()
                            },
                            onerror: result => {
                                thread--
                                failed++
                                tasks = tasks.filter(t => t.url !== taskList[0].url)
                                this.status(btn, 'failed', result.details.current)
                                this.update()
                            }
                        })
                    }
                },
                status: function (btn, css, title, style) {
                    if (css) {
                        btn.classList.remove('download', 'completed', 'loading', 'failed')
                        btn.classList.add(css)
                    }
                    if (title) btn.title = title
                    if (style) btn.style.cssText = style
                },
                storage: async function (value) {
                    let data = await GM_getValue('download_history', [])
                    let data_length = data.length
                    if (value) {
                        if (Array.isArray(value)) data = data.concat(value)
                        else if (data.indexOf(value) < 0) data.push(value)
                    } else return data
                    if (data.length > data_length) GM_setValue('download_history', data)
                },
                update: function () {
                    if (!notifier) {
                        notifier = document.createElement('div')
                        notifier.title = 'X++'
                        notifier.classList.add('tmd-notifier')
                        notifier.innerHTML = '<label>0</label>|<label>0</label>'
                        document.body.appendChild(notifier)
                    }
                    if (failed > 0 && !has_failed) {
                        has_failed = true
                        notifier.innerHTML += '|'
                        let clear = document.createElement('label')
                        notifier.appendChild(clear)
                        clear.onclick = () => {
                            notifier.innerHTML = '<label>0</label>|<label>0</label>'
                            failed = 0
                            has_failed = false
                            this.update()
                        }
                    }
                    notifier.firstChild.innerText = thread
                    notifier.firstChild.nextElementSibling.innerText = tasks.length - thread - failed
                    if (failed > 0) notifier.lastChild.innerText = failed
                    if (thread > 0 || tasks.length > 0 || failed > 0) notifier.classList.add('running')
                    else notifier.classList.remove('running')
                }
            }
        })(),
        status: function (btn, css, title, style) {
            if (css) {
                btn.classList.remove('download', 'completed', 'loading', 'failed')
                btn.classList.add(css)
            }
            if (title) btn.title = title
            if (style) btn.style.cssText = style
        },
        settings: async function () {
            const $element = (parent, tag, style, content, css) => {
                let el = document.createElement(tag)
                if (style) el.style.cssText = style
                if (typeof content !== 'undefined') {
                    if (tag == 'input') {
                        if (content == 'checkbox') el.type = content
                        else el.value = content
                    } else el.innerHTML = content
                }
                if (css) css.split(' ').forEach(c => el.classList.add(c))
                parent.appendChild(el)
                return el
            }
            let wapper = $element(document.body, 'div', 'position: fixed; left: 0px; top: 0px; width: 100%; height: 100%; background-color: #0009; z-index: 10;')
            let wapper_close
            wapper.onmousedown = e => {
                wapper_close = e.target == wapper
            }
            wapper.onmouseup = e => {
                if (wapper_close && e.target == wapper) wapper.remove()
            }
            let dialog = $element(wapper, 'div', 'position: absolute; left: 50%; top: 50%; transform: translateX(-50%) translateY(-50%); width: fit-content; width: -moz-fit-content; background-color: #f3f3f3; border: 1px solid #ccc; border-radius: 10px; color: black;')
            let title = $element(dialog, 'h3', 'margin: 10px 20px;', lang.dialog.title)
            let options = $element(dialog, 'div', 'margin: 10px; border: 1px solid #ccc; border-radius: 5px;')
            let save_history_label = $element(options, 'label', 'display: block; margin: 10px;', lang.dialog.save_history)
            let save_history_input = $element(save_history_label, 'input', 'float: left;', 'checkbox')
            save_history_input.checked = await GM_getValue('save_history', true)
            save_history_input.onchange = () => {
                GM_setValue('save_history', save_history_input.checked)
            }
            let clear_history = $element(save_history_label, 'label', 'display: inline-block; margin: 0 10px; color: blue;', lang.dialog.clear_history)
            clear_history.onclick = () => {
                if (confirm(lang.dialog.clear_confirm)) {
                    history = []
                    GM_setValue('download_history', [])
                }
            }
            let show_sensitive_label = $element(options, 'label', 'display: block; margin: 10px;', lang.dialog.show_sensitive)
            let show_sensitive_input = $element(show_sensitive_label, 'input', 'float: left;', 'checkbox')
            show_sensitive_input.checked = await GM_getValue('show_sensitive', true)
            show_sensitive_input.onchange = () => {
                show_sensitive = show_sensitive_input.checked
                GM_setValue('show_sensitive', show_sensitive)
            }
            let show_enable_packaging = $element(options, 'label', 'display: block; margin: 10px;', lang.enable_packaging)
            let show_enable_packaging_input = $element(show_enable_packaging, 'input', 'float: left;', 'checkbox')
            show_enable_packaging_input.checked = await GM_getValue('enable_packaging', false)
            show_enable_packaging_input.onchange = () => {
                GM_setValue('enable_packaging', show_enable_packaging_input.checked)
            }
            let filename_div = $element(dialog, 'div', 'margin: 10px; border: 1px solid #ccc; border-radius: 5px;')
            let filename_label = $element(filename_div, 'label', 'display: block; margin: 10px 15px;', lang.dialog.pattern)
            let filename_input = $element(filename_label, 'textarea', 'display: block; min-width: 500px; max-width: 500px; min-height: 100px; font-size: inherit; background: white; color: black;', await GM_getValue('filename', filename))
            let filename_tags = $element(filename_div, 'label', 'display: table; margin: 10px;', `
<span class="tmd-tag" title="user name">{user-name}</span>
<span class="tmd-tag" title="The user name after @ sign.">{user-id}</span>
<span class="tmd-tag" title="example: 1234567890987654321">{status-id}</span>
<span class="tmd-tag" title="{date-time} : Posted time in UTC.\n{date-time-local} : Your local time zone.\n\nDefault:\nYYYYMMDD-hhmmss => 20201231-235959\n\nExample of custom:\n{date-time:DD-MMM-YY hh.mm} => 31-DEC-21 23.59">{date-time}</span><br>
<span class="tmd-tag" title="Text content in tweet.">{full-text}</span>
<span class="tmd-tag" title="Type of &#34;video&#34; or &#34;photo&#34; or &#34;gif&#34;.">{file-type}</span>
<span class="tmd-tag" title="Original filename from URL.">{file-name}</span>
`)
            filename_input.selectionStart = filename_input.value.length
            filename_tags.querySelectorAll('.tmd-tag').forEach(tag => {
                tag.onclick = () => {
                    let ss = filename_input.selectionStart
                    let se = filename_input.selectionEnd
                    filename_input.value = filename_input.value.substring(0, ss) + tag.innerText + filename_input.value.substring(se)
                    filename_input.selectionStart = ss + tag.innerText.length
                    filename_input.selectionEnd = ss + tag.innerText.length
                    filename_input.focus()
                }
            })
            let btn_save = $element(title, 'label', 'float: right;', lang.dialog.save, 'tmd-btn')
            btn_save.onclick = async () => {
                await GM_setValue('filename', filename_input.value)
                wapper.remove()
            }
        },
        fetchJson: async function (status_id) {
            let base_url = `https://${host}/i/api/graphql/2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId`
            let variables = {
                'tweetId': status_id,
                'with_rux_injections': false,
                'includePromotedContent': true,
                'withCommunity': true,
                'withQuickPromoteEligibilityTweetFields': true,
                'withBirdwatchNotes': true,
                'withVoice': true,
                'withV2Timeline': true
            }
            let features = {
                'articles_preview_enabled': true,
                'c9s_tweet_anatomy_moderator_badge_enabled': true,
                'communities_web_enable_tweet_community_results_fetch': false,
                'creator_subscriptions_quote_tweet_preview_enabled': false,
                'creator_subscriptions_tweet_preview_api_enabled': false,
                'freedom_of_speech_not_reach_fetch_enabled': true,
                'graphql_is_translatable_rweb_tweet_is_translatable_enabled': true,
                'longform_notetweets_consumption_enabled': false,
                'longform_notetweets_inline_media_enabled': true,
                'longform_notetweets_rich_text_read_enabled': false,
                'premium_content_api_read_enabled': false,
                'profile_label_improvements_pcf_label_in_post_enabled': true,
                'responsive_web_edit_tweet_api_enabled': false,
                'responsive_web_enhance_cards_enabled': false,
                'responsive_web_graphql_exclude_directive_enabled': false,
                'responsive_web_graphql_skip_user_profile_image_extensions_enabled': false,
                'responsive_web_graphql_timeline_navigation_enabled': false,
                'responsive_web_grok_analysis_button_from_backend': false,
                'responsive_web_grok_analyze_button_fetch_trends_enabled': false,
                'responsive_web_grok_analyze_post_followups_enabled': false,
                'responsive_web_grok_image_annotation_enabled': false,
                'responsive_web_grok_share_attachment_enabled': false,
                'responsive_web_grok_show_grok_translated_post': false,
                'responsive_web_jetfuel_frame': false,
                'responsive_web_media_download_video_enabled': false,
                'responsive_web_twitter_article_tweet_consumption_enabled': true,
                'rweb_tipjar_consumption_enabled': true,
                'rweb_video_screen_enabled': false,
                'standardized_nudges_misinfo': true,
                'tweet_awards_web_tipping_enabled': false,
                'tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled': true,
                'tweetypie_unmention_optimization_enabled': false,
                'verified_phone_label_enabled': false,
                'view_counts_everywhere_api_enabled': true
            }
            let url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`)
            let cookies = this.getCookie()
            let headers = {
                'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                'x-twitter-active-user': 'yes',
                'x-twitter-client-language': cookies.lang,
                'x-csrf-token': cookies.ct0
            }
            if (cookies.ct0.length == 32) headers['x-guest-token'] = cookies.gt
            let tweet_detail = await fetch(url, { headers: headers }).then(result => result.json())
            let tweet_result = tweet_detail.data.tweetResult.result
            return tweet_result.tweet || tweet_result
        },
        getCookie: function (name) {
            let cookies = {}
            document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
                n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
                    cookies[name.trim()] = value.trim()
                })
            })
            return name ? cookies[name] : cookies
        },
        storage: async function (value) {
            let data = await GM_getValue('download_history', [])
            let data_length = data.length
            if (value) {
                if (Array.isArray(value)) data = data.concat(value)
                else if (data.indexOf(value) < 0) data.push(value)
            } else return data
            if (data.length > data_length) GM_setValue('download_history', data)
        },
        storage_obsolete: function (is_remove) {
            let data = JSON.parse(localStorage.getItem('history') || '[]')
            if (is_remove) localStorage.removeItem('history')
            else return data
        },
        formatDate: function (i, o, tz) {
            let d = new Date(i)
            if (tz) d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
            let m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
            let v = {
                YYYY: d.getUTCFullYear().toString(),
                YY: d.getUTCFullYear().toString(),
                MM: d.getUTCMonth() + 1,
                MMM: m[d.getUTCMonth()],
                DD: d.getUTCDate(),
                hh: d.getUTCHours(),
                mm: d.getUTCMinutes(),
                ss: d.getUTCSeconds(),
                h2: d.getUTCHours() % 12,
                ap: d.getUTCHours() < 12 ? 'AM' : 'PM'
            }
            return o.replace(/(YY(YY)?|MMM?|DD|hh|mm|ss|h2|ap)/g, n => ('0' + v[n]).substr(-n.length))
        },

        language: {
            en: { download: 'Download', completed: 'Download Completed', settings: 'Settings', dialog: { title: 'Download Settings', save: 'Save', save_history: 'Remember download history', clear_history: '(Clear)', clear_confirm: 'Clear download history?', show_sensitive: 'Always show sensitive content', pattern: 'File Name Pattern' }, enable_packaging: 'Package multiple files into a ZIP', original: 'Original Tweet', quote: 'Quoted Tweet', cancel: 'Cancel', choose: 'Select media to download' },
            ja: { download: 'ダウンロード', completed: 'ダウンロード完了', settings: '設定', dialog: { title: 'ダウンロード設定', save: '保存', save_history: 'ダウンロード履歴を保存する', clear_history: '(クリア)', clear_confirm: 'ダウンロード履歴を削除する？', show_sensitive: 'センシティブな内容を常に表示する', pattern: 'ファイル名パターン' }, enable_packaging: '複数ファイルを ZIP にパッケージ化する', original: '元のツイート', quote: '引用ツイート', cancel: 'キャンセル', choose: 'メディアを選択' },
            zh: { download: '下载', completed: '下载完成', settings: '设置', dialog: { title: '下载设置', save: '保存', save_history: '保存下载记录', clear_history: '(清除)', clear_confirm: '确认要清除下载记录？', show_sensitive: '自动显示敏感的内容', pattern: '文件名格式' }, enable_packaging: '多文件打包成 ZIP', original: '原始推文', quote: '引用推文', cancel: '取消', choose: '选择要下载的媒体' },
            'zh-Hant': { download: '下載', completed: '下載完成', settings: '設置', dialog: { title: '下載設置', save: '保存', save_history: '保存下載記錄', clear_history: '(清除)', clear_confirm: '確認要清除下載記錄？', show_sensitive: '自動顯示敏感的内容', pattern: '文件名規則' }, enable_packaging: '多文件打包成 ZIP', original: '原始推文', quote: '引用推文', cancel: '取消', choose: '選擇要下載的媒體' }
        },
        css: `
.tmd-down {margin-left: 12px; order: 99;}
.tmd-down:hover > div > div > div > div {color: rgba(29, 161, 242, 1.0);}
.tmd-down:hover > div > div > div > div > div {background-color: rgba(29, 161, 242, 0.1);}
.tmd-down:active > div > div > div > div > div {background-color: rgba(29, 161, 242, 0.2);}
.tmd-down:hover svg {color: rgba(29, 161, 242, 1.0);}
.tmd-down:hover div:first-child:not(:last-child) {background-color: rgba(29, 161, 242, 0.1);}
.tmd-down:active div:first-child:not(:last-child) {background-color: rgba(29, 161, 242, 0.2);}
.tmd-down.tmd-media {position: absolute; right: 0;}
.tmd-down.tmd-media > div {display: flex; border-radius: 99px; margin: 2px;}
.tmd-down.tmd-media > div > div {display: flex; margin: 6px; color: #fff;}
.tmd-down.tmd-media:hover > div {background-color: rgba(255,255,255, 0.6);}
.tmd-down.tmd-media:hover > div > div {color: rgba(29, 161, 242, 1.0);}
.tmd-down.tmd-media:not(:hover) > div > div {filter: drop-shadow(0 0 1px #000);}
.tmd-down g {display: none;}
.tmd-down.download g.download, .tmd-down.completed g.completed, .tmd-down.loading g.loading,.tmd-down.failed g.failed {display: unset;}
.tmd-down.loading svg {animation: spin 1s linear infinite;}
@keyframes spin {0% {transform: rotate(0deg);} 100% {transform: rotate(360deg);}}
.tmd-btn {display: inline-block; background-color: #1DA1F2; color: #FFFFFF; padding: 0 20px; border-radius: 99px;}
.tmd-tag {display: inline-block; background-color: #FFFFFF; color: #1DA1F2; padding: 0 10px; border-radius: 10px; border: 1px solid #1DA1F2;  font-weight: bold; margin: 5px;}
.tmd-btn:hover {background-color: rgba(29, 161, 242, 0.9);}
.tmd-tag:hover {background-color: rgba(29, 161, 242, 0.1);}
.tmd-notifier {display: none; position: fixed; left: 16px; bottom: 16px; color: #000; background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 4px;}
.tmd-notifier.running {display: flex; align-items: center;}
.tmd-notifier label {display: inline-flex; align-items: center; margin: 0 8px;}
.tmd-notifier label:before {content: " "; width: 32px; height: 16px; background-position: center; background-repeat: no-repeat;}
.tmd-notifier label:nth-child(1):before {background-image:url("data:image/svg+xml;charset=utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22><path d=%22M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l4,4 q1,1 2,0 l4,-4 M12,3 v11%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 /></svg>");}
.tmd-notifier label:nth-child(2):before {background-image:url("data:image/svg+xml;charset=utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22><path d=%22M12,2 a1,1 0 0 1 0,20 a1,1 0 0 1 0,-20 M12,5 v7 h6%22 fill=%22none%22 stroke=%22%23999%22 stroke-width=%222%22 stroke-linejoin=%22round%22 stroke-linecap=%22round%22 /></svg>");}
.tmd-notifier label:nth-child(3):before {background-image:url("data:image/svg+xml;charset=utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22><path d=%22M12,0 a2,2 0 0 0 0,24 a2,2 0 0 0 0,-24%22 fill=%22%23f66%22 stroke=%22none%22 /><path d=%22M14.5,5 a1,1 0 0 0 -5,0 l0.5,9 a1,1 0 0 0 4,0 z M12,17 a2,2 0 0 0 0,5 a2,2 0 0 0 0,-5%22 fill=%22%23fff%22 stroke=%22none%22 /></svg>");}

/* --- Improved style for the image hover button (bottom-right) --- */
.tmd-down.tmd-img {
    position: absolute;
    bottom: 8px; /* Changed from top to bottom */
    right: 8px;
    display: none !important;
    z-index: 10;
}
.tmd-down.tmd-img > div {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: rgba(15, 20, 25, 0.75);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: background-color 0.2s ease;
    cursor: pointer;
}
.tmd-down.tmd-img > div > div {
    display: flex;
    color: rgb(239, 243, 244);
    transition: color 0.2s ease;
}
.tmd-down.tmd-img:hover > div {
    background-color: rgba(39, 44, 48, 0.85);
}
.tmd-down.tmd-img:hover > div > div {
    color: rgb(29, 161, 242);
}
:hover > .tmd-down.tmd-img, .tmd-img.loading, .tmd-img.completed, .tmd-img.failed {
    display: block !important;
}
/* --- End of improved style --- */

.tweet-detail-action-item {width: 20% !important;}
`,
        css_ss: `
/* show sensitive in media tab */
li[role="listitem"]>div>div>div>div:not(:last-child) {filter: none;}
li[role="listitem"]>div>div>div>div+div:last-child {display: none;}
`,
        svg: `
<g class="download"><path d="M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l4,4 q1,1 2,0 l4,-4 M12,3 v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></g>
<g class="completed"><path d="M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l3,4 q1,1 2,0 l8,-11" fill="none" stroke="#1DA1F2" stroke-width="2" stroke-linecap="round" /></g>
<g class="loading"><circle cx="12" cy="12" r="10" fill="none" stroke="#1DA1F2" stroke-width="4" opacity="0.4" /><path d="M12,2 a10,10 0 0 1 10,10" fill="none" stroke="#1DA1F2" stroke-width="4" stroke-linecap="round" /></g>
<g class="failed"><circle cx="12" cy="12" r="11" fill="#f33" stroke="currentColor" stroke-width="2" opacity="0.8" /><path d="M14,5 a1,1 0 0 0 -4,0 l0.5,9.5 a1.5,1.5 0 0 0 3,0 z M12,17 a2,2 0 0 0 0,4 a2,2 0 0 0 0,-4" fill="#fff" stroke="none" /></g>
`
    }
})()

// The layout sections need @run-at document-start, so this file as a whole
// runs before <body> exists. init() reads document.body and document.head,
// which the downloader used to get for free by running at document-end.
if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', () => TMD.init(), { once: true })
else TMD.init()
