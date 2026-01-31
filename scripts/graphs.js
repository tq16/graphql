const fetchSkills = async () => {
  const skillTxQuery = `
    query SkillsTx {
      transaction(
        where: { type: { _like: "skill_%" } }
        order_by: { createdAt: desc }
        limit: 10000
      ) {
        amount
        attrs
        createdAt
        path
        type
      }
    }
  `;
  const skillTx = await window.graphqlRequest(skillTxQuery);
  let skills = parseSkillsFromTransactions(skillTx?.transaction || []);

  // Fallback: infer skill name from type if attrs is empty
  if (skills.length === 0) {
    skills = (skillTx?.transaction || []).map((tx) => ({
      name: String(tx.type).replace(/^skill_/, ""),
      category: "unknown",
      value: Number(tx.amount) || 0,
    }));
  }

  const merged = mergeSkills(skills);
  console.log("Skills list:", merged);
  return merged;
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

const parseSkillsFromTransactions = (transactions) => {
  const out = [];
  transactions.forEach((tx) => {
    const type = String(tx?.type || "");
    if (type.startsWith("skill_")) {
      const raw = type.replace(/^skill_/, "");
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
      out.push({
        name,
        category,
        value: Number(tx?.amount) || 0,
      });
    }
    let attrs = tx?.attrs;
    if (typeof attrs === "string") {
      try {
        attrs = JSON.parse(attrs);
      } catch {
        // Try to extract from non-JSON strings
        const raw = attrs;
        const nameMatch = raw.match(/(skill|name|tech|technology|slug)\s*[:=]\s*["']?([A-Za-z0-9._-]+)["']?/i);
        const valueMatch = raw.match(/(value|amount|score)\s*[:=]\s*([0-9.]+)/i);
        if (nameMatch) {
          out.push({
            name: nameMatch[2],
            category: "unknown",
            value: valueMatch ? Number(valueMatch[2]) : Number(tx?.amount) || 1,
          });
        }
        attrs = null;
      }
    }
    const list =
      attrs?.skills ||
      attrs?.skill ||
      attrs?.technologies ||
      attrs?.technology ||
      attrs?.techs ||
      attrs?.tech ||
      null;

    const pushSkill = (item, fallbackName) => {
      if (!item) return;
      if (typeof item === "string") {
        out.push({ name: item, category: "unknown", value: Number(tx?.amount) || 1 });
        return;
      }
      if (typeof item === "object") {
        const name =
          item.name ||
          item.skill ||
          item.tech ||
          item.slug ||
          item.label ||
          fallbackName;
        if (!name) return;
        const category =
          item.category ||
          item.kind ||
          item.group ||
          (typeof item.technology === "string" ? "technology" : null) ||
          (typeof item.technical === "string" ? "technical" : null) ||
          "unknown";
        const value =
          Number(item.value) ||
          Number(item.amount) ||
          Number(tx?.amount) ||
          0;
        out.push({ name: String(name), category: String(category), value });
      }
    };

    if (Array.isArray(list)) {
      list.forEach((item) => pushSkill(item));
      return;
    }

    const name =
      attrs?.name ||
      attrs?.slug ||
      attrs?.label ||
      attrs?.skill ||
      attrs?.tech ||
      attrs?.technology ||
      "";

    if (list || attrs) {
      pushSkill(list || attrs, name);
      return;
    }

    // Last-resort: if attrs is a map of { SkillName: value }
    if (attrs && typeof attrs === "object") {
      Object.entries(attrs).forEach(([k, v]) => {
        if (typeof v === "number") {
          out.push({ name: k, category: "unknown", value: v });
        }
      });
    }
  });
  return out;
};


const extractLabelFromPath = (path) => {
  if (!path) return "";
  const parts = String(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

const renderSkillsList = (skills) => {
  const list = document.getElementById("skills-list");
  if (!list) return;
  if (!skills || !skills.length) {
    list.innerHTML = "<li>No skills found</li>";
    return;
  }
  list.innerHTML = skills
    .map((s) => {
      const raw = Number(s.value) || 0;
      const pct = Math.round(raw);
      return `<li>${escapeXml(s.name)} — ${pct}%</li>`;
    })
    .join("");
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

const escapeXml = (str) =>
  String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const truncateLabel = (text, max) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const initSkillsGraph = async () => {
  try {
    const skills = await fetchSkills();
    renderSkillsList(skills);
    renderRadarChartSVG(skills);
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
    document.addEventListener("DOMContentLoaded", initSkillsGraph);
  } else {
    initSkillsGraph();
  }
}
