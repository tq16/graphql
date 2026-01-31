const runProfileSanityCheck = async () => {
  try {
    const userQuery = `
    {
      user {
        id
        login
      }
    }
    `;

    const userData = await window.graphqlRequest(userQuery);
    console.log("GraphQL sanity:", userData);

    const user = userData?.user?.[0];
    const idEl = document.getElementById("user-id");
    const loginEl = document.getElementById("user-login");

    if (idEl) idEl.textContent = user?.id ? `ID: ${user.id}` : "ID: —";
    if (loginEl) loginEl.textContent = user?.login ? `Login: ${user.login}` : "Login: —";

    const buildStatsQuery = (userKey, userId) => `
    {
      xp_transactions: transaction(
        where: {type: {_eq: "xp"}, ${userKey}: {_eq: ${userId}}}
        order_by: {createdAt: asc}
        limit: 10000
      ) {
        amount
        path
        createdAt
        object {
          type
          name
        }
      }
      audits_given_tx: transaction(
        where: {type: {_eq: "down"}, ${userKey}: {_eq: ${userId}}}
        limit: 10000
      ) {
        amount
      }
      audits_received_tx: transaction(
        where: {type: {_eq: "up"}, ${userKey}: {_eq: ${userId}}}
        limit: 10000
      ) {
        amount
      }
      level_tx: transaction(
        where: {type: {_eq: "level"}, ${userKey}: {_eq: ${userId}}}
        order_by: {createdAt: desc}
        limit: 1
      ) {
        amount
      }
    }
    `;

    const tryUserKeys = ["userId", "user_id"];
    let statsData = null;
    let statsError = null;

    for (const key of tryUserKeys) {
      try {
        const statsQuery = buildStatsQuery(key, user?.id || 0);
        statsData = await window.graphqlRequest(statsQuery);
        statsError = null;
        break;
      } catch (error) {
        statsError = error;
      }
    }

    try {
      if (!statsData) {
        throw statsError || new Error("Stats query failed");
      }
      const xpEl = document.getElementById("user-xp");
      const passEl = document.getElementById("pass-count");
      const failEl = document.getElementById("fail-count");
      const auditsDoneEl = document.getElementById("audits-given");
      const auditsReceivedEl = document.getElementById("audits-received");
      const auditRatioEl = document.getElementById("audit-ratio");
      const levelEl = document.getElementById("user-level");

      const formatBytes = (value) => {
        if (!Number.isFinite(value)) return null;
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
        if (value >= 1_000) return `${Math.round(value / 1_000)} KB`;
        return `${value.toFixed(2)} B`;
      };

      if (xpEl) {
        const filteredXp = (statsData?.xp_transactions || []).filter((tx) => {
          const type = String(tx?.object?.type || "").toLowerCase();
          const path = String(tx?.path || "").toLowerCase();
          const isModule = path.includes("/bh-module/");
          const isPiscine = path.includes("piscine");

          if (type === "project") return true;
          if (type === "piscine") return true;
          if (type === "exam") return isModule && !isPiscine;
          if (type === "exercise") return isModule && !isPiscine;
          return false;
        });

        const totalXp = filteredXp.reduce(
          (sum, tx) => sum + (Number(tx.amount) || 0),
          0
        );
        const formatted = formatBytes(totalXp);
        xpEl.textContent = formatted ? `Total XP: ${formatted}` : "Total XP: —";
      }

      if (levelEl) {
        const level = statsData?.level_tx?.[0]?.amount;
        levelEl.textContent = Number.isFinite(level) ? `Level: ${level}` : "Level: —";
      }
      // Pass/Fail counts from user's own results (nested relation)
      if (passEl || failEl) {
        const resultsQuery = `
        {
          result(limit: 10000) {
            grade
            path
            object { type name attrs }
          }
        }
        `;

        let results = [];
        try {
          const data = await window.graphqlRequest(resultsQuery);
          results = data?.result || [];
        } catch (resultsError) {
          console.error(resultsError);
        }
        if (!results.length) {
          if (passEl) passEl.textContent = "Passed Projects: 0";
          if (failEl) failEl.textContent = "Failed Projects: 0";
        } else {
        const isProject = (r) => {
          const type = r?.object?.type;
          if (type) return String(type).toLowerCase() === "project";
          const name = r?.object?.name;
          if (name) return String(name).toLowerCase().includes("project");
          const path = r?.path;
          if (path) {
            const p = String(path).toLowerCase();
            if (p.includes("exercise")) return false;
            return p.includes("project");
          }
          // If we can't identify the type, don't count it
          return false;
        };

        const projectResults = results.filter(isProject);
        const passCount = projectResults.filter((r) => Number(r.grade) >= 1).length;
        const failCount = projectResults.filter((r) => Number(r.grade) < 1).length;

        if (passEl) passEl.textContent = `Passed Projects: ${passCount}`;
        if (failEl) failEl.textContent = `Failed Projects: ${failCount}`;

        window.profileStats = window.profileStats || {};
        window.profileStats.passCount = passCount;
        window.profileStats.failCount = failCount;
        }

      }
      if (auditsDoneEl || auditsReceivedEl || auditRatioEl) {
        const auditsDone = (statsData?.audits_received_tx || []).reduce(
          (sum, tx) => sum + (Number(tx.amount) || 0),
          0
        );
        const auditsReceived = (statsData?.audits_given_tx || []).reduce(
          (sum, tx) => sum + (Number(tx.amount) || 0),
          0
        );

        const formatAudit = (value) => {
          if (!Number.isFinite(value)) return null;
          if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
          if (value >= 1_000) return `${(value / 1_000).toFixed(2)} KB`;
          return `${value.toFixed(2)} B`;
        };

      if (auditsDoneEl) {
        const val = formatAudit(auditsDone);
        auditsDoneEl.textContent = val ? `Audits Done: ${val}` : "Audits Done: —";
      }
      if (auditsReceivedEl) {
        const val = formatAudit(auditsReceived);
        auditsReceivedEl.textContent = val ? `Audits Received: ${val}` : "Audits Received: —";
      }
      if (auditRatioEl) {
        const ratio = Number.isFinite(auditsDone) && Number.isFinite(auditsReceived) && auditsReceived !== 0
          ? (auditsDone / auditsReceived).toFixed(1)
          : null;
        auditRatioEl.textContent = ratio ? `Audit Ratio: ${ratio}` : "Audit Ratio: —";
      }

      window.profileStats = window.profileStats || {};
      window.profileStats.auditRatio = Number.isFinite(auditsDone) && Number.isFinite(auditsReceived) && auditsReceived !== 0
        ? (auditsDone / auditsReceived)
        : null;

      const activityEl = document.getElementById("activity-list");
      if (activityEl) {
        const activityQuery = `
        {
          transaction(
            where: { type: { _eq: "xp" } }
            order_by: { createdAt: desc }
            limit: 50
          ) {
            type
            amount
            createdAt
            path
            object { name }
          }
        }
        `;
        try {
          const data = await window.graphqlRequest(activityQuery);
          const items = data?.transaction || [];
          const seen = new Set();
          const unique = [];
          for (const tx of items) {
            const name =
              tx?.object?.name ||
              String(tx?.path || "").split("/").filter(Boolean).pop() ||
              tx.type;
            if (seen.has(name)) continue;
            seen.add(name);
            unique.push({
              name,
              amount: Number(tx.amount) || 0,
            });
            if (unique.length === 5) break;
          }

          activityEl.innerHTML = unique.length
            ? unique.map((tx) => `<li>${tx.name} — ${formatBytes(tx.amount)}</li>`).join("")
            : "<li>No activity</li>";
        } catch (err) {
          activityEl.innerHTML = "<li>No activity</li>";
        }
      }
      }
    } catch (statsError) {
      console.error(statsError);
      const debugEl = document.getElementById("debug");
      if (debugEl) {
        debugEl.textContent = `Stats query error: ${statsError.message || statsError}`;
      }
    }
  } catch (error) {
    console.error(error);
    // Debug output removed once results are confirmed

    const idEl = document.getElementById("user-id");
    const loginEl = document.getElementById("user-login");
    const xpEl = document.getElementById("user-xp");
    const passEl = document.getElementById("pass-count");
    const failEl = document.getElementById("fail-count");
    const auditsDoneEl = document.getElementById("audits-given");
    const auditsReceivedEl = document.getElementById("audits-received");
    const auditRatioEl = document.getElementById("audit-ratio");

    if (idEl && !idEl.textContent) idEl.textContent = "ID: —";
    if (loginEl && !loginEl.textContent) loginEl.textContent = "Login: —";
    if (xpEl && !xpEl.textContent) xpEl.textContent = "Total XP: —";
    if (passEl && !passEl.textContent) passEl.textContent = "Pass: —";
    if (failEl && !failEl.textContent) failEl.textContent = "Fail: —";
    if (auditsDoneEl && !auditsDoneEl.textContent) auditsDoneEl.textContent = "Audits Done: —";
    if (auditsReceivedEl && !auditsReceivedEl.textContent) auditsReceivedEl.textContent = "Audits Received: —";
    if (auditRatioEl && !auditRatioEl.textContent) auditRatioEl.textContent = "Audit Ratio: —";
  }
};

runProfileSanityCheck();
