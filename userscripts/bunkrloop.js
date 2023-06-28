// ==UserScript==
// @name        Loop videos for bunkrr.su
// @namespace   bunkrr.su
// @match       https://bunkrr.su/v/*
// @grant       none
// @version     1.0
// @author      anon
// @description Sets the loop property of the video tag on the page to true
// ==/UserScript==

document.getElementById('player').loop = true;