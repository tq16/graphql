const fetchSkills = async () => {
  const query = `
    query SkillsTx {
      transaction(
        where: { type: { _like: "skill_%" } }
        order_by: { createdAt: desc }
        limit: 10000
      ) {
        amount
        type
      }
    }
  `;
  const data = await window.graphqlRequest(query);
  const skills = parseSkillsFromTransactions(data?.transaction || []);
  return mergeSkills(skills);
};

const mergeSkills = (skills) => {
  const map = new Map();
  skills.forEach((s) => {
    const key = s.name.toLowerCase();
    const value = Number(s.value) || 0;
    const prev = map.get(key);
    if (!prev || value > prev.value) {
      map.set(key, { name: s.name, category: s.category || "unknown", value });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
};

const parseSkillsFromTransactions = (transactions) =>
  transactions.map((tx) => {
    const raw = String(tx?.type || "").replace(/^skill_/, "");
    const name = raw
      .split("-")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ");
    const techSkills = new Set(["algo", "back-end", "front-end", "game", "prog", "stats", "ai"]);
    const technologies = new Set(["go", "js", "javascript", "sql", "html", "css", "docker", "unix"]);
    const category = techSkills.has(raw)
      ? "technical"
      : technologies.has(raw)
        ? "technology"
        : "unknown";
    return { name, category, value: Number(tx?.amount) || 0 };
  });


const renderSkillsBars = (skills) => {
  const container = document.getElementById("skills-bars");
  if (!container) return;
  if (!skills || !skills.length) {
    container.textContent = "No skills data.";
    return;
  }
  const toPercent = (raw) => Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
  const width = 600;
  const barH = 16;
  const gap = 8;
  const height = skills.length * (barH + gap) + 10;
  const rows = skills.map((s, i) => {
    const pct = toPercent(s.value);
    const y = 10 + i * (barH + gap);
    const barW = Math.round((pct / 100) * (width - 160));
    return `
      <text x="10" y="${y + 12}" font-size="12" fill="#222">${escapeXml(s.name)}</text>
      <rect x="160" y="${y}" width="${width - 160}" height="${barH}" fill="#eee" />
      <rect x="160" y="${y}" width="${barW}" height="${barH}" fill="#8f7cf8" />
      <text x="${160 + barW + 6}" y="${y + 12}" font-size="12" fill="#222">${pct}%</text>
    `;
  }).join("");
  container.innerHTML = `<svg width="${width}" height="${height}">${rows}</svg>`;
};

const renderRadarChartSVG = (skills) => {
  const container = document.getElementById("skills-graph");
  if (!container) return;

  const data = skills.filter((s) => s.name && Number.isFinite(s.value));
  if (!data.length) {
    container.textContent = "No skills data.";
    return;
  }

  container.style.overflow = "auto";

  const maxValue = Math.max(...data.map((d) => d.value)) || 1;
  const count = data.length;
  const radius = Math.max(180, count * 6);
  const size = radius * 2 + 220;
  const cx = size / 2;
  const cy = size / 2;

  const rings = 5;
  const ringEls = Array.from({ length: rings }).map((_, i) => {
    const r = ((i + 1) / rings) * radius;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ddd" />`;
  }).join("");

  const spokes = data.map((_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e0e0e0" />`;
  }).join("");

  const points = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = (d.value / maxValue) * radius;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return { x, y };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  const labels = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const lr = radius + 16;
    const x = cx + Math.cos(angle) * lr;
    const y = cy + Math.sin(angle) * lr;
    const label = truncateLabel(d.name, 18);
    return `
      <text x="${x}" y="${y}" font-size="11" fill="#222" text-anchor="middle">
        ${escapeXml(label)}
        <title>${escapeXml(`${d.name}: ${d.value}`)}</title>
      </text>
    `;
  }).join("");

  const dots = points.map((p) =>
    `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#1a73e8" />`
  ).join("");

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <text x="${cx}" y="24" font-size="16" font-weight="600" fill="#111" text-anchor="middle">
        Skills (Technical + Technologies)
      </text>
      ${ringEls}
      ${spokes}
      <polygon points="${polygon}" fill="rgba(26,115,232,0.2)" stroke="#1a73e8" stroke-width="2" />
      ${dots}
      ${labels}
    </svg>
  `;
};

const renderGradesBar = () => {
  const container = document.getElementById("grades-graph");
  if (!container) return;
  const parseTextNumber = (id) => {
    const el = document.getElementById(id);
    if (!el || !el.textContent) return null;
    const m = el.textContent.match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : null;
  };
  const pass = Number(window.profileStats?.passCount);
  const fail = Number(window.profileStats?.failCount);
  const passText = parseTextNumber("pass-count");
  const failText = parseTextNumber("fail-count");
  const passVal = Number.isFinite(pass) ? pass : (passText || 0);
  const failVal = Number.isFinite(fail) ? fail : (failText || 0);
  const hasTextValues = Number.isFinite(passText) || Number.isFinite(failText);
  if (passVal === 0 && failVal === 0 && !hasTextValues) {
    setTimeout(renderGradesBar, 100);
    return;
  }
  const total = passVal + failVal || 1;
  const width = 320;
  const height = 24;
  const passW = Math.round((passVal / total) * width);
  const failW = width - passW;
  container.innerHTML = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${passW}" height="${height}" fill="#2ecc71" />
      <rect x="${passW}" y="0" width="${failW}" height="${height}" fill="#e74c3c" />
    </svg>
  `;
};

const renderAuditBar = () => {
  const container = document.getElementById("audit-graph");
  if (!container) return;
  const parseRatio = () => {
    const el = document.getElementById("audit-ratio");
    if (!el || !el.textContent) return null;
    const m = el.textContent.match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : null;
  };
  const raw = Number(window.profileStats?.auditRatio);
  const ratio = Number.isFinite(raw) ? raw : parseRatio();
  if (!Number.isFinite(ratio)) {
    container.textContent = "No audit ratio.";
    return;
  }
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const size = 160;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#eee" stroke-width="${stroke}" />
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#3498db" stroke-width="${stroke}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
        transform="rotate(-90 ${c} ${c})" />
      <text x="${c}" y="${c + 5}" font-size="18" text-anchor="middle" fill="#333">${ratio.toFixed(1)}</text>
    </svg>
  `;
};

const escapeXml = (str) =>
  String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const truncateLabel = (text, max) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const fetchXpProgress = async () => {
  const query = `
    query XpTx {
      transaction(
        where: { type: { _eq: "xp" } }
        order_by: { createdAt: asc }
        limit: 10000
      ) {
        amount
        createdAt
        path
        object { type }
      }
    }
  `;
  const data = await window.graphqlRequest(query);
  const tx = data?.transaction || [];
  return tx
    .filter((t) => {
      const type = String(t?.object?.type || "").toLowerCase();
      const path = String(t?.path || "").toLowerCase();
      const isModule = path.includes("/bh-module/");
      const isPiscine = path.includes("piscine");

      if (type === "project") return true;
      if (type === "piscine") return true;
      if (type === "exam") return isModule && !isPiscine;
      if (type === "exercise") return isModule && !isPiscine;
      return false;
    })
    .map((t) => ({
      amount: Number(t.amount) || 0,
      date: new Date(t.createdAt),
    }))
    .filter((t) => !Number.isNaN(t.date.getTime()));
};

const renderXpGraphSVG = (points) => {
  const container = document.getElementById("xp-graph");
  if (!container) return;
  if (!points.length) {
    container.textContent = "No XP data.";
    return;
  }

  container.style.overflow = "auto";

  const width = 800;
  const height = 320;
  const padding = 40;
  const minX = points[0].date.getTime();
  const maxX = points[points.length - 1].date.getTime();

  let total = 0;
  const series = points.map((p) => {
    total += p.amount;
    return { x: p.date.getTime(), y: total };
  });
  const maxY = Math.max(...series.map((p) => p.y)) || 1;

  const scaleX = (x) =>
    padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2);
  const scaleY = (y) =>
    height - padding - (y / maxY) * (height - padding * 2);

  const line = series.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(" ");

  const formatBytes = (value) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
    if (value >= 1_000) return `${Math.round(value / 1_000)} KB`;
    return `${value.toFixed(0)} B`;
  };

  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <text x="10" y="20" font-size="16" fill="#111">XP Progression</text>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ccc" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#ccc" />
      <polyline fill="none" stroke="#8f7cf8" stroke-width="2" points="${line}" />
      <circle cx="${scaleX(series[series.length - 1].x)}" cy="${scaleY(series[series.length - 1].y)}" r="3" fill="#8f7cf8" />
      <text x="${width - padding}" y="${padding}" font-size="12" text-anchor="end" fill="#444">
        Total ${formatBytes(total)}
      </text>
    </svg>
  `;
};

const initGraphs = async () => {
  try {
    const skills = await fetchSkills();
    renderRadarChartSVG(skills);
    renderSkillsBars(skills);

    const xpPoints = await fetchXpProgress();
    renderXpGraphSVG(xpPoints);

    const renderStats = () => {
      renderGradesBar();
      renderAuditBar();
    };
    renderStats();
    setTimeout(renderStats, 200);
  } catch (error) {
    const status = error?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("jwt");
      window.location.replace("index.html");
      return;
    }
    console.error(error);
  }
};

if (window.location.pathname.endsWith("home.html")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGraphs);
  } else {
    initGraphs();
  }
}
