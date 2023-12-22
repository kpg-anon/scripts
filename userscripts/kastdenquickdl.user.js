// ==UserScript==
// @name         Kastden Quick Download
// @version      1.0
// @description  Download images by pressing 'S' when hovering over a thumbnail
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/kastdenquickdl.user.js
// @updateURL    https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/kastdenquickdl.user.js
// @match        https://selca.kastden.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let hoveredElement = null;

    const downloadImage = (url) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = url.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    document.addEventListener('mouseover', function(e) {
        if (e.target.closest('.image a')) {
            hoveredElement = e.target.closest('.image a');
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 's' || e.key === 'S') {
            if (hoveredElement && hoveredElement.href) {
                e.preventDefault();
                downloadImage(hoveredElement.href);
            }
        }
    });
})();
