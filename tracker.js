/**
 * tracker.js — Casino Red24K
 *
 * Agregá este script al final de <body> en tu index.html:
 *
 *   <!-- Firebase SDK (antes del tracker) -->
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
 *   <script src="tracker.js"></script>
 */

(function () {

  /* ══════════════════════════════════════════════════════════
     ⚙️  MISMA config que en admin.html
  ══════════════════════════════════════════════════════════ */
  const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyATHqxIrazh_UXEFcXsY_-_39yBltl3AaY",
    authDomain:        "circo-d35a6.firebaseapp.com",
    projectId:         "circo-d35a6",
    storageBucket:     "circo-d35a6.firebasestorage.app",
    messagingSenderId: "539087483313",
    appId:             "1:539087483313:web:0a0bd61c7d504548d90d90",
    measurementId:     "G-94XB4BCS76"
  };
  /* ══════════════════════════════════════════════════════════ */

  // Init Firebase (evita duplicar si ya está inicializado)
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();

  // ── Session & visitor ────────────────────────────────────
  let sessionId = sessionStorage.getItem('r24k_sid');
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2,9) + Date.now().toString(36);
    sessionStorage.setItem('r24k_sid', sessionId);
  }

  const isNew = !localStorage.getItem('r24k_visited');
  if (isNew) localStorage.setItem('r24k_visited', '1');

  // ── Device / browser detection ───────────────────────────
  const ua = navigator.userAgent;

  function getBrowser() {
    if (/Edg\//.test(ua))                       return 'Edge';
    if (/OPR|Opera/.test(ua))                   return 'Opera';
    if (/Chrome/.test(ua))                      return 'Chrome';
    if (/Firefox/.test(ua))                     return 'Firefox';
    if (/Safari/.test(ua))                      return 'Safari';
    return 'Otro';
  }

  function getOS() {
    if (/Windows/.test(ua))                     return 'Windows';
    if (/Android/.test(ua))                     return 'Android';
    if (/iPhone|iPad/.test(ua))                 return 'iOS';
    if (/Mac/.test(ua))                         return 'macOS';
    if (/Linux/.test(ua))                       return 'Linux';
    return 'Otro';
  }

  function getDevice() {
    if (/Mobile|Android|iPhone|iPod/.test(ua))  return 'Mobile';
    if (/iPad|Tablet/.test(ua))                 return 'Tablet';
    return 'Desktop';
  }

  function getSource() {
    const params = new URLSearchParams(location.search);
    if (params.get('utm_source')) return params.get('utm_source');
    const ref = document.referrer;
    if (!ref)                                   return 'Directo';
    if (/google/.test(ref))                     return 'Google';
    if (/facebook|fb\.com/.test(ref))           return 'Facebook';
    if (/instagram/.test(ref))                  return 'Instagram';
    if (/tiktok/.test(ref))                     return 'TikTok';
    if (/twitter|x\.com/.test(ref))             return 'Twitter/X';
    if (/whatsapp/.test(ref))                   return 'WhatsApp';
    try { return new URL(ref).hostname; } catch { return 'Referido'; }
  }

  const params    = new URLSearchParams(location.search);
  const browser   = getBrowser();
  const os        = getOS();
  const device    = getDevice();
  const fuente    = getSource();
  const utmSource = params.get('utm_source')   || '';
  const utmMedium = params.get('utm_medium')   || '';
  const utmCampaign = params.get('utm_campaign') || '';

  // ── Timing & scroll tracking ─────────────────────────────
  const startTime = Date.now();
  let maxScroll   = 0;
  let pageTime    = 0;
  let visitDocId  = null;

  window.addEventListener('scroll', () => {
    const pct = ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;
    if (pct > maxScroll) maxScroll = pct;
  }, { passive: true });

  setInterval(() => pageTime++, 1000);

  // ── Geolocation (via free IP API) ────────────────────────
  let ciudad = 'Desconocido';
  fetch('https://ipapi.co/json/')
    .then(r => r.json())
    .then(d => { ciudad = d.city || 'Desconocido'; })
    .catch(() => {});

  // ── Record visit ─────────────────────────────────────────
  async function recordVisit() {
    try {
      const ref = await db.collection('visitas').add({
        timestamp:      firebase.firestore.FieldValue.serverTimestamp(),
        sessionId,
        ciudad,
        fuente,
        browser,
        os,
        dispositivo:    device,
        esNuevo:        isNew,
        tiempoEnPagina: 0,
        scrollDepth:    0,
        reboton:        true,
        utmSource,
        utmMedium,
        utmCampaign
      });
      visitDocId = ref.id;

      // Update engagement data when the user leaves
      window.addEventListener('beforeunload', () => {
        if (!visitDocId) return;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const bounced = elapsed < 15 && maxScroll < 30;
        // Use navigator.sendBeacon for reliable delivery on page close
        const payload = JSON.stringify({
          tiempoEnPagina: elapsed,
          scrollDepth:    maxScroll,
          reboton:        bounced
        });
        // Fallback: best-effort Firestore update
        db.collection('visitas').doc(visitDocId)
          .update({ tiempoEnPagina: elapsed, scrollDepth: maxScroll, reboton: bounced })
          .catch(() => {});
      });
    } catch (e) {
      console.warn('[tracker] error al registrar visita:', e);
    }
  }

  // ── Track WhatsApp click ─────────────────────────────────
  async function trackClick(numero) {
    try {
      await db.collection('clicks').add({
        timestamp:      firebase.firestore.FieldValue.serverTimestamp(),
        numero,
        sessionId,
        ciudad,
        fuente,
        browser,
        os,
        dispositivo:    device,
        tiempoEnPagina: Math.round((Date.now() - startTime) / 1000),
        scrollDepth:    maxScroll,
        utmSource,
        utmMedium,
        utmCampaign
      });
    } catch (e) {
      console.warn('[tracker] error al registrar click:', e);
    }
  }

  // ── Load active numbers & wire up buttons ────────────────
  async function setupNumbers() {
    try {
      const snap = await db.collection('numeros').where('activo', '==', true).get();
      if (snap.empty) return;

      const numeros = [];
      snap.forEach(doc => numeros.push(doc.data().numero));

      // Round-robin selection based on session count
      const idx    = parseInt(localStorage.getItem('r24k_vc') || '0');
      const numero = numeros[idx % numeros.length];
      localStorage.setItem('r24k_vc', idx + 1);

      const waUrl  = `https://wa.me/${numero}?text=Hola%2C%20me%20interesa%20el%20casino%20%F0%9F%8E%B0`;

      // Update all WhatsApp links
      document.querySelectorAll('a').forEach(a => {
        if (/wa\.me|whatsapp/.test(a.href)) {
          a.href = waUrl;
          a.addEventListener('click', () => trackClick(numero), { once: true });
        }
      });

      // Update onclick elements
      document.querySelectorAll('[onclick]').forEach(el => {
        const oc = el.getAttribute('onclick');
        if (/wa\.me|whatsapp/.test(oc)) {
          el.setAttribute('onclick', `window.open('${waUrl}','_blank')`);
          el.addEventListener('click', () => trackClick(numero), { once: true });
        }
      });

    } catch (e) {
      console.warn('[tracker] error al cargar números:', e);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────
  function init() {
    recordVisit();
    setupNumbers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
