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

      if (xpEl) {
        const totalXp = (statsData?.xp_transactions || []).reduce(
          (sum, tx) => sum + (Number(tx.amount) || 0),
          0
        );
        xpEl.textContent = `Total XP: ${totalXp}`;
      }
      // Pass/Fail counts from user's own results (nested relation)
      if (passEl || failEl) {
        const formatId = (value) => {
          if (typeof value === "number") return String(value);
          const asNumber = Number(value);
          if (Number.isFinite(asNumber) && String(value).trim() !== "") {
            return String(asNumber);
          }
          return JSON.stringify(String(value || ""));
        };

        const userIdLiteral = formatId(user?.id);
        const resultsQueries = [
          // Direct result with userId
          `
          {
            result(where: {userId: {_eq: ${userIdLiteral}}}, limit: 10000) {
              grade
              path
              object { type name }
            }
          }
          `,
          // Direct result with user_id
          `
          {
            result(where: {user_id: {_eq: ${userIdLiteral}}}, limit: 10000) {
              grade
              path
              object { type name }
            }
          }
          `,
          // Direct result with user relation
          `
          {
            result(where: {user: {id: {_eq: ${userIdLiteral}}}}, limit: 10000) {
              grade
              path
              object { type name }
            }
          }
          `,
          // Direct progress table with userId
          `
          {
            progress(where: {userId: {_eq: ${userIdLiteral}}}, limit: 10000) {
              grade
              path
              object { type name }
            }
          }
          `,
          // Direct progress table with user_id
          `
          {
            progress(where: {user_id: {_eq: ${userIdLiteral}}}, limit: 10000) {
              grade
              path
              object { type name }
            }
          }
          `,
          // Direct progress with user relation
          `
          {
            progress(where: {user: {id: {_eq: ${userIdLiteral}}}}, limit: 10000) {
              grade
              path
              object { type name }
            }
          }
          `,
        ];

        let results = [];
        for (const query of resultsQueries) {
          try {
            const data = await window.graphqlRequest(query);
            results = data?.result || data?.progress || [];
            if (Array.isArray(results) && results.length) {
              break;
            }
          } catch (resultsError) {
            const debugEl = document.getElementById("debug");
            if (debugEl) {
              debugEl.textContent = `Results query error: ${resultsError.message || resultsError}`;
            }
          }
        }

        if (!results.length) {
          const diagnostics = [
            `
            {
              result(limit: 3) { id grade userId user_id }
            }
            `,
            `
            {
              progress(limit: 3) { id grade userId user_id }
            }
            `,
          ];

          for (const query of diagnostics) {
            try {
              const data = await window.graphqlRequest(query);
              const debugEl = document.getElementById("debug");
              if (debugEl) {
                debugEl.textContent = `Diagnostics: ${JSON.stringify(data)}`;
              }
              break;
            } catch (diagError) {
              const debugEl = document.getElementById("debug");
              if (debugEl) {
                debugEl.textContent = `Diagnostics error: ${diagError.message || diagError}`;
              }
            }
          }
        }
        const isProject = (r) => {
          const type = r?.object?.type;
          if (type) return String(type).toLowerCase() === "project";
          const name = r?.object?.name;
          if (name) return String(name).toLowerCase().includes("project");
          const path = r?.path;
          if (path) return String(path).toLowerCase().includes("project");
          // Fallback: if no project marker exists, treat as project
          return true;
        };

        const projectResults = results.filter(isProject);
        const passCount = projectResults.filter((r) => Number(r.grade) >= 1).length;
        const failCount = projectResults.filter((r) => Number(r.grade) === 0).length;

        if (passEl) passEl.textContent = `Pass: ${passCount}`;
        if (failEl) failEl.textContent = `Fail: ${failCount}`;
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

        const formatMillions = (value) =>
          Number.isFinite(value) ? (value / 1_000_000).toFixed(2) : null;

        if (auditsDoneEl) {
          const val = formatMillions(auditsDone);
          auditsDoneEl.textContent = val ? `Audits Done: ${val}` : "Audits Done: —";
        }
        if (auditsReceivedEl) {
          const val = formatMillions(auditsReceived);
          auditsReceivedEl.textContent = val ? `Audits Received: ${val}` : "Audits Received: —";
        }
        if (auditRatioEl) {
          const ratio = Number.isFinite(auditsDone) && Number.isFinite(auditsReceived) && auditsReceived !== 0
            ? (auditsDone / auditsReceived).toFixed(1)
            : null;
          auditRatioEl.textContent = ratio ? `Audit Ratio: ${ratio}` : "Audit Ratio: —";
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
    const debugEl = document.getElementById("debug");
    if (debugEl) {
      debugEl.textContent = `User query error: ${error.message || error}`;
    }

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
