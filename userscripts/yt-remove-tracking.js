// ==UserScript==
// @name         Remove YouTube Share Tracking Parameters
// @namespace    https://github.com/kpg-anon/scripts/blob/main/userscripts/yt-remove-tracking.js
// @version      1.1
// @description  Removes tracking parameters from all YouTube links
// @author       kpganon
// @match        *://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function removeTrackingParameters(input) {
        if (input && input.value) {
            let newValue = input.value.replace(/(\&|\?)si=[^&]+/, '').replace(/(\&|\?)pp=[^&]+/, '');
            newValue = newValue.replace(/^([^?]+)&/, '$1?');
            if (input.value !== newValue) {
                input.value = newValue;
            }
        }
    }

    function handleInputChange() {
        const shareInput = document.querySelector('yt-share-target-renderer input');
        removeTrackingParameters(shareInput);
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('yt-share-target-renderer')) {
                        const intervalId = setInterval(handleInputChange, 50);

                        const closeButton = node.querySelector('[aria-label="Close"]');
                        if (closeButton) {
                            closeButton.addEventListener('click', () => {
                                clearInterval(intervalId);
                            });
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
        document.querySelectorAll('input, a').forEach(element => {
            if (element.tagName.toLowerCase() === 'input') {
                removeTrackingParameters(element);
            } else if (element.tagName.toLowerCase() === 'a' && /\/watch\?v=/.test(element.href)) {
                element.href = element.href.replace(/(\&|\?)si=[^&]+/, '').replace(/(\&|\?)pp=[^&]+/, '');
            }
        });
    }, 50);
})();