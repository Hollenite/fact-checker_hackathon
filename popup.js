// popup.js — dynamic popup that reacts to real background messages

document.addEventListener("DOMContentLoaded", () => {
  const loading = document.getElementById("loadingSection");
  const status = document.getElementById("statusMessage");
  const result = document.getElementById("resultSection");
  const error = document.getElementById("errorSection");

  // Reset UI
  function resetUI() {
    loading.classList.add("hidden");
    result.classList.add("hidden");
    error.classList.add("hidden");
    status.classList.remove("hidden");
  }

  // Listen for messages from background or content scripts
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "showLoading") {
      status.classList.add("hidden");
      result.classList.add("hidden");
      error.classList.add("hidden");
      loading.classList.remove("hidden");
    } else if (request.action === "factCheckResult") {
      loading.classList.add("hidden");
      result.classList.remove("hidden");
      status.classList.add("hidden");
    } else if (request.action === "factCheckError") {
      loading.classList.add("hidden");
      error.classList.remove("hidden");
      status.classList.add("hidden");
    }
  });

  // Ask background if a check is currently active
  chrome.runtime.sendMessage({ action: "popupOpened" }, (response) => {
    if (response && response.state === "checking") {
      loading.classList.remove("hidden");
      status.classList.add("hidden");
    } else {
      resetUI();
    }
  });
});
