// ==UserScript==
// @name        Watch on JavGG
// @namespace   onejav.com
// @match       https://onejav.com/torrent/*
// @grant       none
// @version     1.1
// @author      anon
// @run-at      document-idle
// @description Adds a "Watch on JavGG" button to onejav torrent pages
// ==/UserScript==

(function() {
    const formatURL = title => 'https://javgg.net/?s=' + title.trim();

    const torrents = document.getElementsByClassName('card');
    for(let i = 0; i < torrents.length; i++) {
        const title = document.querySelector(`.title:nth-of-type(${i + 1}) > a`).textContent;
        const flexContainer = torrents[i].getElementsByClassName('field')[0];
        const p = document.createElement('p');
        p.classList = flexContainer.children[0].classList;
        const a = document.createElement('a');
        console.log(flexContainer);
        a.classList = flexContainer.children[0].children[0].classList;
        a.href = formatURL(title);
        a.target = '_blank';
        a.rel = 'noreferrer';
        a.textContent = 'Search on JavGG';
        flexContainer.appendChild(p);
        p.appendChild(a);
    }
})();
