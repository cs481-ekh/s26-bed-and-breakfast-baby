const CSRF_ENDPOINT = "/api/auth/csrf/";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getCookie(name) {
  const cookieValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookieValue) {
    return "";
  }

  return decodeURIComponent(cookieValue.split("=")[1] || "");
}

export async function ensureCsrfCookie() {
  await fetch(CSRF_ENDPOINT, {
    method: "GET",
    credentials: "include",
  });
}

export async function apiFetch(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (UNSAFE_METHODS.has(method)) {
    await ensureCsrfCookie();
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  return fetch(url, {
    ...options,
    method,
    credentials: "include",
    headers,
  });
}

export async function apiJson(url, options = {}) {
  const response = await apiFetch(url, options);
  const text = await response.text();

  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  return { response, payload };
}
