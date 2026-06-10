const fortuneMessages = [
  "오늘도 좋은 밥이 찾아올 거야",
  "따뜻한 반찬처럼 마음도 든든해질 거야",
  "맛있는 한 끼가 하루를 편하게 만들 거야",
  "작은 행복이 점심시간에 찾아올 거야",
  "든든히 먹고 천천히 빛나면 돼",
  "오늘의 너에게 맛있는 행운이 갈 거야",
  "좋은 선택이 좋은 하루를 데려올 거야",
  "밥 먹는 시간만큼은 마음이 편해질 거야",
  "오늘은 네가 좋아하는 맛을 만날 거야",
  "한 숟갈의 기운이 오후를 지켜줄 거야",
  "천천히 골라도 좋은 메뉴가 기다릴 거야",
  "맛있는 점심이 너를 반겨줄 거야",
  "오늘의 식판에는 작은 즐거움이 담길 거야",
  "든든한 한 끼가 좋은 생각을 데려올 거야",
  "너에게 꼭 맞는 메뉴가 눈에 들어올 거야",
  "잘 먹고 잘 쉬면 오늘도 괜찮아질 거야",
];

const state = {
  restaurants: [],
  selectedId: localStorage.getItem("selectedRestaurant") || "buon",
  fortune: localStorage.getItem("fortuneMessage") || "",
  theme: localStorage.getItem("themeMode") || "light",
};

const apiBase = (window.GAYAAK_API_BASE || "").replace(/\/$/, "");

const refs = {
  homeView: document.querySelector("#homeView"),
  mealView: document.querySelector("#mealView"),
  themeToggle: document.querySelector("#themeToggle"),
  catholicCard: document.querySelector("#catholicCard"),
  fortuneInput: document.querySelector("#fortuneInput"),
  fortuneSaveButton: document.querySelector("#fortuneSaveButton"),
  fortuneDrawButton: document.querySelector("#fortuneDrawButton"),
  fortuneText: document.querySelector("#fortuneText"),
  backButton: document.querySelector("#backButton"),
  sourceName: document.querySelector("#sourceName"),
  pdfTitle: document.querySelector("#pdfTitle"),
  weekRange: document.querySelector("#weekRange"),
  restaurantTabs: document.querySelector("#restaurantTabs"),
  pdfFrame: document.querySelector("#pdfFrame"),
  emptyState: document.querySelector("#emptyState"),
  openPdfButton: document.querySelector("#openPdfButton"),
  refreshButton: document.querySelector("#refreshButton"),
};

