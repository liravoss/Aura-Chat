// server/src/services/translator.js
// Robust translator: tries multiple free LibreTranslate mirrors, rejects HTML pages,
// falls back to Google unofficial endpoint, and caches results.
//
// No API key required for the used endpoints.
//
// Replace existing translator.js with this and restart server.

const axios = require('axios');
const crypto = require('crypto');

const MIRRORS = [
  'https://translate.terraprint.co/translate',
  'https://libretranslate.de/translate',
  'https://translate.argosopentech.com/translate',
  'https://libretranslate.com/translate'
];

// fallback to Google unofficial translate (no API key). Reliable for small usage.
const GOOGLE_FALLBACK = true;

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const cache = new Map();

function makeKey(text, source, target) {
  return crypto.createHash('sha1').update(`${text}|${source}|${target}`).digest('hex');
}

async function postJson(url, payload, timeout = 8000) {
  return axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout,
    validateStatus: status => status >= 200 && status < 500 // let 4xx through to inspect
  });
}

async function tryMirror(url, payload) {
  try {
    const resp = await postJson(url, payload);
    const contentType = (resp.headers['content-type'] || '').toLowerCase();
    // If server returned HTML (website page) — treat as failure for API
    if (contentType.includes('text/html')) {
      throw new Error(`mirror returned HTML (likely web UI) at ${url}`);
    }
    return resp;
  } catch (err) {
    throw err;
  }
}

async function googleTranslate(text, source, target) {
  try {
    // Google unofficial endpoint returns nested arrays; source 'auto' is acceptable as 'auto'
    const sl = source === 'auto' ? 'auto' : source;
    const tl = target;
    const q = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${q}`;
    const resp = await axios.get(url, { timeout: 8000 });
    const data = resp.data;
    // data is nested arrays: data[0][0][0] is the translated text
    if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
      const translated = data[0][0][0];
      if (typeof translated === 'string' && translated.trim().length) {
        console.info(`[translate][google] ${source}->${target} "${text.slice(0,40)}" => "${translated.slice(0,40)}"`);
        return translated;
      }
    }
    // fallback: try to flatten strings
    if (typeof data === 'string') return data;
    return null;
  } catch (err) {
    // network or 4xx/5xx
    return null;
  }
}

/**
 * Translate text from source -> target.
 * Returns original text on failure.
 */
async function translateText(text, source = 'auto', target = 'en') {
  try {
    if (!text) return '';
    source = (source || 'auto').toLowerCase();
    target = (target || 'en').toLowerCase();
    if (!target || (source !== 'auto' && source === target)) return text;

    const key = makeKey(text, source, target);
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      // cache hit
      return cached.text;
    }

    const payload = { q: text, source: source || 'auto', target, format: 'text' };

    let lastError = null;

    for (const url of MIRRORS) {
      try {
        const resp = await tryMirror(url, payload);
        const data = resp.data;

        // handle multiple shapes:
        // A) { translatedText: "..." }
        if (data && typeof data === 'object' && data.translatedText) {
          cache.set(key, { text: data.translatedText, ts: Date.now() });
          console.info(`[translate] success ${url} ${source}->${target} "${text.slice(0,60)}" => "${String(data.translatedText).slice(0,60)}"`);
          return data.translatedText;
        }

        // B) plain string
        if (typeof data === 'string' && data.trim()) {
          cache.set(key, { text: data, ts: Date.now() });
          console.info(`[translate] success ${url} (string) ${source}->${target} "${text.slice(0,60)}"`);
          return data;
        }

        // C) array style [ { translatedText: '...' } ] or google-like nested
        if (Array.isArray(data)) {
          // try first object
          if (data[0] && data[0].translatedText) {
            cache.set(key, { text: data[0].translatedText, ts: Date.now() });
            console.info(`[translate] success ${url} array-> ${source}->${target}`);
            return data[0].translatedText;
          }
          // try google-like nested arrays: data[0][0][0]
          try {
            if (Array.isArray(data[0]) && Array.isArray(data[0][0]) && typeof data[0][0][0] === 'string') {
              const t = data[0][0][0];
              cache.set(key, { text: t, ts: Date.now() });
              console.info(`[translate] success ${url} nested-> ${source}->${target}`);
              return t;
            }
          } catch (e) { /* ignore */ }
        }

        // D) { result: { translatedText: "..." } }
        if (data && data.result && data.result.translatedText) {
          cache.set(key, { text: data.result.translatedText, ts: Date.now() });
          console.info(`[translate] success ${url} result-> ${source}->${target}`);
          return data.result.translatedText;
        }

        // if we reach here, the mirror response didn't contain a recognized translation
        lastError = `unexpected response shape from ${url}`;
        console.warn('[translate] unexpected response shape from', url, data && typeof data === 'object' ? JSON.stringify(data).slice(0,200) : String(data).slice(0,200));
        // try next mirror
      } catch (err) {
        lastError = err?.message || String(err);
        console.warn(`[translate] mirror ${url} failed:`, lastError);
        // try next mirror
      }
    }

    // All mirrors failed — try Google fallback if enabled
    if (GOOGLE_FALLBACK) {
      const g = await googleTranslate(text, source, target);
      if (g) {
        cache.set(key, { text: g, ts: Date.now() });
        return g;
      }
    }

    console.warn(`[translate] all mirrors failed. returning original text. lastError=${lastError}`);
    return text;
  } catch (e) {
    console.error('[translate] fatal error', e?.message || e);
    return text;
  }
}

module.exports = { translateText };
