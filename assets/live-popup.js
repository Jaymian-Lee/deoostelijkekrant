(function () {
  const SESSION_KEY = 'krant_live_popup_shown_v1';
  const TWITCH_CHANNEL = 'jaymianlee';
  const TWITCH_URL = 'https://www.twitch.tv/jaymianlee';
  const CHECK_URL = `https://decapi.me/twitch/uptime/${TWITCH_CHANNEL}`;

  if (sessionStorage.getItem(SESSION_KEY) === '1') return;

  function isLikelyLive(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    if (!t) return false;
    if (t.includes('offline')) return false;
    if (t.includes('could not')) return false;
    if (t.includes('not live')) return false;
    return true;
  }

  function showPopup() {
    const wrap = document.createElement('div');
    wrap.className = 'live-popup';
    wrap.innerHTML = `
      <button class="live-popup-close" aria-label="Sluiten">×</button>
      <div class="live-popup-title">🔴 De krantman is nu live</div>
      <div class="live-popup-text">Bekijk de stream van JaymianLee op Twitch.</div>
      <a class="live-popup-cta" href="${TWITCH_URL}" target="_blank" rel="noopener">Nu kijken</a>
    `;

    wrap.querySelector('.live-popup-close')?.addEventListener('click', () => {
      sessionStorage.setItem(SESSION_KEY, '1');
      wrap.remove();
    });

    document.body.appendChild(wrap);
    sessionStorage.setItem(SESSION_KEY, '1');
  }

  async function checkLive() {
    try {
      const res = await fetch(CHECK_URL, { cache: 'no-store' });
      const txt = await res.text();
      if (isLikelyLive(txt)) showPopup();
    } catch (_) {
      // stil falen
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkLive, { once: true });
  } else {
    checkLive();
  }
})();
