const packageList = document.querySelector("#packageList");
const statusBox = document.querySelector("#statusBox");
const packageCount = document.querySelector("#packageCount");
const refreshButton = document.querySelector("#refreshButton");
const API_ORIGIN = window.location.protocol === "file:" ? "http://8.130.65.113" : "";

function buildApiUrl(path) {
  return `${API_ORIGIN}${path}`;
}

function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (!value) return "--";
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createPackageCard(item, index) {
  const card = document.createElement("article");
  card.className = `package-card${index === 0 ? " latest" : ""}`;

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "package-title";
  const version = document.createElement("strong");
  version.textContent = item.version || item.label || item.filename || "未知版本";
  title.appendChild(version);
  if (index === 0) {
    const badge = document.createElement("span");
    badge.className = "latest-badge";
    badge.textContent = "最新";
    title.appendChild(badge);
  }

  const meta = document.createElement("p");
  meta.className = "package-meta";
  const checksum = item.checksum ? `${String(item.checksum).slice(0, 10)}...` : "--";
  meta.textContent = [
    item.label || "TV APK",
    item.filename || "--",
    formatSize(item.sizeBytes),
    `更新 ${formatDate(item.updateTime || item.createTime)}`,
    `SHA256 ${checksum}`
  ].join(" · ");

  info.append(title, meta);

  const link = document.createElement("a");
  link.className = "download-button";
  link.href = buildApiUrl(item.downloadPath || `/api/app-packages/files/${encodeURIComponent(item.filename || "")}`);
  link.download = item.filename || "";
  link.textContent = "下载 APK";

  card.append(info, link);
  return card;
}

async function loadPackages() {
  statusBox.className = "status-box";
  statusBox.textContent = "正在读取 APK 版本...";
  packageList.innerHTML = "";
  packageCount.textContent = "--";

  try {
    const response = await fetch(buildApiUrl(`/api/app-packages?platform=tv&_=${Date.now()}`), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const packages = (payload?.data?.packages || []).filter((item) => item.platform === "tv");
    packageCount.textContent = `${packages.length} 个`;

    if (!packages.length) {
      statusBox.textContent = "服务器 APK 目录里暂时没有 TV 安装包。";
      return;
    }

    statusBox.textContent = "";
    statusBox.style.display = "none";
    packages.forEach((item, index) => {
      packageList.appendChild(createPackageCard(item, index));
    });
  } catch (error) {
    statusBox.style.display = "block";
    statusBox.className = "status-box is-error";
    statusBox.textContent = `读取失败：${error instanceof Error ? error.message : "未知错误"}`;
  }
}

refreshButton.addEventListener("click", () => {
  statusBox.style.display = "block";
  loadPackages();
});

loadPackages();
