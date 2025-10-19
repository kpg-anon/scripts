// ==UserScript==
// @name         easychan gallery
// @version      1.0
// @description  Alt+G to toggle. Press 'S' when hovered over media item to save with original filename. Esc to close
// @match        https://easychan.net/kr/*
// @updateURL    https://github.com/kpg-anon/scripts/raw/refs/heads/main/userscripts/easygallery.user.js
// @grant        GM_addStyle
// @grant        GM_addElement
// ==/UserScript==

(function() {
    'use strict';

    // Base64 encoded images for UI buttons
    const base64Prev = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAABsCAYAAADjYAXIAAAACXBIWXMAAAUTAAAFEwFaO8pPAAAFyWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMy0xMi0xOVQxOToyOTo1MS0wNTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjMtMTItMTlUMTk6NDQ6MTAtMDU6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMTItMTlUMTk6NDQ6MTAtMDU6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmE5N2IxMWQ1LWE0NTctZjg0Yy1iOWNiLTJkYWNjNzQ4NzY5ZCIgeG1wTU06RG9jdW1lbnRJRD0i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";
    const base64Next = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAABsCAYAAADjYAXIAAAACXBIWXMAAAUTAAAFEwFaO8pPAAAFyWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMy0xMi0xOVQxOToyOTo1MS0wNTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjMtMTItMTlUMTk6NDI6NDQtMDU6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMTItMTlUMTk6NDI6NDQtMDU6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmFkY2I5Y2I0LWZmZmYtNzk0Mi1hM2U4LWYxOTcwYTZmM2M0NSIgeG1wTU06RG9jdW1lbnRJRD0i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";
    const base64Close = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAABICAYAAAB/XULoAAAACXBIWXMAAAUTAAAFEwFaO8pPAAAFyWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMy0xMi0xOVQxOToyOTo0NC0wNTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjMtMTItMTlUMTk6NDU6MjgtMDU6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMTItMTlUMTk6NDU6MjgtMDU6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZjZDRlNWExLWM2NjEtOTY0NS1iZmRlLWViNWJmY2ZhNDJhYyIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjY5NzFiYTdjLWMyOTYtYTY0OC1hMTdmLTk2OWU4MDNjMGFkMCIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjkyODNiOGUwLTA1YjgtNzA0NS04N2RmLTQyODM5OTdlZDVjMSI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6OTI4M2I4ZTAtMDViOC03MDQ1LTg3ZGYtNDI4Mzk5N2VkNWMxIiBzdEV2dDp3aGVuPSIyMDIzLTEyLTE5VDE5OjI5OjQ0LTA1OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjUuMCAoV2luZG93cykiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjZjZDRlNWExLWM2NjEtOTY0NS1iZmRlLWViNWJmY2ZhNDJhYyIgc3RFdnQ6d2hlbj0iMjAyMy0xMi0xOVQxOTo0NToyOC0wNTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PictGGQAAAKGSURBVHja7dq7bhpBGIZhykhRuqQKx3g5RGJdYEEkEHdBgUCicwsdQtBAQcX5KKCAzpeARAMIEA2UblLkBiIlkm/Af2YtrxUCtgdEdhbzFa9kI3uLh9Hs7OwYjKYLQtpnAALgAY8AD3gEeMAjwAMeAR7wCPCABzwQAA94BHjAI8ADHgEe8EdKsrsplUpRuVymaDRKJrN00HUczkvKZDJUKpUoFAqxzyTAP5cse2g0GtF6vX6qUqmQ2WLf6zpXV14aj8cb18nn8wd/iW8a3u3eRldrNptksTq4ruPxbKOrFQoFhm8HvJrty1caDoc7sdSq1eqrI9/r9dFkMnnxOolEAvBqkUjkRSy1Vqv17MjfNb3saj6fC51ydAUfi8W44JXq9Tob+Zv4Pt+3V0e62nK5FDrd6Are7pC54ZQajcYTvoI+nU65/zebzWKq+btAIPAwDfACtttt8vv9e31h/X6frDYX4P8tGAzSYrHghlytVtx/2+v12P3BieXksUY+/0h34gFKS/xut8v9DIC9miPhdzodXaGfzCaZcvM8FF+P6Ce1O6ngz2azN4F+cvD7jnrAC5znMdUIvLnqbUVzVstJPa3hz/QBygV4bBmc2SbZYDDAJpmobeFcLgd4vAgRXDgc5kKr1Wpb6Pvi49Xfxstul2Yvu+PxOKYaMcc7JMDjQJPOjvAlk8mHo3fKsY/Dj/DJlE6nqVgs4ggfAjzgAY8AD3gEeMAjwAMeAf4U4O8BIQb+NyDEwH8HhBj4G0CIgb8GhAB4s8Xxgf1wBwyN4YnI8Nl4UQKGAHirzfme/fIDIBrDK5nMksw++AUUjeEf8S/ZtHMLGI3hlT5+Mr57XOlMWT+B9H/6A1c1rQ/ztPCSAAAAAElFTkSuQmCC";

    GM_addStyle(`
        #ec-gallery-overlay {
            display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start;
            gap: 5px; padding: 5px; position: fixed; top:0; left:0; width:100%; height:100%;
            background-color:rgba(0,0,0,0.95); z-index:10000; overflow:auto; box-sizing: border-box;
        }
        .ec-gallery-item {
            height: 250px; margin: 0; display: flex; align-items: center; justify-content: center;
            overflow: hidden; cursor: pointer; border: 3px solid transparent;
            box-sizing: border-box; transition: border-color 0.2s;
        }
        .ec-gallery-item:hover {
            border-color: #FF69B4;
        }
        .ec-gallery-item img {
            height: 100%; width: auto; max-width: none; object-fit: contain;
            transition: filter 0.2s, transform 0.2s ease;
        }
        .ec-gallery-item:hover img {
            filter: brightness(0.8);
            transform: scale(1.1);
        }

        #ec-fullscreen-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.95); z-index: 11000;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; touch-action: none; padding-bottom: 100px;
            box-sizing: border-box;
        }

        #ec-fullscreen-media {
            max-width: 100%; max-height: 100%; object-fit: contain;
            transition: transform 0.1s ease; touch-action: none; cursor: grab;
        }

        .ec-control-button {
            position: fixed; z-index: 12000; cursor: pointer; user-select: none;
            opacity: 0.95; background: transparent; border: none; padding: 0;
            transition: transform 0.1s ease, filter 0.1s ease;
        }
        .ec-control-button:hover { opacity: 1.0; filter: brightness(1.2); }
        .ec-prev-button { left: 0; top: 50%; transform: translateY(-50%); transform-origin: left center; }
        .ec-next-button { right: 0; top: 50%; transform: translateY(-50%); transform-origin: right center; }
        .ec-close-button { right: 0; top: 0; }
        .ec-prev-button:active, .ec-next-button:active { transform: translateY(-50%) scale(0.95); }

        #ec-indicator-container {
            position: fixed; top: 10px; left: 10px; background: rgba(0, 0, 0, 0.5); color: white;
            padding: 5px 10px; border-radius: 5px; font-size: 1.2rem; z-index: 13000;
            display: flex; align-items: center; gap: 8px;
        }
        #ec-slideshow-play {
            background: none; border: none; color: white; font-size: 1.1rem; cursor: pointer; padding: 0 5px;
        }
        #ec-slideshow-interval {
            background: rgba(255, 255, 255, 0.2); border: 1px solid #555; border-radius: 3px;
            color: white; width: 40px; text-align: center; font-size: 1rem;
        }
        #ec-slideshow-interval::-webkit-outer-spin-button, #ec-slideshow-interval::-webkit-inner-spin-button {
            -webkit-appearance: none; margin: 0;
        }
        #ec-slideshow-interval[type=number] { -moz-appearance: textfield; }

        #ec-thumb-strip {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 90px;
            background-color: rgba(0, 0, 0, 0.7); z-index: 11500; overflow-x: auto;
            overflow-y: hidden; white-space: nowrap; padding: 5px 0; box-sizing: border-box;
        }
        .ec-thumb-item {
            display: inline-block; height: 80px; width: auto; margin: 0 5px; cursor: pointer;
            border: 3px solid transparent; transition: border-color 0.2s; opacity: 0.6;
        }
        .ec-thumb-item:hover { opacity: 1.0; }
        .ec-thumb-item.active { border-color: #FF69B4; opacity: 1.0; }
    `);

    const slideshowStorageKey = 'ec-slideshow-interval';
    let galleryOverlay = null;
    let currentlyLoading = false;
    let loadedThumbnails = 0;
    const thumbnailBatchSize = 50;
    let savedScrollPos = 0;
    let observerDebounceTimer = null;

    const mediaItems = [];

    let fullscreenOverlay = null;
    let currentIndex = 0;
    let isHoveringMedia = false;
    let slideshowTimer = null;
    let slideshowInterval = parseInt(localStorage.getItem(slideshowStorageKey), 10) || 10;

    let scale = 1, translateX = 0, translateY = 0;
    let pointers = new Map();
    let initialDistance = null, initialScale = 1;

    function processArticle(article) {
        const anchor = article.querySelector("div.post-container > figure > a");
        if (!anchor) return null;

        if (mediaItems.some(item => item.fullUrl === anchor.href)) return null;

        const fullUrl = anchor.href;
        const thumbElement = anchor.querySelector('img');
        const thumbUrl = thumbElement ? thumbElement.src : '';
        const filenameLink = article.querySelector('a.filename-link');
        const originalFilename = filenameLink ? (filenameLink.getAttribute('download') || filenameLink.textContent) : fullUrl.split('/').pop().split('?')[0];

        if (/\.(webm|mp4)$/i.test(fullUrl)) {
            return { type: "video", fullUrl, thumbUrl, originalFilename };
        } else {
            return { type: "image", fullUrl, thumbUrl, originalFilename };
        }
    }

    function handleNewArticle(article) {
        const newItem = processArticle(article);
        if (newItem) {
            const newIndex = mediaItems.length;
            mediaItems.push(newItem);
            addThumbnailToGallery(newItem, newIndex);
            if (fullscreenOverlay) {
                updateIndicator(currentIndex);
            }
        }
    }

    function addThumbnailToGallery(item, index) {
        if (!galleryOverlay) return;

        if (galleryOverlay.querySelector(`img[src="${item.thumbUrl}"]`)) return;

        const container = GM_addElement(galleryOverlay, "div", { class: "ec-gallery-item" });
        GM_addElement(container, "img", { src: item.thumbUrl, loading: "lazy" });
        container.addEventListener("click", e => {
            openFullscreen(index);
            e.stopPropagation();
        });
    }

    function setupObserver() {
        const threadContainer = document.getElementById('thread-container');
        if (!threadContainer) return;

        const observer = new MutationObserver((mutationsList) => {
            const hasAddedNodes = mutationsList.some(m => m.addedNodes.length > 0);
            if (!hasAddedNodes) return;

            clearTimeout(observerDebounceTimer);
            observerDebounceTimer = setTimeout(() => {
                threadContainer.querySelectorAll('article.media:not(.reply-form):not(.editing)').forEach(handleNewArticle);
            }, 150);
        });
        observer.observe(threadContainer, { childList: true, subtree: true });
    }

    document.addEventListener("keydown", function(e) {
        if (e.altKey && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            e.stopPropagation();

            if (galleryOverlay) {
                if (galleryOverlay.style.display === "none") {
                    galleryOverlay.style.display = "flex";
                    galleryOverlay.scrollTop = savedScrollPos;
                } else {
                    savedScrollPos = galleryOverlay.scrollTop;
                    galleryOverlay.style.display = "none";
                }
            } else {
                openGallery();
            }
        }

        if (fullscreenOverlay) {
            if (e.key === "ArrowRight") { stopSlideshow(); showNextMedia(); }
            else if (e.key === "ArrowLeft") { stopSlideshow(); showPreviousMedia(); }
            else if (e.key.toLowerCase() === 's' && isHoveringMedia) { e.preventDefault(); saveCurrentMedia(); }
            else if (e.key === "Escape") { exitFullscreen(); }
        } else if (galleryOverlay && galleryOverlay.style.display !== 'none' && e.key === "Escape") {
            savedScrollPos = galleryOverlay.scrollTop;
            galleryOverlay.style.display = "none";
        }
    }, true);

    function loadThumbnails() {
        if (currentlyLoading || loadedThumbnails >= mediaItems.length) return;
        currentlyLoading = true;

        const end = Math.min(loadedThumbnails + thumbnailBatchSize, mediaItems.length);
        for (let i = loadedThumbnails; i < end; i++) {
            addThumbnailToGallery(mediaItems[i], i);
        }
        loadedThumbnails = end;
        currentlyLoading = false;
    }

    function openGallery() {
        if (!galleryOverlay) {
            galleryOverlay = GM_addElement(document.body, "div", { id: "ec-gallery-overlay" });
            loadThumbnails();

            galleryOverlay.addEventListener('scroll', () => {
                if (galleryOverlay.scrollTop + galleryOverlay.clientHeight >= galleryOverlay.scrollHeight - 500) {
                    loadThumbnails();
                }
            });

            galleryOverlay.addEventListener("click", (e) => {
                if (e.target === galleryOverlay) {
                    savedScrollPos = galleryOverlay.scrollTop;
                    galleryOverlay.style.display = "none";
                }
            });
        }
        galleryOverlay.style.display = "flex";
        galleryOverlay.scrollTop = 0;
        savedScrollPos = 0;
    }

    function openFullscreen(idx) {
        scale = 1; translateX = 0; translateY = 0;
        initialDistance = null; pointers.clear();

        fullscreenOverlay = GM_addElement(document.body, "div", { id: "ec-fullscreen-overlay" });
        fullscreenOverlay.addEventListener("click", e => {
            if (e.target === fullscreenOverlay) exitFullscreen();
        });

        createIconButton(base64Prev, "ec-control-button ec-prev-button", () => { stopSlideshow(); showPreviousMedia(); });
        createIconButton(base64Next, "ec-control-button ec-next-button", () => { stopSlideshow(); showNextMedia(); });
        createIconButton(base64Close, "ec-control-button ec-close-button", exitFullscreen);

        createSlideshowControls();
        createThumbStrip();
        displayFullscreenMedia(idx);
    }

    function createSlideshowControls() {
        const container = GM_addElement(document.body, "div", { id: "ec-indicator-container" });
        GM_addElement(container, "span", { id: "ec-fullscreen-indicator" });
        const playBtn = GM_addElement(container, "button", { id: "ec-slideshow-play", title: "Slideshow" });
        playBtn.innerHTML = '▶';
        const intervalInput = GM_addElement(container, "input", {
            id: "ec-slideshow-interval", type: 'number', min: '1', value: slideshowInterval, title: "Slideshow interval (seconds)"
        });

        playBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSlideshow(); });
        intervalInput.addEventListener('click', (e) => {
            e.stopPropagation();
            e.target.select();
        });
        intervalInput.addEventListener('input', (e) => {
            slideshowInterval = parseInt(e.target.value, 10) || 10;
            localStorage.setItem(slideshowStorageKey, slideshowInterval);
            if (slideshowTimer) {
                stopSlideshow();
                startSlideshow();
            }
        });
    }

    function createThumbStrip() {
        const thumbStrip = GM_addElement(document.body, 'div', { id: 'ec-thumb-strip' });
        mediaItems.forEach((item, idx) => {
            const thumbImg = GM_addElement(thumbStrip, 'img', {
                src: item.thumbUrl, class: 'ec-thumb-item', 'data-index': idx
            });
            thumbImg.addEventListener('click', () => {
                stopSlideshow();
                displayFullscreenMedia(idx);
            });
        });
    }

    function createIconButton(base64Data, className, onClick) {
        const btn = GM_addElement(document.body, "button", { class: className });
        btn.addEventListener("click", e => { e.stopPropagation(); onClick(); });
        GM_addElement(btn, "img", { src: base64Data });
        return btn;
    }

    function updateIndicator(idx) {
        const indicator = document.getElementById("ec-fullscreen-indicator");
        if (indicator) indicator.textContent = `${idx + 1} / ${mediaItems.length}`;
    }

    function exitFullscreen() {
        if (fullscreenOverlay) {
            stopSlideshow();
            fullscreenOverlay.remove();
            fullscreenOverlay = null;
            document.querySelectorAll('.ec-control-button, #ec-indicator-container, #ec-thumb-strip').forEach(el => el.remove());
        }
    }

    function displayFullscreenMedia(idx) {
        scale = 1; translateX = 0; translateY = 0;
        pointers.clear(); initialDistance = null; initialScale = 1;
        currentIndex = idx;

        updateIndicator(idx);
        document.getElementById('ec-thumb-strip')?.querySelector('.active')?.classList.remove('active');
        const newActiveThumb = document.querySelector(`.ec-thumb-item[data-index="${idx}"]`);
        if (newActiveThumb) {
            newActiveThumb.classList.add('active');
            newActiveThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        document.getElementById("ec-fullscreen-media")?.remove();
        const item = mediaItems[idx];
        let mediaEl;

        if (item.type === "video") {
            mediaEl = GM_addElement(fullscreenOverlay, "video", {
                id: "ec-fullscreen-media",
                controls: true, autoplay: true, loop: true, muted: true, src: item.fullUrl,
                title: item.originalFilename
            });
        } else {
            mediaEl = GM_addElement(fullscreenOverlay, "img", {
                id: "ec-fullscreen-media",
                src: item.fullUrl,
                title: item.originalFilename
            });
        }
        mediaEl.style.transform = `scale(1) translate(0px, 0px)`;
        mediaEl.addEventListener('mouseenter', () => isHoveringMedia = true);
        mediaEl.addEventListener('mouseleave', () => isHoveringMedia = false);
        setupPointerEvents(mediaEl);
    }

    function setupPointerEvents(mediaEl) {
        mediaEl.addEventListener("pointerdown", pointerDownHandler);
        mediaEl.addEventListener("pointermove", pointerMoveHandler);
        mediaEl.addEventListener("pointerup", pointerUpHandler);
        mediaEl.addEventListener("pointercancel", pointerUpHandler);
        mediaEl.addEventListener('wheel', e => {
            e.preventDefault();
            const scaleAmount = 0.1;
            scale *= (e.deltaY > 0) ? (1 - scaleAmount) : (1 + scaleAmount);
            mediaEl.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        });

        function pointerDownHandler(e) {
            mediaEl.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {
                const pts = Array.from(pointers.values());
                initialDistance = getDistance(pts[0], pts[1]);
                initialScale = scale;
            }
        }
        function pointerMoveHandler(e) {
            if (!pointers.has(e.pointerId)) return;
            const lastPos = pointers.get(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 1) {
                const deltaX = e.clientX - lastPos.x;
                const deltaY = e.clientY - lastPos.y;
                translateX += deltaX / scale;
                translateY += deltaY / scale;
            } else if (pointers.size === 2 && initialDistance) {
                const pts = Array.from(pointers.values());
                const currentDistance = getDistance(pts[0], pts[1]);
                scale = initialScale * (currentDistance / initialDistance);
            }
            mediaEl.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        }
        function pointerUpHandler(e) {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) initialDistance = null;
        }
        function getDistance(p1, p2) {
            return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }
    }

    function saveCurrentMedia() {
        const item = mediaItems[currentIndex];
        if (!item) return;

        const link = document.createElement('a');
        link.href = item.fullUrl;
        link.download = item.originalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function startSlideshow() {
        stopSlideshow();
        const playBtn = document.getElementById('ec-slideshow-play');
        if(playBtn) playBtn.innerHTML = '❚❚';
        slideshowTimer = setInterval(showNextMedia, slideshowInterval * 1000);
    }

    function stopSlideshow() {
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
            const playBtn = document.getElementById('ec-slideshow-play');
            if(playBtn) playBtn.innerHTML = '▶';
        }
    }

    function toggleSlideshow() {
        slideshowTimer ? stopSlideshow() : startSlideshow();
    }

    function showNextMedia() {
        const newIndex = (currentIndex + 1) % mediaItems.length;
        displayFullscreenMedia(newIndex);
    }
    function showPreviousMedia() {
        const newIndex = (currentIndex - 1 + mediaItems.length) % mediaItems.length;
        displayFullscreenMedia(newIndex);
    }

    // console.log("EasyChanGallery: Initializing...");
    document.querySelectorAll("article.media:not(.reply-form):not(.editing)").forEach(article => {
        const item = processArticle(article);
        if (item) mediaItems.push(item);
    });
    setupObserver();
    // console.log("EasyChanGallery: Ready. Found " + mediaItems.length + " media items.");

})();
