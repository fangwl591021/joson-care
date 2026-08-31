const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/channel/UClq-e-Ve7LZ0Dx1o5pPruwA";
const list = document.getElementById("video-list");
const categoryTabs = document.getElementById("video-categories");
const state = document.getElementById("liff-state");
const dialog = document.getElementById("player-dialog");
const playerFrame = document.getElementById("player-frame");
const playerTitle = document.getElementById("player-title");
let currentVideos = [];
let currentCategories = [];
const requestedCategory = new URLSearchParams(location.search).get("category");
let activeCategory = requestedCategory || "all";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date);
}

function closePlayer() {
  dialog.hidden = true;
  playerFrame.replaceChildren();
  playerTitle.textContent = "";
  document.body.classList.remove("playing");
}

function openPlayer(video) {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(String(video.videoId || ""))) return;
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&rel=0&playsinline=1`;
  iframe.title = String(video.title || "Joson-Care YouTube 影片");
  iframe.loading = "eager";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  playerFrame.replaceChildren(iframe);
  playerTitle.textContent = iframe.title;
  dialog.hidden = false;
  document.body.classList.add("playing");
  dialog.querySelector(".player-close").focus();
}

function videoCard(video) {
  const index = currentVideos.indexOf(video);
  return `<button class="video-card" type="button" data-video-index="${index}" aria-label="播放 ${escapeHtml(video.title)}"><span class="video-thumb"><img src="${escapeHtml(video.thumbnailUrl)}" alt="" loading="lazy"><i class="play" aria-hidden="true">▶</i></span><strong>${escapeHtml(video.title)}</strong><time datetime="${escapeHtml(video.publishedAt)}">${escapeHtml(formatDate(video.publishedAt))}</time></button>`;
}

function bindVideoCards() {
  list.querySelectorAll("[data-video-index]").forEach((button) => {
    button.addEventListener("click", () => openPlayer(currentVideos[Number(button.dataset.videoIndex)]));
  });
}

function renderVideos() {
  const visibleCategories = activeCategory === "all"
    ? currentCategories.filter((category) => category.count > 0)
    : currentCategories.filter((category) => category.id === activeCategory);
  const sections = visibleCategories.map((category) => {
    const videos = currentVideos.filter((video) => video.category === category.id);
    if (!videos.length) return `<section class="video-section"><h3>${escapeHtml(category.label)} <span>0</span></h3><div class="empty">這個分類目前尚無影片。</div></section>`;
    return `<section class="video-section"><h3>${escapeHtml(category.label)} <span>${videos.length}</span></h3><div class="video-grid">${videos.map(videoCard).join("")}</div></section>`;
  }).join("");
  list.className = "video-sections";
  list.innerHTML = sections || '<div class="empty">目前尚無公開影片。</div>';
  bindVideoCards();
}

function renderCategoryTabs() {
  const tabs = [{ id: "all", label: "全部", count: currentVideos.length }, ...currentCategories];
  categoryTabs.innerHTML = tabs.map((category) => `<button class="category-tab${category.id === activeCategory ? " active" : ""}" type="button" data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)} <span>${category.count}</span></button>`).join("");
  categoryTabs.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCategoryTabs();
      renderVideos();
    });
  });
}

async function connectLiff() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    await liff.init({ liffId: config.liffId });
    const context = liff.getContext?.();
    if (liff.isInClient()) {
      const viewType = context?.viewType || "LINE";
      state.textContent = viewType === "tall" ? "已在 LINE LIFF TALL 開啟" : `已在 LINE LIFF 開啟（目前尺寸：${viewType}）`;
    } else {
      state.textContent = "目前使用一般瀏覽器；從 LINE 圖文選單開啟可使用 LIFF 視窗。";
    }
  } catch (error) {
    state.textContent = `LIFF 連線未完成：${error?.message || error}`;
  }
}

async function loadVideos() {
  try {
    const response = await fetch("/api/videos");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || `HTTP ${response.status}`);
    const videos = Array.isArray(data.videos) ? data.videos : [];
    document.getElementById("channel-link").href = data.channel?.url || YOUTUBE_CHANNEL_URL;
    if (!videos.length) {
      list.innerHTML = '<div class="empty">目前尚無公開影片。</div>';
      return;
    }
    currentVideos = videos;
    currentCategories = Array.isArray(data.categories) ? data.categories : [];
    if (activeCategory !== "all" && !currentCategories.some((category) => category.id === activeCategory && category.count > 0)) activeCategory = "all";
    renderCategoryTabs();
    renderVideos();
  } catch (error) {
    list.innerHTML = `<div class="error"><strong>暫時無法載入 YouTube 影片</strong><span>${escapeHtml(error?.message || error)}</span><a href="${YOUTUBE_CHANNEL_URL}" target="_blank" rel="noopener noreferrer">直接前往官方頻道 ↗</a></div>`;
  }
}

dialog.querySelectorAll("[data-close-player]").forEach((button) => button.addEventListener("click", closePlayer));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !dialog.hidden) closePlayer(); });
Promise.allSettled([connectLiff(), loadVideos()]);
