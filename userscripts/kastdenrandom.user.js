// ==UserScript==
// @name         Kastden Random Button
// @version      1.0
// @description  Randomly navigate through media on kastden
// @author       kpganon
// @namespace    https://github.com/kpg-anon/scripts
// @downloadURL  https://github.com/kpg-anon/scripts/raw/main/userscripts/kastdenrandom.user.js
// @updateURL    https://github.com/kpg-anon/scripts/raw/main/userscripts/kastdenrandom.user.js
// @match        *://selca.kastden.org/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_addElement
// ==/UserScript==

(function() {
    'use strict';

    const fetchMaxMediaId = async () => {
        let maxId = 0;
        const urls = ['https://selca.kastden.org/jpop/', 'https://selca.kastden.org/kpop/'];

        for (const url of urls) {
            await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    onload: function(response) {
                        const id = parseInt(response.responseText.match(/data-media_id="(\d+)"/)?.[1], 10);
                        if (id > maxId) maxId = id;
                        resolve();
                    }
                });
            });
        }
        return maxId;
    };

    const createRandomButton = (text, onclickFunction) => {
        const headerMiddle = document.querySelector('.header_middle .header_child:first-child');
        const a = document.createElement('a');
        a.href = "#";
        a.textContent = text;
        a.style.marginLeft = '10px';
        a.onclick = onclickFunction;
        headerMiddle.appendChild(a);
        return a;
    };

    const insertRandomButton = (maxId) => {
        const button = createRandomButton('random', function(e) {
            e.preventDefault();
            const randomId = Math.floor(Math.random() * maxId) + 1;
            window.location.href = 'https://selca.kastden.org/media/' + randomId;
        });
    };

    const insertMediaPageButton = () => {
        const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABGCAYAAAB8MJLDAAAACXBIWXMAAC4jAAAuIwF4pT92AAAGMWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjAgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyNC0wNC0yMlQxODo1MTo0My0wNDowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjQtMDQtMjJUMTg6NTM6MDYtMDQ6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDQtMjJUMTg6NTM6MDYtMDQ6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjUwMzJlZTk3LTRiMjItZTI0MS1hNTFjLTkxNTY1ZGQwMTViZCIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjI4ZTRiOWIxLTllMzgtZGU0ZS1iMzhjLTY1ZTY2ZjY1NDNhZiIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOmRmYWZlYzYxLTY2NWItNjc0ZS04OTM4LWZjMWM3MjMwOGRmMyI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ZGZhZmVjNjEtNjY1Yi02NzRlLTg5MzgtZmMxYzcyMzA4ZGYzIiBzdEV2dDp3aGVuPSIyMDI0LTA0LTIyVDE4OjUxOjQzLTA0OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjUuMCAoV2luZG93cykiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNvbnZlcnRlZCIgc3RFdnQ6cGFyYW1ldGVycz0iZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL3BuZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6NTAzMmVlOTctNGIyMi1lMjQxLWE1MWMtOTE1NjVkZDAxNWJkIiBzdEV2dDp3aGVuPSIyMDI0LTA0LTIyVDE4OjUzOjA2LTA0OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjUuMCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+NxwgSAAAA95JREFUeNrdnOuRrCAQhQnBECaECcEQDMEQDMEMDMEQDIEQDMEQDOHsH9jLsoNCP8C9VFm1tTXjwCenH0BrAJiKVwdgBrDjd7MAJveZan2qOfgJwIn7dgAY/ycAfeKJ3zXrvvtnAbwAbOC3VVMWmjqXbKe75+MBjE7DWu0AMDwRQO80W6tZJ7HmADqn0VZt4doHzuDnTLem3U7nYqsBGAR1LmkvdorbLHVrVsCljR/027n/7wIgthL7kKvzRcCF5Wp1EZJF1m9Kha8SAw+vXVBiIwVAz+zEfjHNZ3dddUzapVoA7xwAEuHrWjCTUtZbK5j6FVbHURzXrX0a0FWcMCeMrbbbHGMAg/SNMwaPhAz6SvFDHwJYBG/s/fGU8dmUu9oqAJhDABPatFRCVSPCHEMAXeVk5pMEYs/jMz+NDHMJbcA7WI/rldPZ1FS0N7l/J5R7WAfVr0u+Y5dzBPptkejcZXdUW+UDong2HeYmcFgqAzgSCQ1VBn42DSmJm4wn8m5gH/wD4Cy0bO77650Vzs23W9gHqhsecm2GIUzPVvYhNxArkothTM/1QYO/1Lk0gNA+9GgTP4Q6Zz0MIzDtJuFlspJwmx0bGKEOHVIdytS5GHAj3EFN+zBrSM4oPSlJ+7ApQs0GYF1Hzor2Ya8hK1Mw/cLFE6toHzg6P13fDk0AYfp6CNsHqs5tlENkp/ccANQ9A59f+HDVBzEUnaeSp+xlvhIbEHa2+5CtlU7VIepsqc7Xm9S5lwSQSjO5EDp3lQ4+5wyRKoDwKXAWLEaUrUfGM8eDn6mzUiIOGCObUGIYvXfIbeHg39FvxXsSWy0A8SyYFAH0FzYjhJO9uaIB4KUMYLiwJ8X7ClwANmGJtQCkFmNmEHeWqAB8fJ6ywFoAUrEA1QaRAOSc16sJoGd4IRKAu3M4U0UAC5i7yhQAqYOKL0IoywEQG76lFgBPvgN/X5EDIJairQkgzPdHpn6pAF4QOMRFNYIHZBoHAPcQ1/dNdqIRlFip4QA4or9Jq06UwxGkhQclL3AGOQClH5MhpKOxG5wbAYjXAywBXkfJ5YeHAOCeLfxxRCbnRFfKDf5FAN8JnGE8Ta+/1gBK3eCP+EGz2OlpbnDDh2N5GuVuLdzgpau7yl8kCx5buMFcF8kumODWDNQGsCDzmD6lGNI+GIBFYTUZp0zueBCAA8R6Qm7ZHDcfkAiFWRWlUqWyawMAKwRqiiXLZikHKikALK4XZJsXT5ec0ysBcEDhvQLab4o4BQB4nauU0Gu/POEurL4DsEGoSBqNX6GRCqtTAC7D178I4JN9OPHvpMipqfOr6wvQL0YUwWr9ewAAAABJRU5ErkJggg==";
        const frame = document.getElementById('cover_media_frame');
        const button = GM_addElement(frame, 'img', {
            src: base64Image,
            style: 'position: absolute; bottom: 10px; right: 10px; cursor: pointer;',
            class: 'random-media-button'
        });
        button.addEventListener('click', async () => {
            const maxId = await fetchMaxMediaId();
            const randomId = Math.floor(Math.random() * maxId) + 1;
            window.location.href = 'https://selca.kastden.org/media/' + randomId;
        });
    };

    if (window.location.pathname.includes('/media/')) {
        insertMediaPageButton();
    } else {
        const button = createRandomButton('random', async (e) => {
            e.preventDefault();
            const maxId = await fetchMaxMediaId();
            button.onclick = function(event) {
                event.preventDefault();
                const randomId = Math.floor(Math.random() * maxId) + 1;
                window.location.href = 'https://selca.kastden.org/media/' + randomId;
            };
        });
    }
})();
