// ==UserScript==
// @name          Open daum cafe posts without logging in
// @namespace     https://gitlab.com/loopvid/scripts
// @description   Open daum cafe posts without logging in
// @include       /^https?://(m\.)?cafe\.daum\.net/.+/\d+(\?.*)?$/
// @exclude       /^https?://(m\.)?cafe\.daum\.net/.+/\d+\?svc=cafeapp$/
// @version       1.0
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function() {
  'use strict';

  function redirect() {
    var url = window.location.href.replace(/\?.*$/, '') + '?svc=cafeapp';

    if (url !== window.location.href) {
      window.location.replace(url);
    }
  }

  // run immediately since we want to redirect as soon as possible to avoid
  // loading the page for no reason
  redirect();

}());
