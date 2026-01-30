const SIGNIN_URL = "https://learn.reboot01.com/api/auth/signin";
const JWT_KEY = "jwt";

const path = window.location.pathname;
const isHomePage = path.endsWith("home.html");

if (isHomePage) {
  const token = localStorage.getItem(JWT_KEY);
  if (!token) {
    window.location.replace("index.html");
  }

  const logoutBtn = document.getElementById("logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(JWT_KEY);
      window.location.replace("index.html");
    });
  }
} else {
  const form = document.getElementById("login-form");
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const errorEl = document.getElementById("error");

  const showError = (message) => {
    if (errorEl) errorEl.textContent = message;
  };

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError("");

      const identifier = (identifierInput?.value || "").trim();
      const password = passwordInput?.value || "";

      if (!identifier || !password) {
        showError("Please fill in both fields.");
        return;
      }

      const basic = btoa(`${identifier}:${password}`);

      try {
        const response = await fetch(SIGNIN_URL, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
          },
        });

        let token = "";
        let errorText = "";

        const extractToken = (text, data, headers) => {
          const authHeader =
            headers.get("Authorization") ||
            headers.get("authorization") ||
            headers.get("X-Auth-Token") ||
            headers.get("x-auth-token") ||
            "";
          if (authHeader.startsWith("Bearer ")) {
            return authHeader.slice(7).trim();
          }
          if (typeof text === "string" && text.trim()) {
            return text.trim().replace(/^"+|"+$/g, "");
          }
          if (data && typeof data === "object") {
            const candidate =
              data.token ||
              data.jwt ||
              data.access_token ||
              data.data?.token ||
              data.data?.jwt ||
              data.data?.access_token ||
              data.data?.data ||
              "";
            return typeof candidate === "string" ? candidate.trim() : "";
          }
          return "";
        };

        const text = await response.clone().text();
        let data = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        token = extractToken(text, data, response.headers);
        errorText =
          (data && (data.message || data.error)) || text || "Invalid credentials";

        if (response.ok) {
          if (!token) {
            showError("Login succeeded but token is empty.");
            return;
          }

          localStorage.setItem(JWT_KEY, token);
          window.location.replace("home.html");
        } else {
          showError(errorText || "Invalid credentials");
          console.error("Signin failed:", response.status, errorText);
        }
      } catch (error) {
        console.error(error);
        showError("Network error. Please try again.");
      }
    });
  }
}
