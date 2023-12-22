// ==UserScript==
// @name        Desuarchive Gallery
// @version     1.0
// @description Gallery mode for desuarchive.org threads
// @author      kpganon
// @namespace   https://github.com/kpg-anon/scripts
// @downloadURL https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/desugallery.user.js
// @updateURL   https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/desugallery.user.js
// @include     /^https?:\/\/desuarchive\.org\/.*\/thread\/.*$/
// @grant       none
// ==/UserScript==

(function () {
  'use strict';

  let mediaItems = [];
  let galleryView;
  let itemIndex = 0;
  let isActive = false;
  let currentThumbnail;

  const collectMediaItems = () => {
    const postWrappers = document.querySelectorAll('.post_wrapper');
    postWrappers.forEach((post) => {
      const postId = post.id;
      const mediaLink = post.querySelector('.thread_image_link');
      if (mediaLink) {
        const isWebm = mediaLink.href.endsWith('.webm');
        const thumbnail = post.querySelector('.thread_image_box img').src;
        const mediaItem = {
          url: mediaLink.href,
          isWebm,
          thumbnail,
          postId,
        };
        mediaItems.push(mediaItem);
      }
    });
  };

  const createGalleryView = () => {
    galleryView = document.createElement('div');
    galleryView.id = 'desu-gallery';
    galleryView.innerHTML = `
      <div id="thumbnail-sidebar"></div>
      <div class="gallery-controls">
        <button id="download-item">↓</button>
        <button id="prev-item">Previous</button>
        <button id="next-item">Next</button>
        <button id="close-gallery">×</button>
      </div>
      <div id="gallery-item-container"></div>
    `;
    galleryView.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.9);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
    `;
    const thumbnailSidebar = galleryView.querySelector('#thumbnail-sidebar');
    thumbnailSidebar.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 100px;
      overflow-y: scroll;
      z-index: 10001;
    `;
    mediaItems.forEach((item, index) => {
      const thumbnailElement = document.createElement('img');
      thumbnailElement.src = item.thumbnail;
      thumbnailElement.style.width = '100%';
      thumbnailElement.style.cursor = 'pointer';
      thumbnailElement.style.borderBottom = '3px solid black';
      thumbnailElement.id = `thumbnail-${index}`;
      thumbnailElement.addEventListener('click', () => {
        itemIndex = index;
        updateGalleryItem();
        document.getElementById(item.postId).scrollIntoView();
      });
      thumbnailSidebar.appendChild(thumbnailElement);
    });
    const galleryControls = galleryView.querySelector('.gallery-controls');
    galleryControls.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10000;
    `;
    document.querySelector('body').appendChild(galleryView);
    document.getElementById('download-item').addEventListener('click', () => {
      const currentItem = mediaItems[itemIndex];
      window.open(currentItem.url, '_blank');
    });
    document.getElementById('prev-item').addEventListener('click', showPrevItem);
    document.getElementById('next-item').addEventListener('click', showNextItem);
    document.getElementById('close-gallery').addEventListener('click', toggleGallery);
  };

  const showPrevItem = () => {
    if (itemIndex > 0) {
      itemIndex--;
      updateGalleryItem();
    }
  };

  const showNextItem = () => {
    if (itemIndex < mediaItems.length - 1) {
      itemIndex++;
      updateGalleryItem();
    }
  };

  const updateGalleryItem = () => {
    const itemContainer = document.getElementById('gallery-item-container');
    if (itemContainer === null) return;
    itemContainer.innerHTML = '';

    if (currentThumbnail) {
      currentThumbnail.style.border = 'none';
    }

    const currentItem = mediaItems[itemIndex];
    if (currentItem.isWebm) {
      const videoElement = document.createElement('video');
      videoElement.controls = true;
      videoElement.autoplay = true;
      videoElement.loop = true;
      videoElement.src = currentItem.url;
      videoElement.style.maxWidth = '100%';
      videoElement.style.maxHeight = '100vh';
      itemContainer.appendChild(videoElement);
    } else {
      const imgElement = document.createElement('img');
      imgElement.src = currentItem.url;
      imgElement.style.maxWidth = '100%';
      imgElement.style.maxHeight = '100vh';
      itemContainer.appendChild(imgElement);
    }
    currentThumbnail = document.getElementById(`thumbnail-${itemIndex}`);
    if (currentThumbnail) {
      currentThumbnail.style.border = '3px solid #39ff14';
      currentThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
    document.getElementById(currentItem.postId).scrollIntoView();
  };

  const toggleGallery = () => {
    if (isActive) {
      galleryView.style.display = 'none';
      isActive = false;
    } else {
      galleryView.style.display = 'flex';
      isActive = true;
      updateGalleryItem();
    }
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'g') {
      toggleGallery();
    }
  });

  collectMediaItems();
  createGalleryView();
})();
