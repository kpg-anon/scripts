// ==UserScript==
// @name         4chanX PPM/PPH Tracker
// @version      1.0
// @description  Calculate projected posts per minute (PPM) or posts per hour (PPH) on 4chan (requires 4chanX)
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://github.com/kpg-anon/scripts/raw/main/userscripts/postratecalculator.user.js
// @updateURL    https://github.com/kpg-anon/scripts/raw/main/userscripts/postratecalculator.user.js
// @include      /^https?://boards\.4chan(nel)?\.org/\w+/thread/\d+/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let postTimestamps = [];
    let capturing = false;
    let captureStartTime = null;
    let mode = 'PPH';
    let capturedPPH = 0;
    let capturedPPM = 0;
    let capturedPosts = [];

    function getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateString = date.toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
        const timeString = date.toLocaleTimeString('en-US', { hour12: false });
        return `${dateString}(${day})${timeString}`;
    }

    function addPostTimestamp(postNumber) {
        const timestamp = getCurrentTimestamp();
        postTimestamps.push(timestamp);
        capturedPosts.push(postNumber);
        console.log(`New post detected: >>${postNumber}`);
    }

    function calculatePPM() {
        if (!captureStartTime) return 0;
        const currentTime = getCurrentTimestamp();
        const recentPosts = postTimestamps.filter(timestamp => timestamp >= captureStartTime);
        const timeElapsed = (currentTime - captureStartTime) / 60;
        return Math.round(recentPosts.length / timeElapsed);
    }

    function calculatePPH() {
        return Math.round(calculatePPM() * 60);
    }

    function formatElapsedTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    }

    function updateRateDisplay() {
        let rateDisplay = document.getElementById('rate-display');
        if (!rateDisplay) {
            const boardList = document.getElementById('board-list');
            if (!boardList) return;
            rateDisplay = document.createElement('span');
            rateDisplay.id = 'rate-display';
            rateDisplay.style.marginLeft = '6px';
            boardList.appendChild(rateDisplay);
        }
        if (capturing) {
            rateDisplay.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:red"></i>';
            rateDisplay.style.fontWeight = 'normal';
            rateDisplay.style.color = 'inherit';
            rateDisplay.style.textShadow = 'none';
        } else {
            rateDisplay.style.fontWeight = 'bold';
            rateDisplay.style.color = '#71fe00';
            rateDisplay.style.textShadow = '0 0 5px #71fe00, 0 0 10px #71fe00, 0 0 15px #71fe00';
            rateDisplay.innerHTML = mode === 'PPH' ? capturedPPH : capturedPPM;
        }
    }

    function handlePlay() {
        capturing = true;
        captureStartTime = getCurrentTimestamp();
        postTimestamps = [];
        capturedPosts = [];
        console.log(`Capture started at: ${formatTimestamp(captureStartTime)}`);
        updateRateDisplay();
        toggleButtons();
    }

    function handlePause() {
        capturing = false;
        const captureEndTime = getCurrentTimestamp();
        capturedPPM = calculatePPM();
        capturedPPH = calculatePPH();
        updateRateDisplay();
        toggleButtons();
        const elapsedSeconds = captureEndTime - captureStartTime;
        console.log(`Capture stopped at: ${formatTimestamp(captureEndTime)}`);
        console.log(`Elapsed: ${formatElapsedTime(elapsedSeconds)}`);
        console.log(`Total posts: ${capturedPosts.length}`);
        console.log(`PPM: ${capturedPPM}`);
        console.log(`PPH: ${capturedPPH}`);
    }

    function createControlButtons() {
        const boardList = document.getElementById('board-list');
        if (!boardList) return;

        const playButton = document.createElement('a');
        playButton.id = 'play-button';
        playButton.className = 'fa fa-play';
        playButton.style.marginLeft = '3px';
        playButton.style.cursor = 'pointer';
        boardList.appendChild(playButton);
        playButton.addEventListener('click', handlePlay);

        const pauseButton = document.createElement('a');
        pauseButton.id = 'pause-button';
        pauseButton.className = 'fa fa-pause';
        pauseButton.style.marginLeft = '3px';
        pauseButton.style.cursor = 'pointer';
        pauseButton.style.display = 'none';
        boardList.appendChild(pauseButton);
        pauseButton.addEventListener('click', handlePause);
    }

    function createDropdownMenu() {
        const boardList = document.getElementById('board-list');
        if (!boardList) return;

        const dropdown = document.createElement('select');
        dropdown.id = 'rate-dropdown';
        dropdown.style.marginLeft = '3px';
        dropdown.innerHTML = `
            <option value="PPH">PPH:▾</option>
            <option value="PPM">PPM:▾</option>
        `;
        boardList.appendChild(dropdown);
        dropdown.addEventListener('change', (event) => {
            mode = event.target.value;
            updateRateDisplay();
        });
    }

    function toggleButtons() {
        const playButton = document.getElementById('play-button');
        const pauseButton = document.getElementById('pause-button');
        if (capturing) {
            playButton.style.display = 'none';
            pauseButton.style.display = 'inline';
        } else {
            playButton.style.display = 'inline';
            pauseButton.style.display = 'none';
        }
    }

    function initialize() {
        createControlButtons();
        createDropdownMenu();
        updateRateDisplay();
    }

    function handleNewPosts(e) {
        if (capturing) {
            const newPosts = e.detail.newPosts || [];
            newPosts.forEach(fullID => {
                const postNumber = fullID.split('.')[1];
                addPostTimestamp(postNumber);
            });
            updateRateDisplay();
        }
    }

    document.addEventListener('4chanXInitFinished', initialize, false);
    document.addEventListener('ThreadUpdate', handleNewPosts, false);
    document.addEventListener('DOMContentLoaded', initialize, false);
})();
