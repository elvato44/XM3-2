/**
 * tracker.js — Casino Red24K
 * Agregá esto al final del <body> en index.html:
 *
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
 *   <script src="tracker.js"></script>
 */

(function () {

  const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyATHqxIrazh_UXEFcXsY_-_39yBltl3AaY",
    authDomain:        "circo-d35a6.firebaseapp.com",
    projectId:         "circo-d35a6",
    storageBucket:     "circo-d35a6.firebasestorage.app",
    messagingSenderId: "539087483313",
    appId:             "1:539087483313:web:0a0bd61c7d504548d90d90",
    measurementId:     "G-94XB4BCS76"
  };

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();

  // ── Session ──────────────────────────────────────────
  let sid = sessionStorage.getItem('r24k_sid');
  if (!sid) { sid = Math.random().toString(36).slice(2,9) + Date.now().toString(36); sessionStorage.setItem('r24k_sid', sid); }
  const isNew = !localStorage.getItem('r24k_visited');
  if (isNew) localStorage.setItem('r24k_visited', '1');

  // ── Device detection ─────────────────────────────────
  const ua = navigator.userAgent;
  const browser   = /Edg\//.test(ua)?'Edge':/OPR|Opera/.test(ua)?'Opera':/Chrome/.test(ua)?'Chrome':/Firefox/.test(ua)?'Firefox':/Safari/.test(ua)?'Safari':'Otro';
  const os        = /Windows/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Mac/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Otro';
  const device    = /Mobile|Android|iPhone|iPod/.test(ua)?'Mobile':/iPad|Tablet/.test(ua)?'Tablet':'Desktop';
  const params    = new URLSearchParams(location.search);
  const fuente    = params.get('utm_source') || (()=>{
    const r = document.referrer;
    if (!r) return 'Directo';
    if (/google/.test(r)) return 'Google';
    if (/facebook|fb\.com/.test(r)) return 'Facebook';
    if (/instagram/.test(r)) return 'Instagram';
    if (/tiktok/.test(r)) return 'TikTok';
    if (/twitter|x\.com/.test(r)) return 'Twitter/X';
    if (/whatsapp/.test(r)) return 'WhatsApp';
    try { return new URL(r).hostname; } catch { return 'Referido'; }
  })();
  const utmSource   = params.get('utm_source')   || '';
  const utmMedium   = params.get('utm_medium')   || '';
  const utmCampaign = params.get('utm_campaign') || '';

  // ── Timing & scroll ──────────────────────────────────
  const startTime = Date.now();
  let maxScroll = 0, pageTime = 0, visitDocId = null;
  window.addEventListener('scroll', () => {
    const pct = ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;
    if (pct > maxScroll) maxScroll = pct;
  }, { passive: true });
  setInterval(() => pageTime++, 1000);

  // ── Geolocation ──────────────────────────────────────
  let ciudad = 'Desconocido';
  fetch('https://ipapi.co/json/').then(r => r.json()).then(d => { ciudad = d.city || 'Desconocido'; }).catch(() => {});

  // ── Track click ──────────────────────────────────────
  let yaTrackeo = false; // evitar doble registro por el mismo clic
  async function trackClick(numero) {
    if (yaTrackeo) return;
    yaTrackeo = true;
    setTimeout(() => yaTrackeo = false, 2000);
    try {
      await db.collection('clicks').add({
        timestamp:      firebase.firestore.FieldValue.serverTimestamp(),
        numero:         numero || 'desconocido',
        sessionId:      sid,
        ciudad, fuente, browser, os,
        dispositivo:    device,
        tiempoEnPagina: Math.round((Date.now() - startTime) / 1000),
        scrollDepth:    maxScroll,
        utmSource, utmMedium, utmCampaign
      });
      console.log('[tracker] click registrado →', numero);
    } catch (e) { console.warn('[tracker] error click:', e); }
  }

  // ── Extraer número de una URL de WA ──────────────────
  function extractNum(str) {
    const m = str.match(/wa\.me\/(\d+)/);
    return m ? m[1] : null;
  }

  // ── Adjuntar listeners a todos los botones WA ────────
  function attachListeners(numero) {
    // 1. Links <a href="https://wa.me/...">
    document.querySelectorAll('a').forEach(el => {
      if (/wa\.me|whatsapp\.com\/send/.test(el.href || '')) {
        const num = numero || extractNum(el.href) || 'desconocido';
        if (numero) el.href = `https://wa.me/${numero}`;
        el.addEventListener('click', () => trackClick(num));
      }
    });

    // 2. Elementos con onclick que abren WA
    document.querySelectorAll('[onclick]').forEach(el => {
      const oc = el.getAttribute('onclick') || '';
      if (/wa\.me|whatsapp/.test(oc)) {
        const num = numero || extractNum(oc) || 'desconocido';
        if (numero) {
          const nuevoOnclick = oc.replace(/wa\.me\/\d+/, `wa.me/${numero}`);
          el.setAttribute('onclick', nuevoOnclick);
        }
        el.addEventListener('click', () => trackClick(num));
      }
    });

    // 3. Botones/divs con texto "WhatsApp" o imagen WA (por si acaso)
    document.querySelectorAll('button, .btn, [class*="whatsapp"], [class*="wp-btn"], [id*="whatsapp"]').forEach(el => {
      if (/whatsapp|wp/i.test(el.className + el.id + (el.textContent || ''))) {
        el.addEventListener('click', () => trackClick(numero || 'desconocido'));
      }
    });

    console.log('[tracker] listeners adjuntados, número:', numero || 'sin número de Firebase');
  }

  // ── Interceptar window.open para WA ──────────────────
  // (captura cualquier apertura de WhatsApp aunque no sea un <a>)
  const _open = window.open.bind(window);
  window.open = function(url, ...rest) {
    if (url && /wa\.me|whatsapp/.test(url)) {
      const num = extractNum(url) || 'desconocido';
      trackClick(num);
    }
    return _open(url, ...rest);
  };

  // ── Cargar números activos desde Firebase ────────────
  async function setupNumbers() {
    try {
      const snap = await db.collection('numeros').where('activo', '==', true).get();
      if (snap.empty) {
        // Sin números en Firebase → igual adjunta listeners con el número que ya tiene la página
        attachListeners(null);
        return;
      }
      const numeros = [];
      snap.forEach(doc => numeros.push(doc.data().numero));

      // Round-robin
      const idx    = parseInt(localStorage.getItem('r24k_vc') || '0');
      const numero = numeros[idx % numeros.length];
      localStorage.setItem('r24k_vc', idx + 1);

      attachListeners(numero);
    } catch (e) {
      console.warn('[tracker] error cargando números:', e);
      attachListeners(null); // igual intenta adjuntar
    }
  }

  // ── Registrar visita ─────────────────────────────────
  async function recordVisit() {
    try {
      const ref = await db.collection('visitas').add({
        timestamp:      firebase.firestore.FieldValue.serverTimestamp(),
        sessionId:      sid,
        ciudad, fuente, browser, os,
        dispositivo:    device,
        esNuevo:        isNew,
        tiempoEnPagina: 0,
        scrollDepth:    0,
        reboton:        true,
        utmSource, utmMedium, utmCampaign
      });
      visitDocId = ref.id;

      window.addEventListener('beforeunload', () => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        db.collection('visitas').doc(visitDocId)
          .update({ tiempoEnPagina: elapsed, scrollDepth: maxScroll, reboton: elapsed < 15 && maxScroll < 30 })
          .catch(() => {});
      });
      console.log('[tracker] visita registrada');
    } catch (e) { console.warn('[tracker] error visita:', e); }
  }

  // ── Bootstrap ─────────────────────────────────────────
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
