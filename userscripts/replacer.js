// ==UserScript==
// @name        4chanX String Replacement
// @namespace   https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/replacer.js
// @description Replaces strings in 4chan posts (compatible with 4chanX)
// @author      kpganon
// @include     /^https?://boards\.4chan(nel)?\.org/\w+/thread/\d+/
// @version     1.1
// @updateURL   https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/replacer.js
// @downloadURL https://raw.githubusercontent.com/kpg-anon/scripts/main/userscripts/replacer.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_download
// @grant       GM_xmlhttpRequest
// @run-at      document-end
// ==/UserScript==

(function() {
    function createMenu() {
        const menu = document.createElement('div');
        menu.id = 'wordReplacerMenu';
        menu.style.position = 'fixed';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.style.zIndex = '9999';
        menu.style.backgroundColor = '#282a36';
        menu.style.color = '#f8f8f2';
        menu.style.border = '1px solid #6272a4';
        menu.style.padding = '10px';
        menu.style.width = 'auto';
        menu.style.maxHeight = '800px';
        menu.style.overflowY = 'auto';
        menu.style.display = 'none';

        const rulesContainer = document.createElement('div');
        rulesContainer.id = 'rulesContainer';
        menu.appendChild(rulesContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '10px';
        menu.appendChild(buttonContainer);

        document.body.appendChild(menu);

        const addButton = document.createElement('button');
        addButton.textContent = 'Add Rule';
        addButton.addEventListener('click', () => addRuleRow());
        buttonContainer.appendChild(addButton);

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save and Apply';
        saveButton.addEventListener('click', saveRules);
        buttonContainer.appendChild(saveButton);

        const importButton = document.createElement('button');
        importButton.textContent = 'Import';
        importButton.addEventListener('click', importRules);
        buttonContainer.appendChild(importButton);

        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export';
        exportButton.addEventListener('click', exportRules);
        buttonContainer.appendChild(exportButton);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', toggleMenu);
        buttonContainer.appendChild(closeButton);
    }

    function addRuleRow(pattern = '', replacement = '') {
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.justifyContent = 'space-between';
        inputContainer.style.marginTop = '5px';

        const patternInput = document.createElement('input');
        patternInput.placeholder = 'Text/pattern to replace';
        patternInput.style.flex = '1';
        patternInput.style.marginRight = '10px';
        patternInput.style.maxWidth = '45%';
        patternInput.value = pattern;

        const replacementInput = document.createElement('input');
        replacementInput.placeholder = 'Replacement text';
        replacementInput.style.flex = '1';
        replacementInput.style.maxWidth = '45%';
        replacementInput.value = replacement;

        inputContainer.appendChild(patternInput);
        inputContainer.appendChild(replacementInput);

        const rulesContainer = document.getElementById('rulesContainer');
        rulesContainer.appendChild(inputContainer);
    }

    function saveRules() {
        const rulesContainer = document.getElementById('rulesContainer');
        const inputRows = Array.from(rulesContainer.children);
        const rules = inputRows.reduce((acc, row) => {
            const pattern = row.children[0].value;
            const replacement = row.children[1].value;
            if (pattern || replacement) {
                acc.push({ pattern, replacement });
            }
            return acc;
        }, []);
        GM_setValue('wordReplacerRules', JSON.stringify(rules));
    }

    function importRules() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = JSON.parse(e.target.result);
                    clearRules();
                    data.forEach(rule => {
                        addRuleRow(rule.pattern, rule.replacement);
                    });
                    if (data.length >= 4) {
                        addRuleRow();
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    function exportRules() {
        const savedRules = GM_getValue('wordReplacerRules');
        const blob = new Blob([savedRules], {type: "application/json"});
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${Date.now()}-replacer-config.json`;

        document.body.appendChild(a);
        a.click();

        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    function clearRules() {
        const rulesContainer = document.getElementById('rulesContainer');
        rulesContainer.innerHTML = '';
    }

    function loadRules() {
        clearRules();
        const savedRules = GM_getValue('wordReplacerRules');
        if (savedRules) {
            const rules = JSON.parse(savedRules);
            rules.forEach(rule => {
                addRuleRow(rule.pattern, rule.replacement);
            });
            if (rules.length >= 4) {
                addRuleRow();
            } else {
                for (let i = rules.length; i < 4; i++) {
                    addRuleRow();
                }
            }
        } else {
            for (let i = 0; i < 4; i++) {
                addRuleRow();
            }
        }
    }

    function toggleMenu() {
        const menu = document.getElementById('wordReplacerMenu');
        if (menu.style.display === 'none') {
            loadRules();
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    }

    function createToggleButton() {
        const button = document.createElement('button');
        button.textContent = 'Toggle Replacer';
        button.style.position = 'fixed';
        button.style.bottom = '10px';
        button.style.right = '10px';
        button.style.zIndex = '9998';
        button.style.backgroundColor = '#282a36';
        button.style.color = '#f8f8f2';
        button.style.border = '1px solid #6272a4';

        button.addEventListener('click', toggleMenu);

        document.body.appendChild(button);
    }

    createMenu();
    createToggleButton();

    function replaceTextInNode(node) {
    // Skip if the node is part of a hyperlink
    if (node.parentElement && node.parentElement.tagName === 'A') {
        return;
    }
        const savedRules = GM_getValue('wordReplacerRules');
        if (savedRules) {
            const rules = JSON.parse(savedRules);
            rules.forEach(rule => {
                if (rule.pattern) {
                    const pattern = new RegExp(rule.pattern, 'gi');
                    if (node.nodeType === 3) { // Only process text nodes
                        node.nodeValue = node.nodeValue.replace(pattern, rule.replacement);
                    }
                }
            });
        }
    }

    function replaceTextInPost(postElement) {
        // Process main post content
        Array.from(postElement.childNodes).forEach(replaceTextInNode);

        // Process greentext content
        let greentexts = postElement.querySelectorAll('.quote');
        greentexts.forEach(quoteElement => {
            Array.from(quoteElement.childNodes).forEach(replaceTextInNode);
        });
    }

    function processMutations(mutations) {
        for (let mutation of mutations) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        let postNodes = node.querySelectorAll('.postMessage');
                        if (postNodes.length > 0) {
                            postNodes.forEach(replaceTextInPost);
                        } else if (node.classList && node.classList.contains('postMessage')) {
                            replaceTextInPost(node);
                        }
                    }
                });
            }
        }
    }

    const observerConfig = {
        childList: true,
        subtree: true
    };

    const observer = new MutationObserver(processMutations);
    observer.observe(document.body, observerConfig);

    const posts = document.querySelectorAll('.postMessage');
    posts.forEach(replaceTextInPost);

    document.addEventListener('click', (e) => {
        if (e.target && e.target.innerText === 'Save and Apply') {
            setTimeout(() => {
                posts.forEach(replaceTextInPost);
            }, 500);
        }
    });
})();
