// ==UserScript==
// @name         Remove YouTube Share Tracking Parameter
// @namespace    https://github.com/kpg-anon/scripts/blob/main/userscripts/yt-remove-tracking.js
// @version      1.0
// @description  Removes ?si= tracking parameter from YouTube share URLs
// @author       kpganon
// @match        *://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function removeTrackingFromLinks() {
        // Get all input elements
        const inputs = document.querySelectorAll('input');
        
        // Iterate through each input element
        for (const input of inputs) {
            let value = input.value;
            // Check if the value matches a YouTube share URL with tracking parameter
            if (/https:\/\/youtu\.be\/[a-zA-Z0-9_-]+\?si=/.test(value)) {
                // Remove the tracking parameter
                input.value = value.split('?si=')[0];
            }
        }
    }

    // Initial call
    removeTrackingFromLinks();

    // To handle YouTube's dynamic content loading
    new MutationObserver(removeTrackingFromLinks).observe(document, {subtree: true, childList: true});
})();
