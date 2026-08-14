// ==UserScript==
// @name         X Media Carousel Fix
// @version      1.1
// @description  Reverts X's horizontal-scrolling post media carousel back to the old thumbnail grid, so every image in a post is visible at once.
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://github.com/kpg-anon/scripts/raw/main/userscripts/x-media-carousel-fix.user.js
// @updateURL    https://github.com/kpg-anon/scripts/raw/main/userscripts/x-media-carousel-fix.user.js
// @match        *://x.com/*
// @match        *://twitter.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

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

    // Other userscripts inject overlay controls into the carousel (e.g. Twitter
    // Media Downloader's .tmd-down button). They must never be treated as
    // thumbnails, or they throw the column count off and shift tiles around.
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
       containing block, so absolutely-positioned overlays from other scripts
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
    /* Some frontends wrap each photo in two /photo/ links, so downloader
       scripts add their button twice per tile, stacked in the same corner. */
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

    // Downloader scripts key off links, and some frontends render two /photo/
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