function getKoreaDateKey(baseDate = new Date()) {
  const koreaDate = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const year = koreaDate.getUTCFullYear();
  const month = String(koreaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(koreaDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickDefaultFortune(force = false) {
  const todayKey = getKoreaDateKey();
  const savedDay = localStorage.getItem("defaultFortuneDay");
  const savedMessage = localStorage.getItem("defaultFortuneMessage");

  if (!force && savedDay === todayKey && savedMessage) {
    return savedMessage;
  }

  const message = fortuneMessages[Math.floor(Math.random() * fortuneMessages.length)];
  localStorage.setItem("defaultFortuneDay", todayKey);
  localStorage.setItem("defaultFortuneMessage", message);
  return message;
}

function getFortune() {
  return state.fortune || pickDefaultFortune();
}

function renderFortune() {
  const message = getFortune();
  refs.fortuneText.textContent = message;
  refs.fortuneInput.value = state.fortune;
}

function saveFortune() {
  const value = refs.fortuneInput.value.trim();
  state.fortune = value;

  if (value) {
    localStorage.setItem("fortuneMessage", value);
  } else {
    localStorage.removeItem("fortuneMessage");
  }

  renderFortune();
}

function drawFortune() {
  state.fortune = "";
  refs.fortuneInput.value = "";
  localStorage.removeItem("fortuneMessage");
  pickDefaultFortune(true);
  renderFortune();
}

function formatKoreaDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function getWeekRangeLabel(baseDate = new Date()) {
  const koreaDate = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000);
  const day = koreaDate.getUTCDay() || 7;
  const monday = new Date(koreaDate);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(koreaDate.getUTCDate() - day + 1);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return `${formatKoreaDate(monday)}-${formatKoreaDate(sunday)}`;
}

function setMessage(title, body) {
  refs.pdfFrame.classList.remove("is-visible");
  refs.emptyState.classList.remove("is-hidden");
  refs.emptyState.querySelector("strong").textContent = title;
  refs.emptyState.querySelector("span").textContent = body;
  refs.openPdfButton.classList.add("is-disabled");
  refs.openPdfButton.removeAttribute("href");
}

function showPdf(restaurant) {
  const pdfUrl = apiUrl(`/api/pdf?id=${encodeURIComponent(restaurant.id)}&t=${Date.now()}`);
  refs.pdfFrame.src = `${pdfUrl}#toolbar=0&navpanes=0&view=FitH`;
  refs.pdfFrame.classList.add("is-visible");
  refs.emptyState.classList.add("is-hidden");
  refs.pdfTitle.textContent = `${restaurant.label} 메뉴표를 열었어요`;
  refs.openPdfButton.href = pdfUrl;
  refs.openPdfButton.classList.remove("is-disabled");
}

function selectRestaurant(id) {
  state.selectedId = id;
  localStorage.setItem("selectedRestaurant", id);
  renderTabs();

  const restaurant = state.restaurants.find((item) => item.id === id);
  if (!restaurant || !restaurant.available) {
    setMessage("PDF 메뉴표가 없어요", "이 식당은 현재 페이지에서 PDF 링크를 찾지 못했습니다.");
    return;
  }

  showPdf(restaurant);
}

function renderTabs() {
  refs.restaurantTabs.innerHTML = "";

  for (const restaurant of state.restaurants) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !restaurant.available;
    button.className = restaurant.id === state.selectedId ? "is-active" : "";
    button.innerHTML = `
      <span class="tab-icon">🍱</span>
      <span>${restaurant.label}</span>
    `;
    button.addEventListener("click", () => selectRestaurant(restaurant.id));
    refs.restaurantTabs.append(button);
  }
}

async function loadRestaurants(force = false) {
  refs.refreshButton.disabled = true;
  refs.weekRange.textContent = getWeekRangeLabel();
  renderFortune();
  setMessage("메뉴표를 준비하고 있어요", "가톨릭대 식당 페이지에서 이번 주 PDF 링크를 확인하고 있습니다.");

  try {
    const payload = await fetchRestaurants(force);

    refs.sourceName.textContent = payload.sourceName || "가톨릭대학교 식당";
    state.restaurants = payload.restaurants || [];

    if (!state.restaurants.some((item) => item.id === state.selectedId && item.available)) {
      state.selectedId = state.restaurants.find((item) => item.available)?.id || "buon";
    }

    renderTabs();
    selectRestaurant(state.selectedId);
  } catch (error) {
    refs.pdfTitle.textContent = "연결 실패";
    setMessage("메뉴표를 불러오지 못했어요", "서버가 켜져 있는지, 인터넷 연결이 가능한지 확인해 주세요.");
  } finally {
    refs.refreshButton.disabled = false;
  }
}

async function fetchRestaurants(force = false) {
  const refresh = force ? "1" : "0";
  const url = apiUrl(`/api/restaurants?refresh=${refresh}&t=${Date.now()}`);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "accept": "application/json" },
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error || "메뉴 정보를 불러오지 못했습니다.");
      }

      return payload;
    } catch (error) {
      if (attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
}

function apiUrl(path) {
  return `${apiBase}${path}`;
}

function applyTheme() {
  document.body.dataset.theme = state.theme;
  const isDark = state.theme === "dark";
  refs.themeToggle.setAttribute("aria-pressed", String(isDark));
  refs.themeToggle.setAttribute("aria-label", isDark ? "라이트모드 켜기" : "다크모드 켜기");
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("themeMode", state.theme);
  applyTheme();
}

function openMealView() {
  refs.homeView.hidden = true;
  refs.mealView.hidden = false;
  loadRestaurants();
}

function openHomeView() {
  refs.mealView.hidden = true;
  refs.homeView.hidden = false;
  renderFortune();
}

function installPressFeedback() {
  const selector = "button, .primary-button, .secondary-button";
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(selector);
    if (!target || target.disabled || target.classList.contains("is-disabled")) return;
    target.classList.add("is-pressing");
  });

  document.addEventListener("pointerup", clearPressFeedback);
  document.addEventListener("pointercancel", clearPressFeedback);
  document.addEventListener("pointerleave", clearPressFeedback);
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    const target = event.target.closest(selector);
    if (!target || target.disabled || target.classList.contains("is-disabled")) return;
    target.classList.add("is-pressing");
  });
  document.addEventListener("keyup", clearPressFeedback);
}

function clearPressFeedback() {
  document.querySelectorAll(".is-pressing").forEach((element) => {
    element.classList.remove("is-pressing");
  });
}

refs.themeToggle.addEventListener("click", toggleTheme);
refs.catholicCard.addEventListener("click", openMealView);
refs.backButton.addEventListener("click", openHomeView);
refs.refreshButton.addEventListener("click", () => loadRestaurants(true));
refs.fortuneSaveButton.addEventListener("click", saveFortune);
refs.fortuneDrawButton.addEventListener("click", drawFortune);
refs.fortuneInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveFortune();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

applyTheme();
refs.weekRange.textContent = getWeekRangeLabel();
renderFortune();
installPressFeedback();
