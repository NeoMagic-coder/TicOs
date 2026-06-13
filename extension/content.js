// Pazaryeri ürün sayfalarından ürün bilgisini çıkarır.
// Popup "getProduct" mesajı gönderdiğinde mevcut sayfadaki ürünü döndürür.

function txt(sel) {
  const el = document.querySelector(sel);
  return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
}

function firstTxt(selectors) {
  for (const s of selectors) {
    const v = txt(s);
    if (v) return v;
  }
  return "";
}

function parsePrice(raw) {
  if (!raw) return null;
  // "1.299,90 TL" -> 1299.90
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function detectSource() {
  const h = location.hostname;
  if (h.includes("trendyol")) return "trendyol";
  if (h.includes("hepsiburada")) return "hepsiburada";
  if (h.includes("n11")) return "n11";
  if (h.includes("amazon")) return "amazon";
  return "web";
}

const SELECTORS = {
  trendyol: {
    name: ["h1.pr-new-br span", "h1.pr-new-br", "h1.product-name"],
    price: [".prc-dsc", ".product-price-container .prc-dsc", ".pr-bx-w .prc-slg"],
  },
  hepsiburada: {
    name: ["#product-name", "h1[data-test-id='title']", "h1.product-name"],
    price: ["#offering-price", "span[data-test-id='price-current-price']", ".price-value"],
  },
  n11: {
    name: ["h1.proName", "h1.unf-p-title"],
    price: ["div.priceContainer ins", ".newPrice ins", ".unf-p-summary-price .newPrice"],
  },
  amazon: {
    name: ["#productTitle", "#title"],
    price: [".a-price .a-offscreen", "#corePrice_feature_div .a-offscreen", "#priceblock_ourprice"],
  },
};

function extractProduct() {
  const source = detectSource();
  const conf = SELECTORS[source] || { name: ["h1"], price: [] };
  const name = firstTxt(conf.name) || document.title;
  const rawPrice = firstTxt(conf.price);
  const price = parsePrice(rawPrice);
  return {
    product_name: name,
    price,
    raw_price: rawPrice || null,
    currency: "TRY",
    url: location.href,
    source,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "getProduct") {
    try {
      sendResponse({ ok: true, product: extractProduct() });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return false;
  }
  return false;
});
