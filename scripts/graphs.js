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
  const width = Math.max(320, Math.min(600, container.clientWidth || 600));
  const barH = 16;
  const gap = 8;
  const height = skills.length * (barH + gap) + 10;
  const rows = skills.map((s, i) => {
    const pct = toPercent(s.value);
    const y = 10 + i * (barH + gap);
    const barW = Math.round((pct / 100) * (width - 160));
    return `
      <text x="10" y="${y + 12}" font-size="12" fill="#E9EEF7">${escapeXml(s.name)}</text>
      <rect x="160" y="${y}" width="${width - 160}" height="${barH}" fill="rgba(233,238,247,0.12)" />
      <rect x="160" y="${y}" width="${barW}" height="${barH}" fill="#8f7cf8" />
      <text x="${160 + barW + 6}" y="${y + 12}" font-size="12" fill="#E9EEF7">${pct}%</text>
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
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(233,238,247,0.25)" />`;
  }).join("");

  const spokes = data.map((_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(233,238,247,0.2)" />`;
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
      <text x="${x}" y="${y}" font-size="11" fill="#E9EEF7" text-anchor="middle">
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
      <text x="${cx}" y="24" font-size="16" font-weight="600" fill="#E9EEF7" text-anchor="middle">
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
  let ratio = Number.isFinite(raw) ? raw : parseRatio();
  if (!Number.isFinite(ratio) || ratio <= 0) {
    ratio = 0.1; // default to show a small ring instead of nothing
  }
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const size = 170;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="gold-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F6C445"/>
          <stop offset="100%" stop-color="#D9A72F"/>
        </linearGradient>
        <linearGradient id="gold-ring-inner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(246,196,69,0.9)"/>
          <stop offset="100%" stop-color="rgba(246,196,69,0.3)"/>
        </linearGradient>
      </defs>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(233,238,247,0.12)" stroke-width="${stroke}" />
      <circle cx="${c}" cy="${c}" r="${r - 10}" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="4" />
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#gold-ring)" stroke-width="${stroke}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
        transform="rotate(-90 ${c} ${c})" />
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#gold-ring-inner)" stroke-width="2"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset + 8}" />
      <circle cx="${c}" cy="${c}" r="${r - 16}" fill="rgba(18, 25, 38, 0.7)" stroke="rgba(246,196,69,0.25)" />
      <text x="${c}" y="${c + 6}" font-size="20" font-weight="700" text-anchor="middle" fill="#F6C445">${pct}%</text>
    </svg>
  `;
};

const renderAuditDoneReceivedBars = () => {
  const doneEl = document.getElementById("audits-done-bar");
  const receivedEl = document.getElementById("audits-received-bar");
  if (!doneEl || !receivedEl) return;

  const done = Number(window.profileStats?.auditsDone);
  const received = Number(window.profileStats?.auditsReceived);
  const doneVal = Number.isFinite(done) ? done : 0;
  const receivedVal = Number.isFinite(received) ? received : 0;
  const max = Math.max(doneVal, receivedVal) || 1;

  const formatAmount = (value) => {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)} KB`;
    return `${value.toFixed(2)} B`;
  };

  const renderBar = (el, label, value, color) => {
    const width = 320;
    const height = 10;
    const barW = Math.round((value / max) * width);
    const amount = formatAmount(value);
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:12px;color:#E9EEF7;min-width:70px;">${label}</div>
        <svg width="${width}" height="${height}">
          <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(233,238,247,0.12)" />
          <rect x="0" y="0" width="${barW}" height="${height}" fill="${color}" />
        </svg>
        <div style="font-size:12px;color:#E9EEF7;white-space:nowrap;">${amount}</div>
      </div>
    `;
  };

  renderBar(doneEl, "Done", doneVal, "#a78bfa");
  renderBar(receivedEl, "Received", receivedVal, "#f59e0b");
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

  const width = 720;
  const height = 220;
  const padding = 36;
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
      <defs>
        <linearGradient id="xp-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#F6C445"/>
          <stop offset="100%" stop-color="#D9A72F"/>
        </linearGradient>
        <linearGradient id="xp-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(246,196,69,0.35)"/>
          <stop offset="100%" stop-color="rgba(246,196,69,0)"/>
        </linearGradient>
      </defs>
      <text x="10" y="18" font-size="14" fill="#E9EEF7">XP Progression</text>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(233,238,247,0.15)" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(233,238,247,0.15)" />
      <polyline fill="none" stroke="url(#xp-line)" stroke-width="2" points="${line}" />
      <circle cx="${scaleX(series[series.length - 1].x)}" cy="${scaleY(series[series.length - 1].y)}" r="3" fill="#F6C445" />
      <text x="${width - padding}" y="${padding}" font-size="12" text-anchor="end" fill="#E9EEF7">
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
      renderAuditDoneReceivedBars();
    };
    renderStats();
    setTimeout(renderStats, 200);
    setTimeout(renderStats, 600);
  } catch (error) {
    const status = error?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("jwt");
      window.location.replace("login.html");
      return;
    }
    console.error(error);
  }
};

if (window.location.pathname.endsWith("dashboard.html")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGraphs);
  } else {
    initGraphs();
  }
}
