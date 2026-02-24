(function () {
  const TWITCH_CHANNEL = 'jaymianlee';
  const CHECK_URL = `https://decapi.me/twitch/uptime/${TWITCH_CHANNEL}`;

  function isLikelyLive(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    if (!t) return false;
    if (t.includes('offline')) return false;
    if (t.includes('could not')) return false;
    if (t.includes('not live')) return false;
    return true;
  }

  function ensureIndicatorNode() {
    const footer = document.querySelector('footer');
    if (!footer) return null;

    let host = document.getElementById('twitch-live-indicator');
    if (host) return host;

    host = document.createElement('span');
    host.id = 'twitch-live-indicator';
    host.className = 'twitch-live-indicator is-unknown';
    host.innerHTML = '<span class="dot"></span><a href="https://twitch.tv/jaymianlee" target="_blank" rel="noopener">Twitch: status laden...</a>';
    footer.appendChild(host);
    return host;
  }

  async function update() {
    const node = ensureIndicatorNode();
    if (!node) return;

    try {
      const res = await fetch(CHECK_URL, { cache: 'no-store' });
      const txt = await res.text();
      const live = isLikelyLive(txt);

      node.classList.remove('is-unknown', 'is-live', 'is-offline');
      node.classList.add(live ? 'is-live' : 'is-offline');

      const label = live ? 'Twitch: JaymianLee is live' : 'Twitch: JaymianLee niet live';
      node.innerHTML = `<span class="dot"></span><a href="https://twitch.tv/jaymianlee" target="_blank" rel="noopener">${label}</a>`;
    } catch (_) {
      node.classList.remove('is-live', 'is-offline');
      node.classList.add('is-unknown');
      node.innerHTML = '<span class="dot"></span><a href="https://twitch.tv/jaymianlee" target="_blank" rel="noopener">Twitch: onbekend</a>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update, { once: true });
  } else {
    update();
  }
})();
