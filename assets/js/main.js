/* HyperIntervals site logic — vanilla JS, no build step */
"use strict";

const $ = (sel) => document.querySelector(sel);

/* ---------- theme (默认浅色，localStorage 记忆) ---------- */
const themeMeta = document.querySelector('meta[name="theme-color"]');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("hi-theme", t);
  if (themeMeta) themeMeta.content = t === "dark" ? "#0b0e14" : "#f5f6fa";
}
$("#themeToggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

/* ---------- nav ---------- */
const nav = $("#nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });

const navToggle = $("#navToggle");
const navLinks = $("#navLinks");
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") navLinks.classList.remove("open");
});

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("in")),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------- helpers ---------- */
const fmtMonth = (v) => {
  if (!v) return "—";
  const m = String(v).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : v;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/* ---------- device data ---------- */
const state = { src: "aer", brand: "全部", query: "", data: null };
const SRC_TITLES = { aer: "AER 认证", productSupport: "手机支持", iotSupport: "IoT 支持" };
// 各分类对应的小米官方页面
const OFFICIAL_URLS = {
  aer: "https://trust.mi.com/zh-CN/misrc/updates/phone?tab=aerdata",
  productSupport: "https://trust.mi.com/misrc/updates/detail?tab=phone",
  iotSupport: "https://trust.mi.com/misrc/updates/detail?tab=iot",
};
const MAX_CARDS = 5;

function renderStats(d) {
  const map = { productSupport: d.productSupport, aer: d.aer, iotSupport: d.iotSupport, eol: d.eol };
  document.querySelectorAll(".stat b").forEach((b) => {
    const list = map[b.dataset.key] || [];
    b.textContent = list.length;
  });
  $("#statsTime").textContent = d.generatedAt ? `数据生成时间：${d.generatedAt}` : "";
  const total = (d.productSupport?.length || 0) + (d.aer?.length || 0) + (d.iotSupport?.length || 0) + (d.eol?.length || 0);
  $("#heroMeta").textContent = total ? `已收录 ${total} 条设备维护记录` : "";
}

function currentList() {
  if (!state.data) return [];
  const list = state.data[state.src] || [];
  const q = state.query.trim().toLowerCase();
  return list
    .filter((it) => {
      // IoT 支持按数据源自带的设备类型（可穿戴 / 路由器 …）筛选，其余按品牌
      const key = state.src === "iotSupport" ? it.deviceType : it.brand;
      if (state.brand !== "全部" && key !== state.brand) return false;
      if (q && !String(it.name).toLowerCase().includes(q)) return false;
      return true;
    })
    // 按发布日期倒序，取最近的若干条
    .sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")));
}

let chipsExpanded = false;
const CHIP_LIMIT = 4; // 默认显示「全部 + 4 个分类」共 5 个，其余点「更多」展开

function renderBrands() {
  const wrap = $("#brandChips");
  const list = (state.data && state.data[state.src]) || [];
  let keys;
  if (state.src === "iotSupport") {
    // 设备类型按条目数量从多到少排列，常用的品类排在前面
    const counts = new Map();
    list.forEach((it) => {
      if (it.deviceType) counts.set(it.deviceType, (counts.get(it.deviceType) || 0) + 1);
    });
    keys = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  } else {
    keys = [...new Set(list.map((it) => it.brand).filter(Boolean))];
  }

  const all = ["全部", ...keys];
  const collapsible = all.length > CHIP_LIMIT + 1;
  let shown = chipsExpanded || !collapsible ? all : all.slice(0, CHIP_LIMIT + 1);
  // 收起状态下如果选中的分类被藏起来了，补在最前面，避免「筛选生效但看不到标签」
  if (!chipsExpanded && state.brand !== "全部" && !shown.includes(state.brand)) {
    shown = [...shown, state.brand];
  }

  wrap.innerHTML =
    shown
      .map((b) => `<button class="chip${b === state.brand ? " active" : ""}" data-brand="${esc(b)}">${esc(b)}</button>`)
      .join("") +
    (collapsible
      ? `<button class="chip chip-more" data-more="1">${chipsExpanded ? "收起" : "更多"}</button>`
      : "");
}

function badgeFor(it) {
  return it.active
    ? `<span class="badge ok">维护中</span>`
    : `<span class="badge warn">更新终止</span>`;
}

function cardHtml(it) {
  const rows = [];
  const push = (label, val, full) => {
    if (val) rows.push(`<div class="${full ? "full" : ""}"><b>${esc(val)}</b><span>${label}</span></div>`);
  };
  push("发布日期", it.releaseDate);
  push("更新终止", fmtMonth(it.updateEndDate || it.date));
  push("初始系统", it.initialOs);
  push("后续系统", it.futureOs);
  push("更新频率", it.updateFrequency);
  push("设备类型", it.deviceType, true);
  return `<div class="card">
    <div class="card-top">
      <div><div class="card-brand">${esc(it.brand || "")}</div><div class="card-name">${esc(it.name)}</div></div>
      ${badgeFor(it)}
    </div>
    <div class="card-rows">${rows.join("") || `<div class="full"><b>—</b><span>暂无详情</span></div>`}</div>
  </div>`;
}

function renderCards() {
  const list = currentList();
  const slice = list.slice(0, MAX_CARDS);
  $("#cards").innerHTML = slice.map(cardHtml).join("");
  $("#empty").hidden = list.length > 0;
  const label = `${SRC_TITLES[state.src]}${state.query ? ` · 搜索“${state.query}”` : ""}`;
  $("#qCount").textContent = state.data
    ? `${label} · 共 ${list.length} 项${list.length > MAX_CARDS ? `，显示最近 ${MAX_CARDS} 条` : ""}`
    : "加载中…";
}

$("#srcTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".qtab");
  if (!btn) return;
  document.querySelectorAll("#srcTabs .qtab").forEach((t) => t.classList.toggle("active", t === btn));
  state.src = btn.dataset.src;
  state.brand = "全部";
  chipsExpanded = false;
  $("#officialLink").href = OFFICIAL_URLS[state.src] || "#";
  renderBrands();
  renderCards();
});

