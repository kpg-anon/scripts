// ==UserScript==
// @name         Desuarchive Infinite Scroll
// @downloadURL  https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/desuinfinitescroll.user.js
// @version      1.0
// @description  Adds infinite scrolling with media preview on hover and download functionality to all search results pages on Desuarchive. Press 'S' while hovering over a thumbnail to download that file with the original filename.
// @author       kpganon
// @match        https://desuarchive.org/*/search/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .paginate, .backlink_container, #footer { display: none !important; }
        #hover-preview {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 100;
            pointer-events: none;
            max-width: 100vw;
            max-height: 100vh;
        }
        #hover-preview img,
        #hover-preview video {
            width: auto;
            height: auto;
            max-width: 100vw;
            max-height: 100vh;
            object-fit: contain;
        }
    `);

    const preview = document.createElement('div');
    preview.id = 'hover-preview';
    document.body.appendChild(preview);

    let hoveredMediaLink = null;
    let hoveredMediaFilename = null;

    function attachHoverPreviewAndDownload() {
        document.querySelectorAll('.post_wrapper .thread_image_link').forEach(anchor => {
            anchor.addEventListener('mouseover', function() {
                const href = this.href;
                const isVideo = href.endsWith('.webm') || href.endsWith('.mp4');

                preview.innerHTML = '';

                const media = isVideo ? document.createElement('video') : document.createElement('img');
                media.src = href;
                if (isVideo) {
                    media.autoplay = true;
                    media.loop = true;
                    media.muted = true;
                }
                preview.appendChild(media);
                preview.style.display = 'block';

                const filenameLink = this.closest('.post_wrapper').querySelector('.post_file_filename');
                hoveredMediaLink = href;
                hoveredMediaFilename = filenameLink ? filenameLink.getAttribute('title') : getFilenameFromUrl(hoveredMediaLink);
            });

            anchor.addEventListener('mouseout', function() {
                preview.innerHTML = '';
                preview.style.display = 'none';

                hoveredMediaLink = null;
                hoveredMediaFilename = null;
            });
        });
    }

    function getFilenameFromUrl(url) {
        return url.split('/').pop();
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 's' && hoveredMediaLink && !/input|textarea/i.test(document.activeElement.tagName)) {
            e.preventDefault();

            GM_xmlhttpRequest({
                method: 'GET',
                url: hoveredMediaLink,
                responseType: 'blob',
                onload: function(response) {
                    const blobUrl = URL.createObjectURL(response.response);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = blobUrl;
                    downloadLink.download = hoveredMediaFilename || 'download';
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(blobUrl);
                },
                onerror: function() {
                    alert('Download failed.');
                }
            });
        }
    });

    var currentPageNumber = getCurrentPageNumber();
    var loading = false;

    function getCurrentPageNumber() {
        var matches = window.location.pathname.match(/page\/(\d+)/);
        return matches ? parseInt(matches[1], 10) : 1;
    }

    function constructNextPageUrl(currentPageNumber) {
        var basePath = window.location.pathname.replace(/page\/\d+\/?$/, '');
        return window.location.origin + basePath + 'page/' + (currentPageNumber + 1) + '/';
    }

    function loadMoreContent() {
        if(loading) return;
        loading = true;

        var nextPageUrl = constructNextPageUrl(currentPageNumber);

        $.ajax({
            url: nextPageUrl,
            type: 'GET',
            success: function(response) {
                var $response = $(response);
                $response.find('article.backlink_container, section.section_title, h3.section_title, div.paginate, footer#footer').remove();

                var newContent = $response.find('.thread').parent();
                $('.thread').last().parent().append(newContent.html());

                attachHoverPreviewAndDownload();

                currentPageNumber++;
                loading = false;
            }
        });
    }

    $(window).scroll(function() {
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100 && !loading) {
            loadMoreContent();
        }
    });

    attachHoverPreviewAndDownload();
})();
