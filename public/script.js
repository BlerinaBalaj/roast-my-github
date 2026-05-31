// Analysis steps shown sequentially in the loading feed
const FEED_STEPS = [
  { icon: "🔍", text: "Fetching public repositories..." },
  { icon: "📊", text: "Counting stars (this won't take long)..." },
  { icon: "💀", text: "Cataloguing abandoned side projects..." },
  { icon: "🗑️", text: "Counting empty repositories..." },
  { icon: "🔬", text: "Analyzing language breakdown..." },
  { icon: "📝", text: "Checking for missing descriptions..." },
  { icon: "⏳", text: "Measuring years of inactivity..." },
  { icon: "🤡", text: "Identifying questionable architecture decisions..." },
  { icon: "📋", text: "Auditing README quality..." },
  { icon: "🧠", text: "Consulting the AI roast engine..." },
];

// ── DOM refs ──
const usernameInput  = document.getElementById("usernameInput");
const styleSelect    = document.getElementById("styleSelect");
const roastBtn       = document.getElementById("roastBtn");
const formSection    = document.getElementById("formSection");
const loadingSection = document.getElementById("loadingSection");
const loadingFeed    = document.getElementById("loadingFeed");
const loadingBar     = document.getElementById("loadingBar");
const errorSection   = document.getElementById("errorSection");
const errorMessage   = document.getElementById("errorMessage");
const tryAgainBtn    = document.getElementById("tryAgainBtn");
const resultSection  = document.getElementById("resultSection");
const roastUsername  = document.getElementById("roastUsername");
const roastBody      = document.getElementById("roastBody");
const roastAgainBtn  = document.getElementById("roastAgainBtn");
const statRepos      = document.getElementById("statRepos");
const statStars      = document.getElementById("statStars");
const statLang       = document.getElementById("statLang");
const statForks      = document.getElementById("statForks");

// ── State ──
let feedInterval = null;
let feedIndex = 0;

// ── Show / hide helpers ──
function showOnly(sectionEl) {
  [formSection, loadingSection, errorSection, resultSection].forEach((el) => {
    el.classList.toggle("hidden", el !== sectionEl);
  });
}

// ── Loading feed ──
function addFeedItem(step, state /* "active" | "done" */) {
  const el = document.createElement("div");
  el.className = `feed-item ${state}`;
  el.innerHTML = `<span class="feed-icon">${step.icon}</span><span>${step.text}</span>`;
  loadingFeed.appendChild(el);
  loadingFeed.scrollTop = loadingFeed.scrollHeight;
  return el;
}

function startLoadingFeed() {
  loadingFeed.innerHTML = "";
  feedIndex = 0;
  loadingBar.style.width = "0%";

  // Add first item immediately
  addFeedItem(FEED_STEPS[0], "active");
  loadingBar.style.width = "10%";
  feedIndex = 1;

  feedInterval = setInterval(() => {
    // Mark previous item as done
    const prev = loadingFeed.lastElementChild;
    if (prev) prev.classList.replace("active", "done");

    if (feedIndex < FEED_STEPS.length) {
      addFeedItem(FEED_STEPS[feedIndex], "active");
      const progress = Math.round(((feedIndex + 1) / FEED_STEPS.length) * 90);
      loadingBar.style.width = `${progress}%`;
      feedIndex++;
    }
  }, 1100);
}

function stopLoadingFeed() {
  if (feedInterval !== null) {
    clearInterval(feedInterval);
    feedInterval = null;
  }
  // Complete the bar and mark last item done
  loadingBar.style.width = "100%";
  const last = loadingFeed.lastElementChild;
  if (last) last.classList.replace("active", "done");
}

// ── Main roast handler ──
async function handleRoast() {
  const username = usernameInput.value.trim();

  if (!username) {
    usernameInput.focus();
    usernameInput.style.outline = "2px solid var(--red)";
    setTimeout(() => (usernameInput.style.outline = ""), 1500);
    return;
  }

  const style = styleSelect.value;

  showOnly(loadingSection);
  startLoadingFeed();

  try {
    const response = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, style }),
    });

    const data = await response.json();

    stopLoadingFeed();

    if (!response.ok) {
      showError(data.error || "Something went wrong. Please try again.");
      return;
    }

    displayResult(username, data);
  } catch (err) {
    stopLoadingFeed();
    showError("Network error — make sure the server is running.");
  }
}

// ── Display roast result ──
function displayResult(username, data) {
  roastUsername.textContent = username;
  roastBody.textContent = data.roast;

  const s = data.stats;
  statRepos.textContent = s.totalRepos.toLocaleString();
  statStars.textContent = s.totalStars.toLocaleString();
  statLang.textContent  = s.mostUsedLanguage;
  statForks.textContent = s.totalForks.toLocaleString();

  showOnly(resultSection);
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Display error ──
function showError(message) {
  errorMessage.textContent = message;
  showOnly(errorSection);
}

// ── Reset to form ──
function resetToForm() {
  showOnly(formSection);
  usernameInput.focus();
}

// ── Event listeners ──
roastBtn.addEventListener("click", handleRoast);
tryAgainBtn.addEventListener("click", resetToForm);
roastAgainBtn.addEventListener("click", resetToForm);

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleRoast();
});

usernameInput.addEventListener("input", () => {
  usernameInput.style.outline = "";
});

usernameInput.focus();