$("#brandChips").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  // 「更多 / 收起」只切换分类显示，不改变当前筛选
  if (btn.dataset.more) {
    chipsExpanded = !chipsExpanded;
    renderBrands();
    return;
  }
  state.brand = btn.dataset.brand;
  renderBrands();
  renderCards();
});

let debounce;
$("#q").addEventListener("input", (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    state.query = e.target.value;
    renderCards();
  }, 180);
});

/* ---------- changelog ---------- */
const releases = {};

function parseEntry(line) {
  const m = line.match(/^(新增|优化|修复)\s*(.+)$/);
  if (!m) return { cls: "", text: line };
  const cls = { 新增: "add", 优化: "opt", 修复: "fix" }[m[1]];
  return { cls, key: m[1], text: m[2] };
}

const LITE_LINKS = {
  github: "https://github.com/Shallow-Y/HyperIntervalsLite-Release/releases",
  gitee: "https://gitee.com/shallow-y/hyper-intervals-lite-release/releases",
};

function renderRelease(channel) {
  const r = releases[channel];
  if (!r) {
    // Lite 暂无本地日志数据时，引导去发布页
    $("#rcTitle").textContent = channel === "lite" ? "HyperIntervals Lite" : "加载失败";
    $("#rcMeta").textContent = channel === "lite" ? "Lite 版更新日志暂未收录，可前往发布页查看。" : "";
    const badge = $("#rcBadge");
    badge.textContent = channel === "lite" ? "Lite" : "—";
    badge.classList.toggle("beta", channel !== "stable");
    $("#rcList").innerHTML = "";
    $("#rcActions").innerHTML = channel === "lite"
      ? `<a class="btn btn-primary" href="${LITE_LINKS.github}" target="_blank" rel="noopener">GitHub 发布页</a>
         <a class="btn btn-ghost" href="${LITE_LINKS.gitee}" target="_blank" rel="noopener">Gitee 发布页</a>`
      : "";
    return;
  }
  $("#rcTitle").textContent = r.title || `HyperIntervals ${r.versionName}`;
  $("#rcMeta").textContent = `版本 ${r.versionName}（${r.versionCode}） · 发布时间 ${r.publishedAt || "—"}`;
  const badge = $("#rcBadge");
  badge.textContent = { beta: "Beta", lite: "Lite" }[channel] || "正式版";
  badge.classList.toggle("beta", channel !== "stable");

  const items = (r.changelog || []).filter((l) => l.trim());
  $("#rcList").innerHTML = items
    .map((line, i) => {
      const p = parseEntry(line);
      if (!p.cls) return `<li class="${i === 0 ? "intro" : ""}">${esc(line)}</li>`;
      return `<li><span class="rk ${p.cls}">${p.key}</span><span>${esc(p.text)}</span></li>`;
    })
    .join("");

  const gh = r.downloads?.github || {};
  const gt = r.downloads?.gitee || {};
  $("#rcActions").innerHTML = [
    gh.apkUrl ? `<a class="btn btn-primary" href="${esc(gh.apkUrl)}" target="_blank" rel="noopener">下载 APK（GitHub）</a>` : "",
    gt.apkUrl ? `<a class="btn btn-ghost" href="${esc(gt.apkUrl)}" target="_blank" rel="noopener">下载 APK（Gitee）</a>` : "",
    gh.releaseUrl ? `<a class="btn btn-ghost" href="${esc(gh.releaseUrl)}" target="_blank" rel="noopener">查看发布页</a>` : "",
  ].join("");
}

$("#chTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".qtab");
  if (!btn) return;
  document.querySelectorAll("#chTabs .qtab").forEach((t) => t.classList.toggle("active", t === btn));
  renderRelease(btn.dataset.ch);
});

/* ---------- boot ---------- */
(async () => {
  try {
    state.data = await loadJson("data/devices.json");
    renderStats(state.data);
    renderBrands();
    renderCards();
  } catch (err) {
    $("#qCount").textContent = "设备数据加载失败：" + err.message;
    $("#empty").hidden = false;
  }
  try {
    const [stable, beta, lite] = await Promise.all([
      loadJson("data/stable.json"),
      loadJson("data/beta.json"),
      // Lite 日志为可选项：data/lite.json 存在则展示，不存在走发布页兜底
      loadJson("data/lite.json").catch(() => null),
    ]);
    releases.stable = stable;
    releases.beta = beta;
    releases.lite = lite;
    renderRelease("stable");
  } catch (err) {
    $("#rcTitle").textContent = "更新日志加载失败";
    $("#rcMeta").textContent = err.message;
  }
})();
