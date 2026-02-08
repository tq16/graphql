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
  const barH = 28;
  const gap = 12;
  const height = skills.length * (barH + gap) + 32;
  const rows = skills.map((s, i) => {
    const pct = toPercent(s.value);
    const y = 10 + i * (barH + gap);
    const barW = Math.round((pct / 100) * (width - 160));
    return `
      <text x="10" y="${y + 18}" class="skills-bars-label">${escapeXml(s.name)}</text>
      <rect x="160" y="${y}" width="${width - 160}" height="${barH}" class="skills-bars-track" />
      <rect x="160" y="${y}" width="${barW}" height="${barH}" class="skills-bars-fill" />
      <text x="${160 + barW + 6}" y="${y + 18}" class="skills-bars-pct">${pct}%</text>
    `;
  }).join("");
  container.innerHTML = `
    <svg class="skills-bars-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet">
      ${rows}
    </svg>
  `;
};

const renderRadarChartSVG = (skills) => {
  const container = document.getElementById("skills-graph");
  if (!container) return;

  const data = skills.filter((s) => s.name && Number.isFinite(s.value));
  if (!data.length) {
    container.textContent = "No skills data.";
    return;
  }

  const maxValue = Math.max(...data.map((d) => d.value)) || 1;
  const count = data.length;
  const radius = Math.max(220, count * 7);
  const size = radius * 2 + 240;
  const cx = size / 2;
  const cy = size / 2;

  const rings = 5;
  const ringEls = Array.from({ length: rings }).map((_, i) => {
    const r = ((i + 1) / rings) * radius;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" class="skills-radar-ring" />`;
  }).join("");

  const spokes = data.map((_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="skills-radar-spoke" />`;
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
      <text x="${x}" y="${y}" class="skills-radar-label" text-anchor="middle">
        ${escapeXml(label)}
        <title>${escapeXml(`${d.name}: ${d.value}`)}</title>
      </text>
    `;
  }).join("");

  const dots = points.map((p) =>
    `<circle cx="${p.x}" cy="${p.y}" r="2.5" class="skills-radar-dot" />`
  ).join("");

  container.innerHTML = `
    <svg class="skills-radar-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <text x="${cx}" y="24" class="skills-radar-title" text-anchor="middle">
        Skills (Technical + Technologies)
      </text>
      ${ringEls}
      ${spokes}
      <polygon points="${polygon}" class="skills-radar-polygon" />
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
  const scoreEl = document.getElementById("grades-score");
  if (passVal === 0 && failVal === 0 && !hasTextValues) {
    if (scoreEl) scoreEl.textContent = "—%";
    setTimeout(renderGradesBar, 100);
    return;
  }
  const total = passVal + failVal || 1;
  const passPct = Math.round((passVal / total) * 100);
  if (scoreEl) scoreEl.textContent = `${passPct}%`;
  const width = Math.max(320, container.clientWidth || 520);
  const height = 28;
  const passW = Math.round((passVal / total) * width);
  const failW = width - passW;
  container.innerHTML = `
    <svg class="grades-svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <rect x="0" y="0" width="${passW}" height="${height}" class="grades-pass" />
      <rect x="${passW}" y="0" width="${failW}" height="${height}" class="grades-fail" />
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
  const ratioText = Number.isFinite(ratio)
    ? ratio.toFixed(1)
    : "0.0";
  const size = 200;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75; // 270deg gauge
  const arcOffset = circumference * 0.125; // center the gap at top
  const progress = arc * (pct / 100);

  container.innerHTML = `
    <svg class="audit-gauge-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="gold-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#F6C445"/>
          <stop offset="100%" stop-color="#EF4444"/>
        </linearGradient>
      </defs>
      <circle cx="${c}" cy="${c}" r="${r}" class="audit-gauge-base"
        stroke-dasharray="${arc} ${circumference - arc}" stroke-dashoffset="${arcOffset}" />
      <circle cx="${c}" cy="${c}" r="${r}" class="audit-gauge-progress"
        stroke-dasharray="${progress} ${circumference - progress}" stroke-dashoffset="${arcOffset}" />
      <g class="audit-gauge-ticks">
        <line x1="${c}" y1="${c - r}" x2="${c}" y2="${c - r - 10}" />
        <line x1="${c + r * 0.7}" y1="${c + r * 0.7}" x2="${c + r * 0.78}" y2="${c + r * 0.78}" />
        <line x1="${c - r * 0.7}" y1="${c + r * 0.7}" x2="${c - r * 0.78}" y2="${c + r * 0.78}" />
      </g>
      <text x="${c}" y="${c + 4}" class="audit-gauge-value" text-anchor="middle">${ratioText}</text>
      <text x="${c}" y="${c + 24}" class="audit-gauge-label" text-anchor="middle">RATIO BOOST</text>
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

  const renderBar = (el, label, value, className) => {
    const width = 220;
    const barW = Math.round((value / max) * width);
    const amount = formatAmount(value);
    const amountParts = amount.split(" ");
    const amountValue = amountParts[0] || amount;
    const amountUnit = amountParts[1] || "";
    el.innerHTML = `
      <div class="audit-metric">
        <div class="audit-label">${label}</div>
        <div class="audit-value">
          <span class="audit-num">${amountValue}</span>
          <span class="audit-unit">${amountUnit}</span>
        </div>
        <div class="audit-track">
          <svg class="audit-svg" width="${width}" height="4" viewBox="0 0 ${width} 4" preserveAspectRatio="none">
            <rect x="0" y="0" width="${width}" height="4" class="audit-track-rect" />
            <rect x="0" y="0" width="${barW}" height="4" class="${className}" />
          </svg>
        </div>
      </div>
    `;
  };

  renderBar(doneEl, "Done", doneVal, "audit-fill audit-fill-done");
  renderBar(receivedEl, "Received", receivedVal, "audit-fill audit-fill-received");
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

  const width = 1280;
  const height = 360;
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
    <svg class="xp-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
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
      <text x="10" y="18" class="xp-title">XP Progression</text>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="xp-axis" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="xp-axis" />
      <polyline fill="none" stroke="url(#xp-line)" stroke-width="2" points="${line}" />
      <circle cx="${scaleX(series[series.length - 1].x)}" cy="${scaleY(series[series.length - 1].y)}" r="3" class="xp-point" />
      <text x="${width - padding}" y="${padding}" class="xp-total" text-anchor="end">
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
      window.location.replace("index.html");
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
