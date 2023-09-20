// ==UserScript==
// @name         Reddit Imgur GIFV to MP4
// @namespace    https://github.com/kpg-anon/scripts/blob/main/userscripts/reddit-gifv2mp4.js
// @version      1.0
// @description  Change imgur .gifv links to .mp4
// @author       kpganon
// @match        *://*.reddit.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function replaceGifvLinks() {
        // Select all the relevant anchor tags that have href attributes containing "i.imgur.com" and ending with ".gifv"
        let links = document.querySelectorAll('a[href*="i.imgur.com"][href$=".gifv"]');
        
        links.forEach((link) => {
            let newHref = link.getAttribute('href').replace(/\.gifv$/, '.mp4');
            link.setAttribute('href', newHref);
        });
    }

    // Initial replace
    replaceGifvLinks();

    // Observe changes in the DOM to handle dynamically loaded content
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const observer = new MutationObserver((mutationsList, observer) => {
        replaceGifvLinks();
    });

    observer.observe(targetNode, config);

})();
