(function () {
  const SESSION_KEY = 'krant_live_popup_last_stream_v2';
  const TWITCH_CHANNEL = 'jaymianlee';
  const TWITCH_URL = 'https://www.twitch.tv/jaymianlee';
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

  function normalizeLiveFingerprint(text) {
    return String(text || '').trim().toLowerCase();
  }

  function showPopup(streamFingerprint) {
    const wrap = document.createElement('div');
    wrap.className = 'live-popup';
    wrap.innerHTML = `
      <button class="live-popup-close" aria-label="Sluiten">×</button>
      <div class="live-popup-title">🔴 De krantman is nu live</div>
      <div class="live-popup-text">Bekijk de stream van JaymianLee op Twitch.</div>
      <a class="live-popup-cta" href="${TWITCH_URL}" target="_blank" rel="noopener">Nu kijken</a>
    `;

    const markShown = () => sessionStorage.setItem(SESSION_KEY, streamFingerprint);

    wrap.querySelector('.live-popup-close')?.addEventListener('click', () => {
      markShown();
      wrap.remove();
    });

    document.body.appendChild(wrap);
    markShown();
  }

  async function checkLive() {
    try {
      const res = await fetch(CHECK_URL, { cache: 'no-store' });
      const txt = await res.text();
      if (!isLikelyLive(txt)) return;

      const fingerprint = normalizeLiveFingerprint(txt);
      const lastShownFor = sessionStorage.getItem(SESSION_KEY);

      // Toon opnieuw bij nieuwe livestream (nieuwe uptime/fingerprint), ook op dezelfde dag.
      if (lastShownFor === fingerprint) return;
      showPopup(fingerprint);
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
