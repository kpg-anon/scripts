// ==UserScript==
// @name         X Widescreen Fix
// @version      1.0.1
// @modified     2026.08.26
// @description  Centers X's timeline on the viewport, widens it, strips the right sidebar down to the search field, and adds a zoom slider.
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://github.com/kpg-anon/scripts/raw/main/userscripts/x-widescreen-fix.user.js
// @updateURL    https://github.com/kpg-anon/scripts/raw/main/userscripts/x-widescreen-fix.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

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
           and the button x-media-downloader inserts into the same flex row. */
        [data-testid="primaryColumn"] article [role="group"] {
            max-width: none !important;
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
