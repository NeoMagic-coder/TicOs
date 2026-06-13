// Popup mantığı: ürün algılama, backend durumu ve sohbet.

const $ = (id) => document.getElementById(id);

const els = {
  statusDot: $("status-dot"),
  statusText: $("status-text"),
  productCard: $("product-card"),
  productName: $("product-name"),
  productSource: $("product-source"),
  productPrice: $("product-price"),
  message: $("message"),
  send: $("send"),
  result: $("result"),
  resultBody: $("result-body"),
  resultFoot: $("result-foot"),
  confidence: $("confidence"),
  degraded: $("degraded"),
  loading: $("loading"),
  openOptions: $("open-options"),
};

let currentProduct = null;

function send(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (resp) => resolve(resp));
  });
}

async function checkHealth() {
  const resp = await send("health");
  if (resp?.ok) {
    els.statusDot.className = "dot ok";
    els.statusText.textContent = "bağlı";
  } else {
    els.statusDot.className = "dot bad";
    els.statusText.textContent = "backend yok";
  }
}

async function detectProduct() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "getProduct" }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) return; // içerik scripti yok = pazaryeri dışı
      const p = resp.product;
      if (!p?.product_name) return;
      currentProduct = p;
      els.productName.textContent = p.product_name;
      els.productSource.textContent = p.source || "web";
      els.productPrice.textContent = p.raw_price || (p.price != null ? `${p.price} ₺` : "");
      els.productCard.classList.remove("hidden");
    });
  } catch (_) {
    /* sekme erişilemez */
  }
}

function setLoading(on) {
  els.loading.classList.toggle("hidden", !on);
  els.send.disabled = on;
}

function renderError(msg) {
  els.result.classList.remove("hidden");
  els.confidence.classList.add("hidden");
  els.degraded.classList.add("hidden");
  els.resultBody.textContent = "İstek başarısız oldu.";
  els.resultFoot.className = "result-foot error";
  els.resultFoot.textContent = msg;
}

function renderResult(data) {
  els.result.classList.remove("hidden");
  els.resultFoot.className = "result-foot";

  els.confidence.classList.remove("hidden");
  const pct = Math.round((data.confidence ?? 0) * 100);
  els.confidence.textContent = `güven %${pct}`;

  els.degraded.classList.toggle("hidden", !data.llm_degraded);

  els.resultBody.textContent = data.content || "(boş yanıt)";

  const tools = data.tools_used || [];
  els.resultFoot.innerHTML = "";
  if (tools.length) {
    for (const t of tools) {
      const span = document.createElement("span");
      span.className = "tool";
      span.textContent = t;
      els.resultFoot.appendChild(span);
    }
  } else {
    els.resultFoot.textContent = "araç kullanılmadı";
  }
}

async function ask(message) {
  if (!message.trim()) return;
  setLoading(true);
  els.result.classList.add("hidden");
  const resp = await send("chat", {
    message,
    productContext: currentProduct,
  });
  setLoading(false);
  if (resp?.ok) {
    renderResult(resp.data);
  } else {
    renderError(resp?.error || "Bilinmeyen hata");
  }
}

// Olaylar
els.send.addEventListener("click", () => ask(els.message.value));
els.message.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    ask(els.message.value);
  }
});
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.dataset.prompt;
    els.message.value = prompt;
    ask(prompt);
  });
});
els.openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Başlangıç
checkHealth();
detectProduct();
