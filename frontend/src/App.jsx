import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppContext, permitted } from "./context.js";
import {
  uid,
  seed,
  seedWorkspace,
  plans,
  parts,
  dateKey,
  addDays,
  wallISO,
} from "./domain.js";
import { conflict, quota, slots } from "./scheduling.js";
import { api } from "./api.js";
import Shell from "./Shell.jsx";
import Dialogs from "./Dialogs.jsx";
import {
  Dashboard,
  Calendar,
  Bookings,
  Clients,
  Services,
  Team,
  Analytics,
  Integrations,
  Settings,
  Pricing,
  Audit,
  Developer,
} from "./screens.jsx";
import { Landing, Auth, Onboarding } from "./Marketing.jsx";
import { BookingPage, PublicBooking } from "./BookingPage.jsx";
import { Icon, Empty } from "./ui.jsx";
const KEY = "bookflow.react.demo.v1";
let storageUnavailable = false;
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (
      s?.version === 1 &&
      s.workspaces?.length &&
      s.workspaces.every(
        (w) =>
          Array.isArray(w.bookings) &&
          Array.isArray(w.staff) &&
          Array.isArray(w.services) &&
          Array.isArray(w.clients),
      )
    ) {
      // Refresh the original sample workspace colors without changing custom
      // branding or discarding any appointments saved in this browser.
      for (const workspace of s.workspaces) {
        if (workspace.id === "ws1" && workspace.color === "#4c7962")
          workspace.color = "#0757e8";
        if (workspace.id === "ws2" && workspace.color === "#6d63a2")
          workspace.color = "#2145a0";
      }
      return s;
    }
  } catch {
    storageUnavailable = true;
  }
  return seed();
}
function placeholder(profile) {
  const w = seedWorkspace("pending", "Your workspace", "#0757e8", "Free");
  w.bookings = [];
  w.clients = [];
  w.services = [];
  w.staff = [];
  w.activity = [];
  return { ...w, memberRole: "Owner", revision: 0 };
}
export default function App() {
  const [state, setState] = useState(load),
    stateRef = useRef(state),
    [hash, setHash] = useState(location.hash),
    [live, setLive] = useState(false),
    liveRef = useRef(false),
    [loading, setLoading] = useState(true),
    [dialog, setDialog] = useState(null),
    [toasts, setToasts] = useState([]),
    [saving, setSaving] = useState(false),
    busy = useRef(false),
    [zoneOverride, setZone] = useState("");
  stateRef.current = state;
  liveRef.current = live;
  const notify = useCallback((text, label, action) => {
    const id = uid();
    setToasts((ts) => [...ts, { id, text, label, action }]);
    setTimeout(
      () => setToasts((ts) => ts.filter((t) => t.id !== id)),
      label ? 10000 : 5000,
    );
  }, []);
  const close = useCallback(() => setDialog(null), []),
    show = useCallback((type, data = {}) => setDialog({ type, data }), []),
    go = useCallback((path) => {
      location.hash = path;
    }, []);
  const run = useCallback(
    async (action) => {
      try {
        await action();
      } catch (e) {
        notify(e.message);
      }
    },
    [notify],
  );
  const w =
      state.workspaces.find((w) => w.id === state.active) ||
      state.workspaces[0],
    role = live ? w.memberRole || "Owner" : state.role,
    admin = ["Owner", "Admin"].includes(role),
    page = hash.slice(1).split("?")[0] || "dashboard",
    zone = zoneOverride || w.timezone;
  const service = (id) =>
      w.services.find((x) => x.id === id) || {
        name: "Archived service",
        color: "green",
        buffer: 0,
      },
    client = (id) =>
      w.clients.find((x) => x.id === id) || {
        name: "Client",
        email: "",
        tags: [],
      },
    staff = (id) =>
      w.staff.find((x) => x.id === id) || { name: "Former teammate" };
  const me = live
    ? w.staff.find(
        (s) => s.email.toLowerCase() === state.profile.email.toLowerCase(),
      )
    : role === "Staff"
      ? w.staff.find((s) => s.role === "Staff") || w.staff[0]
      : w.staff[0];
  const myClient = live
    ? w.clients.find(
        (c) => c.email.toLowerCase() === state.profile.email.toLowerCase(),
      )
    : w.clients[0];
  const bookings = w.bookings.filter((b) =>
    role === "Staff"
      ? b.staffId === me?.id
      : role === "Client"
        ? b.clientId === myClient?.id
        : true,
  );
  useEffect(() => {
    if (live) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      if (!storageUnavailable) {
        storageUnavailable = true;
        notify("Storage unavailable. Changes last for this session only.");
      }
    }
  }, [state, live, notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.setProperty("--company", w.color);
    document.title =
      (page === "landing"
        ? "Make room for what matters"
        : page[0].toUpperCase() + page.slice(1)) + " · BebinBook";
  }, [state.theme, w.color, page]);
  const refresh = useCallback(async () => {
    const workspaces = await api.list();
    setState((s) => ({
      ...s,
      workspaces: workspaces.length
        ? workspaces.map((next) => {
            const current = s.workspaces.find((w) => w.id === next.id);
            return current?.revision > next.revision ? current : next;
          })
        : [placeholder(s.profile)],
      active: workspaces.some((w) => w.id === s.active)
        ? s.active
        : workspaces[0]?.id || "pending",
    }));
  }, []);
  useEffect(() => {
    let canceled = false;
    api
      .me()
      .then(async (profile) => {
        const list = await api.list();
        if (canceled) return;
        setLive(true);
        setState((s) => ({
          ...s,
          profile,
          role: "Owner",
          active: list[0]?.id || "pending",
          workspaces: list.length ? list : [placeholder(profile)],
        }));
        if (!list.length && !location.hash.includes("public"))
          location.hash = "onboarding";
      })
      .catch(() => {})
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);
  useEffect(() => {
    const listener = () => {
      setHash(location.hash);
      setDialog(null);
      window.scrollTo(0, 0);
      setTimeout(
        () => document.getElementById("main")?.focus({ preventScroll: true }),
        0,
      );
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  async function mutate(fn, text = "Updated workspace") {
    if (busy.current)
      throw Error("Please wait for the current save to finish.");
    const current = stateRef.current,
      currentW =
        current.workspaces.find((x) => x.id === current.active) ||
        current.workspaces[0],
      next = structuredClone(currentW);
    fn(next);
    const activeRole = liveRef.current ? currentW.memberRole : current.role;
    if (
      !["Owner", "Admin"].includes(activeRole) &&
      ["Created mock API key", "Revoked mock API key"].includes(text)
    )
      throw Error("An admin role is required.");
    const log = { id: uid(), text, time: Date.now() };
    next.activity = [log, ...next.activity].slice(0, 25);
    next.audit = [
      { ...log, actor: current.profile.name, role: activeRole },
      ...next.audit,
    ].slice(0, 100);
    busy.current = true;
    setSaving(true);
    try {
      const saved = liveRef.current
        ? await api.save(currentW.id, next, currentW.revision)
        : next;
      setState((s) => ({
        ...s,
        workspaces: s.workspaces.map((x) => (x.id === currentW.id ? saved : x)),
      }));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const setPreferences = (values) => setState((s) => ({ ...s, ...values }));
  const switchWorkspace = (id) => {
    setState((s) => ({ ...s, active: id }));
    setZone("");
    setDialog(null);
  };
  async function enterLive(profile) {
    const list = await api.list();
    setLive(true);
    setState((s) => ({
      ...s,
      profile,
      active: list[0]?.id || "pending",
      workspaces: list.length ? list : [placeholder(profile)],
    }));
    if (!list.length) go("onboarding");
    return list.length;
  }
  function enterDemo(profile) {
    setLive(false);
    const demo = load();
    setState({ ...demo, profile: profile || demo.profile, role: "Owner" });
  }
  async function logout() {
    if (live) await api.logout();
    enterDemo();
    go("landing");
    notify("You’re signed out.");
  }
  async function addWorkspace(data) {
    const saved = live ? await api.create(data) : data;
    setState((s) => ({
      ...s,
      active: saved.id,
      role: "Owner",
      workspaces: [...s.workspaces.filter((w) => w.id !== "pending"), saved],
    }));
    setZone("");
  }
  function confirm(title, action, text) {
    show("confirm", { title, action, text });
  }
  async function removeBookings(ids) {
    const removed = w.bookings.filter((b) => ids.includes(b.id));
    await mutate(
      (next) => {
        next.bookings = next.bookings.filter((b) => !ids.includes(b.id));
      },
      "Deleted " + removed.length + " appointments",
    );
    close();
    notify(removed.length + " bookings deleted", "Undo", () =>
      run(() =>
        mutate((next) => {
          for (const b of removed) {
            if (!["cancelled", "no-show"].includes(b.status)) {
              const err = conflict(next, b, "", [], 0);
              if (err) throw Error("Cannot restore: " + err);
            }
            if (!next.bookings.some((x) => x.id === b.id))
              next.bookings.push(b);
          }
        }, "Restored deleted appointments"),
      ),
    );
  }
  async function status(ids, status) {
    if (role === "Client" && status !== "cancelled")
      throw Error("Clients can cancel their own appointments.");
    await mutate((next) => {
      const batch = next.bookings.filter((b) => ids.includes(b.id));
      for (const b of batch) {
        if (
          ["completed", "no-show"].includes(status) &&
          Date.parse(b.start) > Date.now()
        )
          throw Error(
            "Future appointments cannot be marked completed or no-show.",
          );
        if (status === "confirmed" && b.status === "cancelled") {
          const err = conflict(next, b, b.id) || quota(next, [b], b.id);
          if (err) throw Error(err);
        }
        b.status = status;
      }
    }, "Marked appointments " + status);
    notify("Booking status updated");
  }
  function changePlan(name) {
    if (role !== "Owner")
      return notify("Only the workspace owner can change billing.");
    const p = plans[name],
      counts = {};
    for (const b of w.bookings.filter((b) => b.status !== "cancelled")) {
      const m = parts(b.start, w.timezone).date.slice(0, 7);
      counts[m] = (counts[m] || 0) + 1;
    }
    if (
      w.staff.length + w.invites.length > p.seats ||
      Object.values(counts).some((n) => n > p.bookings)
    )
      return notify(
        "Usage exceeds this plan. Reduce team seats or bookings before downgrading.",
      );
    confirm(
      "Switch to " + name + "?",
      async () => {
        await mutate((next) => {
          next.plan = name;
          if (name === "Free")
            next.integrations = { google: false, zoom: false, stripe: false };
        }, "Changed plan to " + name);
        notify("Workspace is now on " + name);
      },
      "Simulated plan: $" + p.price + "/month. No payment is collected.",
    );
  }
  function link() {
    const url = new URL(location.href);
    url.hash = live
      ? "public?slug=" + encodeURIComponent(w.slug)
      : "public?workspace=" + encodeURIComponent(w.id);
    return url.href;
  }
  async function copy(text) {
    try {
      if (!navigator.clipboard) throw Error();
      await navigator.clipboard.writeText(text);
      notify("Copied to clipboard");
    } catch {
      show("copy", { text });
    }
  }
  function copyLink() {
    copy(link());
    if (!live)
      notify(
        "Demo links use data stored in this browser. Connected mode supports shared pages.",
      );
  }
  function exportCSV(records) {
    const rows = [
      [
        "Client",
        "Email",
        "Service",
        "Team",
        "Start (ISO)",
        "Timezone",
        "Duration (min)",
        "Status",
        "Amount (USD)",
      ],
      ...records.map((b) => [
        client(b.clientId).name,
        client(b.clientId).email,
        service(b.serviceId).name,
        staff(b.staffId).name,
        b.start,
        zone,
        b.duration,
        b.status,
        b.price,
      ]),
    ];
    const csv =
        "\uFEFF" +
        rows
          .map((r) =>
            r
              .map((v) => {
                let t = String(v);
                if (/^[=+@\-\t\r]/.test(t)) t = "'" + t;
                return '"' + t.replaceAll('"', '""') + '"';
              })
              .join(","),
          )
          .join("\r\n"),
      url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = w.slug + "-bookings.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Bookings exported as CSV");
  }
  async function simulate() {
    if (live || !admin)
      return notify("Simulation is available to demo admins.");
    const s = w.services[0],
      person = w.staff[0];
    if (!s || !person || !w.clients.length)
      return notify("Add a service, team member and client first.");
    for (let i = 1; i < 10; i++) {
      const date = addDays(dateKey(new Date(), w.timezone), i),
        times = slots(w, s, person, date, w.timezone);
      if (!times.length) continue;
      const c = w.clients[Math.floor(Math.random() * w.clients.length)],
        b = {
          id: uid(),
          clientId: c.id,
          serviceId: s.id,
          staffId: person.id,
          start: wallISO(date, times[0], w.timezone),
          duration: s.duration,
          price: s.price,
          status: "pending",
          recurring: false,
          notes: "Simulated incoming booking",
        },
        err = quota(w, [b]);
      if (err) throw Error(err);
      await mutate(
        (next) => next.bookings.push(b),
        c.name + " requested a " + s.name.toLowerCase(),
      );
      notify("New booking request from " + c.name, "View", () =>
        show("detail", b),
      );
      return;
    }
    notify("No open times found for this booking.");
  }
  const latest = useRef(null);
  latest.current = { show, go, simulate, page, live, admin, dialog, run };
  useEffect(() => {
    let prefix = "";
    const key = (e) => {
      const a = latest.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        a.show("command");
        return;
      }
      if (
        a.dialog ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.target.isContentEditable ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key === "n") {
        e.preventDefault();
        a.show("booking");
      }
      if (prefix === "g") {
        const map = { c: "calendar", d: "dashboard", b: "bookings" };
        if (map[e.key]) a.go(map[e.key]);
        prefix = "";
      } else if (e.key === "g") {
        prefix = "g";
        setTimeout(() => (prefix = ""), 1000);
      }
    };
    document.addEventListener("keydown", key);
    const timer = setInterval(() => {
      const a = latest.current;
      if (
        a.page === "dashboard" &&
        !a.live &&
        a.admin &&
        !a.dialog &&
        !document.hidden
      )
        a.run(a.simulate);
    }, 120000);
    return () => {
      document.removeEventListener("keydown", key);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (!busy.current && !document.hidden && !latest.current.dialog)
        refresh().catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, [live, refresh]);
  useEffect(() => {
    const params = new URLSearchParams(hash.split("?")[1]),
      id = params.get("workspace");
    if (id && !live)
      setState((s) =>
        s.workspaces.some((w) => w.id === id) ? { ...s, active: id } : s,
      );
  }, [hash, live]);
  async function saveProfile(d) {
    if (!d.name.trim()) throw Error("Enter your name.");
    const profile = live
      ? await api.profile({ name: d.name.trim() })
      : { name: d.name.trim(), email: d.email };
    setState((s) => ({ ...s, profile }));
    notify("Profile saved");
  }
  async function deleteWorkspace() {
    if (role !== "Owner")
      throw Error("Only the owner can delete this workspace.");
    if (state.workspaces.length < 2)
      throw Error(
        "Create another workspace before deleting your only workspace.",
      );
    if (live) await api.remove(w.id);
    setState((s) => ({
      ...s,
      workspaces: s.workspaces.filter((x) => x.id !== w.id),
      active: s.workspaces.find((x) => x.id !== w.id).id,
    }));
    go("dashboard");
    notify("Workspace deleted");
  }
  function reset() {
    if (live) throw Error("Reset is available only in the browser demo.");
    setState(seed());
    setZone("");
    go("dashboard");
    notify("Demo reset. A fresh start.");
  }
  const context = {
    state,
    w,
    role,
    admin,
    me,
    myClient,
    bookings,
    service,
    client,
    staff,
    zone,
    page,
    live,
    saving,
    dialog,
    show,
    close,
    go,
    notify,
    run,
    mutate,
    setPreferences,
    switchWorkspace,
    setZone,
    enterDemo,
    enterLive,
    logout,
    addWorkspace,
    confirm,
    removeBookings,
    status,
    changePlan,
    link,
    copy,
    copyLink,
    exportCSV,
    simulate: () => run(simulate),
    saveProfile,
    deleteWorkspace,
    reset,
    refresh,
  };
  const pages = {
    dashboard: Dashboard,
    calendar: Calendar,
    bookings: Bookings,
    clients: Clients,
    services: Services,
    staff: Team,
    "booking-page": BookingPage,
    analytics: Analytics,
    integrations: Integrations,
    settings: Settings,
    pricing: Pricing,
    audit: Audit,
    api: Developer,
  };
  let screen;
  if (loading)
    screen = (
      <main className="public-page" role="status">
        <div className="skeleton" />
        <div className="skeleton" />
        <p>Preparing your workspace…</p>
      </main>
    );
  else if (page === "landing") screen = <Landing />;
  else if (["login", "signup", "forgot"].includes(page))
    screen = <Auth key={page} type={page} />;
  else if (page === "onboarding") screen = <Onboarding />;
  else if (page === "public") screen = <PublicBooking key={hash} />;
  else {
    const Screen = pages[page];
    screen = (
      <Shell>
        {!permitted(role, page) ? (
          <Empty
            title="This page needs a different role"
            text="Your current role does not have access."
          >
            <a className="btn primary" href="#dashboard">
              Back to overview
            </a>
          </Empty>
        ) : Screen ? (
          <Screen key={page + w.id + (page === "settings" ? hash : "")} />
        ) : (
          <Empty
            title="This page wandered off"
            text="Choose a page from the navigation."
          />
        )}
      </Shell>
    );
  }
  return (
    <AppContext.Provider value={context}>
      <div id="app">
        <a
          className="skip"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main")?.focus();
          }}
        >
          Skip to content
        </a>
        {screen}
      </div>
      <Dialogs />
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name="check" />
            <span>{t.text}</span>
            {t.label && (
              <button
                onClick={() => {
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                  t.action?.();
                }}
              >
                {t.label}
              </button>
            )}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
