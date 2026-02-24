(() => {
  const DATA_URL = '/data/ncsmp-players.json';
  const IMG_SIZE = 18;
  const SKIP_SELECTOR = [
    'script', 'style', 'noscript', 'textarea', 'code', 'pre',
    '.jay-link', '.mc-name-inline', '.social-links', '.mobile-menu-panel'
  ].join(',');

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function collectNames(data) {
    const all = new Set();

    if (Array.isArray(data?.allPlayersSorted)) {
      for (const n of data.allPlayersSorted) {
        if (typeof n === 'string' && n.length) all.add(n);
      }
    }

    if (data?.teams && typeof data.teams === 'object') {
      for (const arr of Object.values(data.teams)) {
        if (!Array.isArray(arr)) continue;
        for (const n of arr) {
          if (typeof n === 'string' && n.length) all.add(n);
        }
      }
    }

    // Keep practical username shape and avoid absurd regex growth.
    return [...all]
      .filter((n) => /^[A-Za-z0-9_]{2,16}$/.test(n))
      .sort((a, b) => b.length - a.length);
  }

  function buildRegex(names) {
    if (!names.length) return null;
    const parts = names.map(escapeRegex);
    // Boundaries without lookbehind for broad browser support.
    return new RegExp(`(^|[^A-Za-z0-9_])(${parts.join('|')})(?=$|[^A-Za-z0-9_])`, 'g');
  }

  function makeInlineHead(name) {
    const wrap = document.createElement('span');
    wrap.className = 'mc-name-inline';
    wrap.setAttribute('data-mc-name', name);

    const img = document.createElement('img');
    img.src = `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${IMG_SIZE * 2}`;
    img.alt = `Minecraft hoofd van ${name}`;
    img.width = IMG_SIZE;
    img.height = IMG_SIZE;
    img.loading = 'lazy';

    const txt = document.createElement('span');
    txt.textContent = name;

    wrap.appendChild(img);
    wrap.appendChild(txt);
    return wrap;
  }

  function processTextNode(node, regex) {
    const text = node.nodeValue;
    if (!text || text.length < 2) return;

    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    let m;

    while ((m = regex.exec(text)) !== null) {
      const full = m[0];
      const lead = m[1] || '';
      const name = m[2];
      const fullIndex = m.index;
      const nameIndex = fullIndex + lead.length;

      if (nameIndex > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, nameIndex)));
      }

      frag.appendChild(makeInlineHead(name));
      cursor = nameIndex + name.length;

      if (regex.lastIndex === m.index) regex.lastIndex++;
    }

    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }

    node.parentNode.replaceChild(frag, node);
  }

  function scan(root, regex) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    for (const n of nodes) processTextNode(n, regex);
  }

  async function init() {
    try {
      const r = await fetch(DATA_URL);
      if (!r.ok) return;
      const data = await r.json();
      const names = collectNames(data);
      const regex = buildRegex(names);
      if (!regex) return;

      scan(document.body, regex);

      const observer = new MutationObserver((mutations) => {
        for (const mt of mutations) {
          for (const node of mt.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches && node.matches(SKIP_SELECTOR)) continue;
            scan(node, regex);
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    } catch {
      // Fail silently; content remains readable.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
