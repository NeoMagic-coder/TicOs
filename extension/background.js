// Service worker — tüm ağ çağrıları burada yapılır.
// host_permissions sayesinde MV3 service worker fetch'leri CORS'tan muaftır,
// böylece backend'in cors_origins listesine chrome-extension eklemeye gerek kalmaz.

const DEFAULTS = {
  backendUrl: "http://127.0.0.1:8000",
  apiKey: "",
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function headers(apiKey) {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) h["X-API-Key"] = apiKey;
  return h;
}

async function chat({ message, history, productContext }) {
  const { backendUrl, apiKey } = await getSettings();
  const base = backendUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/v1/chat`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      message,
      history: history || [],
      product_context: productContext || null,
    }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail?.message || body?.detail || JSON.stringify(body);
    } catch (_) {
      /* yanıt JSON değil */
    }
    throw new Error(detail);
  }
  return res.json();
}

async function health() {
  const { backendUrl } = await getSettings();
  const base = backendUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/health`, { method: "GET" });
  return res.ok;
}

// Popup'tan gelen mesajları yönlendir. async cevap için true döndürmek şart.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "chat") {
    chat(msg)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (msg?.type === "health") {
    health()
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});
