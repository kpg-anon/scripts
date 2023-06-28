// ==UserScript==
// @name        Search artist on Kemono
// @namespace   gelbooru.com
// @match       http*://gelbooru.com/index.php?*s=view*
// @grant       GM_getResourceText
// @version     1.0
// @author      anon
// @description Adds a '(kemono)' button next to each artist tag when viewing a post
// @resource    creators https://kemono.su/api/creators.txt
// ==/UserScript==

// XXX this script downloads and processes ~2MB of JSON from kemono's server

(async function() {
    'use strict';
    const data = JSON.parse(GM_getResourceText('creators'));
    const artists = document.getElementsByClassName('tag-type-artist');
    const a = document.createElement('a');
    a.rel = 'noreferrer';
    a.target = '_blank';
    a.href = 'https://kemono.su/';
    for(const artist of artists) {
        const artistName = artist.children[1].textContent.trim();
        let json = undefined;
        for(const datum of data) {
            if(datum['name'] === artistName) {
                json = datum;
                break;
            }
        }
        if(json === undefined) {
            console.log(`${artistName} is not on kemono!`);
            break;
        }
        const kemono = a.cloneNode();
        const service = json['service'];
        const id = json['id'];
        kemono.href += `${service}/user/${id}/`;
        kemono.textContent = ' (kemono)';
        artist.appendChild(kemono);
    }
})();