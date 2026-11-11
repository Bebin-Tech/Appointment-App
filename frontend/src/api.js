const BASE = import.meta.env.VITE_API_URL || "/api";
export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "true";
export async function request(path, options = {}) {
  if (DEMO_ONLY)
    throw Error(
      "This deployment is a browser demo. Data stays on this device.",
    );
  let response;
  try {
    response = await fetch(BASE + path, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw Error(
      "Cannot reach FastAPI. Start the backend on port 8000, or use the browser demo.",
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(
      typeof body.detail === "string"
        ? body.detail
        : response.status === 422
          ? "Please check the form values."
          : "The request could not be completed.",
    );
  return body;
}
export const api = {
  login: (data) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  signup: (data) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  list: () => request("/workspaces"),
  create: (data) =>
    request("/workspaces", { method: "POST", body: JSON.stringify({ data }) }),
  save: (id, data, revision) =>
    request("/workspaces/" + id, {
      method: "PUT",
      body: JSON.stringify({ data, revision }),
    }),
  remove: (id) => request("/workspaces/" + id, { method: "DELETE" }),
  reset: (email) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  publicGet: (slug) => request("/public/" + encodeURIComponent(slug)),
  publicBook: (slug, data) =>
    request("/public/" + encodeURIComponent(slug) + "/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  waitlist: (slug, data) =>
    request("/public/" + encodeURIComponent(slug) + "/waitlist", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  profile: (data) =>
    request("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),
};
