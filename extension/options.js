const DEFAULTS = { backendUrl: "http://127.0.0.1:8000", apiKey: "" };

const backendUrl = document.getElementById("backendUrl");
const apiKey = document.getElementById("apiKey");
const saved = document.getElementById("saved");

chrome.storage.sync.get(DEFAULTS, (s) => {
  backendUrl.value = s.backendUrl;
  apiKey.value = s.apiKey;
});

document.getElementById("save").addEventListener("click", () => {
  const url = (backendUrl.value || DEFAULTS.backendUrl).trim().replace(/\/+$/, "");
  chrome.storage.sync.set({ backendUrl: url, apiKey: apiKey.value.trim() }, () => {
    saved.classList.add("show");
    setTimeout(() => saved.classList.remove("show"), 1500);
  });
});
