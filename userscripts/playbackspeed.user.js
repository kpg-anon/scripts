// ==UserScript==
// @name         Cycle Playback Speed on Hovered Video
// @version      1.0
// @description  Cycles through video speed values by pressing 'S'
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/playbackspeed.user.js
// @updateURL    https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/playbackspeed.user.js
// @include      /^https?:\/\/boards\.4chan(nel)?\.org\/.*\/thread\/.*$/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let hoveredVideo = null;
    const playbackSpeeds = [0.25, 0.4, 0.5, 1.0];

    // Create and style the playback rate indicator
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.bottom = '40px';
    indicator.style.right = '10px';
    indicator.style.zIndex = '10000';
    indicator.style.background = 'rgba(0, 0, 0, 0.7)';
    indicator.style.color = 'white';
    indicator.style.padding = '5px 10px';
    indicator.style.borderRadius = '5px';
    indicator.style.display = 'none'; // Initially hidden
    document.body.appendChild(indicator);

    // Listen for mouseover events on video elements
    document.body.addEventListener('mouseover', event => {
        if (event.target.tagName === 'VIDEO') {
            hoveredVideo = event.target;
            indicator.style.display = 'block'; // Show the indicator
            updateIndicator();
        }
    });

    // Listen for mouseout events to reset the hoveredVideo and hide the indicator
    document.body.addEventListener('mouseout', event => {
        if (event.target.tagName === 'VIDEO') {
            hoveredVideo = null;
            indicator.style.display = 'none'; // Hide the indicator
        }
    });

    // Update the indicator text with the current playback speed
    function updateIndicator() {
        if (hoveredVideo) {
            indicator.textContent = `Playback: ${hoveredVideo.playbackRate}x`;
        }
    }

    // Listen for the 'S' keypress to cycle through playback speeds
    document.body.addEventListener('keydown', event => {
        if (event.key === 's' && hoveredVideo) {
            const currentSpeedIndex = playbackSpeeds.indexOf(hoveredVideo.playbackRate);
            let newSpeedIndex = currentSpeedIndex + 1;

            // If we've reached the end of the playbackSpeeds array, loop back to the start
            if (newSpeedIndex >= playbackSpeeds.length) {
                newSpeedIndex = 0;
            }

            hoveredVideo.playbackRate = playbackSpeeds[newSpeedIndex];
            updateIndicator();
        }
    });
})();
