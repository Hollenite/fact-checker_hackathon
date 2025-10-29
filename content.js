(function () {
  if (window.perplexityFactCheckerInjected) return;
  window.perplexityFactCheckerInjected = true;

  let factCheckBox = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "checkInjection":
        sendResponse({ injected: true });
        break;
      case "showLoading":
        showLoading();
        break;
      case "factCheckResult":
        showFactCheckResult(request.data);
        break;
      case "factCheckError":
        showError(request.error);
        break;
    }
  });

  function showLoading() {
    if (!factCheckBox) factCheckBox = createFactCheckBox();
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <div class="loading-section">
        <p>Analyzing your text...</p>
        <div class="progress-bar">
          <div class="progress"></div>
        </div>
        <p class="loading-tip">Fact-checking using Perplexity AI</p>
      </div>
      <div class="footer-badge glow">Fact Checker by Perplexity</div>
    `;
    factCheckBox.classList.add("show");
    addCloseButtonListener();
  }

  function showFactCheckResult(result) {
    if (!factCheckBox) factCheckBox = createFactCheckBox();
    const parsed = parseFactCheckResult(result);
    updateFactCheckBox(parsed);
  }

  function showError(message) {
    if (!factCheckBox) factCheckBox = createFactCheckBox();
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Error</h2>
        <button id="close-fact-check">×</button>
      </div>
      <div class="error-card">
        <p>${message}</p>
      </div>
      <div class="footer-badge glow">Fact Checker by Perplexity</div>
    `;
    factCheckBox.classList.add("show");
    addCloseButtonListener();
  }

  function createFactCheckBox() {
    const box = document.createElement("div");
    box.id = "perplexity-fact-check-box";
    document.body.appendChild(box);
    makeDraggableAndResizable(box);
    return box;
  }

  function updateFactCheckBox(result) {
    const truthColor = getTruthColor(result.truthPercentage);
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>

      <div class="card truth-card" style="border-left: 5px solid ${truthColor}">
        <h3>Truth Percentage</h3>
        <p class="truth-value" style="color:${truthColor}">${result.truthPercentage}</p>
      </div>

      <div class="card">
        <h4>Fact Check</h4>
        <p>${result.factCheck}</p>
      </div>

      <div class="card">
        <h4>Context</h4>
        <p>${result.context}</p>
      </div>

      <div class="card">
        <h4>Sources</h4>
        <ol>
          ${result.sources
            .map(
              (s) => `<li><a href="${s.url}" target="_blank">${s.title}</a></li>`
            )
            .join("")}
        </ol>
      </div>

      <button id="copy-result">Copy Result</button>
      <div class="footer-badge glow">Fact Checker by Perplexity</div>
    `;
    factCheckBox.classList.add("show");
    addCloseButtonListener();
    addCopyButtonListener(result);
  }

  // === Utility Functions ===

  function parseFactCheckResult(result) {
    const sections = result.split("\n\n");
    const parsed = {
      truthPercentage: "N/A",
      factCheck: "",
      context: "",
      sources: [],
    };
    let currentSection = "";

    sections.forEach((section) => {
      if (section.startsWith("Sources:")) {
        currentSection = "sources";
        const lines = section.split("\n").slice(1);
        lines.forEach((line) => {
          const match = line.match(/(\d+)\.\s+(.+)/);
          if (match) {
            const [, index, content] = match;
            const urlMatch = content.match(/\[(.+?)\]\((.+?)\)/);
            parsed.sources.push({
              index,
              title: urlMatch ? urlMatch[1] : content,
              url: urlMatch ? urlMatch[2] : "#",
            });
          }
        });
      } else if (section.startsWith("Truth:")) {
        parsed.truthPercentage = section.split(":")[1].trim();
      } else if (section.startsWith("Fact Check:")) {
        currentSection = "factCheck";
        parsed.factCheck = section.split(":").slice(1).join(":").trim();
      } else if (section.startsWith("Context:")) {
        currentSection = "context";
        parsed.context = section.split(":").slice(1).join(":").trim();
      } else if (currentSection === "factCheck") {
        parsed.factCheck += " " + section.trim();
      } else if (currentSection === "context") {
        parsed.context += " " + section.trim();
      }
    });

    parsed.factCheck = replaceSourceReferences(parsed.factCheck, parsed.sources);
    parsed.context = replaceSourceReferences(parsed.context, parsed.sources);
    return parsed;
  }

  function replaceSourceReferences(text, sources) {
    return text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_, p1) => {
      const indices = p1.split(",").map((s) => s.trim());
      return indices
        .map((i) => {
          const src = sources.find((s) => s.index === i);
          return src
            ? `<a href="${src.url}" target="_blank">[${i}]</a>`
            : `[${i}]`;
        })
        .join(", ");
    });
  }

  function getTruthColor(percent) {
    const val = parseInt(percent);
    if (isNaN(val)) return "#6b7280";
    if (val >= 80) return "#16a34a";
    if (val >= 60) return "#ca8a04";
    if (val >= 40) return "#f97316";
    return "#dc2626";
  }

  function addCopyButtonListener(result) {
    const btn = document.getElementById("copy-result");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const text = `
Truth: ${result.truthPercentage}
Fact Check: ${result.factCheck}
Context: ${result.context}
Sources:
${result.sources.map((s) => `${s.index}. ${s.title} - ${s.url}`).join("\n")}
      `;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy Result"), 2000);
      });
    });
  }

  function addCloseButtonListener() {
    const closeBtn = document.getElementById("close-fact-check");
    if (closeBtn) {
      closeBtn.onclick = () => (factCheckBox.style.display = "none");
    }
  }

  function isDarkMode() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function makeDraggableAndResizable(el) {
    let isDragging = false,
      startX,
      startY,
      startLeft,
      startTop;
    el.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.offsetLeft;
      startTop = el.offsetTop;
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      el.style.left = startLeft + dx + "px";
      el.style.top = startTop + dy + "px";
    });
    document.addEventListener("mouseup", () => (isDragging = false));
  }

  // === Inject Styles ===
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

    #perplexity-fact-check-box {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 360px;
      max-height: 85vh;
      overflow-y: auto;
      background: ${isDarkMode() ? "#1f2937" : "#ffffff"};
      color: ${isDarkMode() ? "#f3f4f6" : "#111827"};
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      font-family: 'Inter', sans-serif;
      z-index: 9999;
      opacity: 0;
      transform: translateY(-10px);
      animation: fadeSlideIn 0.4s ease forwards;
    }

    .fact-check-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    #close-fact-check {
      border: none;
      background: transparent;
      color: inherit;
      font-size: 20px;
      cursor: pointer;
      transition: transform 0.2s;
    }

    #close-fact-check:hover {
      transform: scale(1.2);
      color: #ef4444;
    }

    h2 {
      font-size: 20px;
      color: #38b2ac;
      text-align: center;
      width: 100%;
    }

    .card {
      background: ${isDarkMode() ? "#374151" : "#f9fafb"};
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
      animation: fadeSlideIn 0.5s ease forwards;
      transition: background 0.3s;
    }

    .card:hover {
      background: ${isDarkMode() ? "#4b5563" : "#f3f4f6"};
    }

    .truth-card {
      text-align: center;
    }

    .truth-value {
      font-size: 24px;
      font-weight: 700;
    }

    a {
      color: #38b2ac;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    #copy-result {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 10px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #319795, #38b2ac);
      color: #fff;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    #copy-result:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(56, 178, 172, 0.3);
    }

    .footer-badge {
      text-align: center;
      font-size: 12px;
      color: #38b2ac;
      margin-top: 10px;
      font-weight: 600;
    }

    .glow {
      animation: glowPulse 2s infinite;
    }

    @keyframes glowPulse {
      0% { text-shadow: 0 0 4px #38b2ac; }
      50% { text-shadow: 0 0 12px #38b2ac; }
      100% { text-shadow: 0 0 4px #38b2ac; }
    }

    .loading-section {
      text-align: center;
      margin-top: 20px;
    }

    .progress-bar {
      width: 80%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 10px;
      margin: 16px auto;
      overflow: hidden;
      position: relative;
    }

    .progress {
      width: 50%;
      height: 100%;
      background: linear-gradient(90deg, #319795, #38b2ac);
      animation: moveProgress 1.6s ease-in-out infinite;
    }

    @keyframes moveProgress {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0%); }
      100% { transform: translateX(100%); }
    }

    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
})();
