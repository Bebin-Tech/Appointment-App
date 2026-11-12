import React from "react";
import { useApp, navigation, permitted } from "./context.js";
import { Logo, Icon, Avatar } from "./ui.jsx";
import { dateKey, parts, plans, initials } from "./domain.js";
export default function Shell({ children }) {
  const a = useApp(),
    { w, state, role, page, show, notify } = a;
  const count = w.bookings.filter(
    (b) =>
      b.status !== "cancelled" &&
      parts(b.start, w.timezone).date.startsWith(
        dateKey(new Date(), w.timezone).slice(0, 7),
      ),
  ).length;
  return (
    <div className={state.collapsed ? "collapsed" : ""}>
      <aside className="sidebar" aria-label="Main navigation">
        <Logo />
        <nav className="sidenav">
          {navigation
            .filter(
              ([id]) =>
                !["settings", "audit", "api"].includes(id) &&
                permitted(role, id),
            )
            .map(([id, label, ic]) => (
              <a
                href={"#" + id}
                title={label}
                key={id}
                className={"navitem " + (page === id ? "active" : "")}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon name={ic} />
                <span className="navlabel">{label}</span>
                {id === "bookings" && (
                  <span className="count">
                    {a.bookings.filter((b) => b.status === "pending").length}
                  </span>
                )}
              </a>
            ))}
        </nav>
        <div className="sidegroup">Workspace</div>
        <nav className="sidenav">
          {navigation
            .filter(
              ([id]) =>
                ["settings", "audit", "api"].includes(id) &&
                permitted(role, id),
            )
            .map(([id, t, ic]) => (
              <a
                key={id}
                href={"#" + id}
                className={"navitem " + (page === id ? "active" : "")}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon name={ic} />
                <span className="navlabel">{t}</span>
              </a>
            ))}
        </nav>
        <div className="sidebottom">
          <div className="planbox">
            <div className="row between">
              <strong style={{ color: "var(--text)" }}>
                {w.plan} workspace
              </strong>
              ✧
            </div>
            <div className="subtext" style={{ color: "var(--nav-muted)" }}>
              {count} / {w.plan === "Business" ? "∞" : plans[w.plan].bookings}{" "}
              monthly bookings
            </div>
            <div className="progress">
              <span
                style={{
                  width:
                    Math.min(100, (count / plans[w.plan].bookings) * 100) + "%",
                }}
              />
            </div>
            <a className="link" href="#pricing">
              Explore plans →
            </a>
          </div>
          <button
            className="sideprofile"
            style={{
              background: "none",
              borderLeft: 0,
              borderRight: 0,
              borderBottom: 0,
              width: "100%",
              textAlign: "left",
            }}
            onClick={() => show("profile")}
          >
            <Avatar name={state.profile.name} color="gold" />
            <span>
              <strong>{state.profile.name}</strong>
              <span className="subtext" style={{ display: "block" }}>
                {role} · {w.name}
              </span>
            </span>
            <Icon name="down" />
          </button>
        </div>
      </aside>
      <div className="appmain">
        <header className="topbar">
          <div className="row">
            <button
              className="iconbtn desktop-only"
              aria-label="Toggle sidebar"
              onClick={() => a.setPreferences({ collapsed: !state.collapsed })}
            >
              <Icon name="menu" />
            </button>
            <div className="workspace-select">
              <span className="workspace-icon">{initials(w.name)}</span>
              <label className="visually-hidden" htmlFor="workspace-select">
                Workspace
              </label>
              <select
                id="workspace-select"
                value={w.id}
                onChange={(e) => a.switchWorkspace(e.target.value)}
              >
                {state.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="topright">
            <button
              className="search-trigger"
              aria-label="Search BebinBook"
              onClick={() => show("command")}
            >
              <Icon name="search" />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="iconbtn"
              aria-label={
                "Switch to " +
                (state.theme === "light" ? "dark" : "light") +
                " mode"
              }
              onClick={() =>
                a.setPreferences({
                  theme: state.theme === "light" ? "dark" : "light",
                })
              }
            >
              <Icon name={state.theme === "light" ? "sun" : "moon"} />
            </button>
            <button
              className="iconbtn bell"
              aria-label="Notifications"
              onClick={() => show("notifications")}
            >
              <Icon name="bell" />
            </button>
            <button
              className="iconbtn"
              aria-label="Profile and demo role"
              onClick={() => show("profile")}
            >
              <Avatar name={state.profile.name} color="gold" />
            </button>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          <div className="breadcrumb">
            Workspace <Icon name="chevron" />{" "}
            <span>{navigation.find((n) => n[0] === page)?.[1] || "Plans"}</span>
          </div>
          {a.saving && (
            <div
              className="small muted"
              role="status"
              style={{ marginBottom: 12 }}
            >
              Saving to FastAPI…
            </div>
          )}
          {children}
          <footer className="footer-note">
            <span>Made for your time. Built for your business.</span>
            <span>
              {a.live ? "FastAPI connected" : "Browser demo"} · {role}
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottomnav" aria-label="Mobile navigation">
        {[
          ["dashboard", "Home", "dashboard"],
          ["calendar", "Calendar", "calendar"],
          ["bookings", "Bookings", "bookings"],
          ["booking-page", "Share", "link"],
        ]
          .filter(([id]) => permitted(role, id))
          .map(([id, t, ic]) => (
            <a key={id} className={page === id ? "active" : ""} href={"#" + id}>
              <Icon name={ic} />
              {t}
            </a>
          ))}
        <button onClick={() => show("navigation")}>
          <Icon name="menu" />
          More
        </button>
      </nav>
    </div>
  );
}
