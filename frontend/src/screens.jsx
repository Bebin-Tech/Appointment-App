import React, { useMemo, useState } from "react";
import { useApp } from "./context.js";
import {
  Icon,
  Button,
  Avatar,
  Badge,
  Head,
  Empty,
  Field,
  Form,
  Zone,
  Days,
  Switch,
  tabKeyboard,
} from "./ui.jsx";
import {
  dateKey,
  parts,
  fmtDate,
  fmtTime,
  money,
  plans,
  addDays,
  zones,
  wallISO,
  uid,
} from "./domain.js";
import { conflict, quota } from "./scheduling.js";
export function Activity({ list }) {
  return list.length ? (
    list.map((x) => (
      <div className="activity-item" key={x.id}>
        <span className="activity-dot">
          <Icon name="calendar" />
        </span>
        <div>
          <p>{x.text}</p>
          <small>
            {Date.now() - x.time < 60000
              ? "Just now"
              : Date.now() - x.time < 3600000
                ? Math.floor((Date.now() - x.time) / 60000) + " min ago"
                : new Date(x.time).toLocaleString()}
          </small>
        </div>
      </div>
    ))
  ) : (
    <Empty title="All caught up" text="New activity will appear here." />
  );
}
export function Dashboard() {
  const a = useApp(),
    [tab, setTab] = useState("all"),
    { w, bookings, zone } = a;
  const today = dateKey(new Date(), zone),
    list = bookings
      .filter(
        (b) => parts(b.start, zone).date === today && b.status !== "cancelled",
      )
      .sort((a, b) => a.start.localeCompare(b.start));
  const month = bookings.filter((b) =>
    parts(b.start, zone).date.startsWith(today.slice(0, 7)),
  );
  const complete = month.filter((b) => b.status === "completed"),
    past = month.filter((b) => ["completed", "no-show"].includes(b.status));
  const stats = [
    [
      "Today’s appointments",
      list.length,
      "calendar",
      list.filter((b) => b.status === "confirmed").length + " confirmed",
    ],
    [
      "Revenue this month",
      money(complete.reduce((n, b) => n + b.price, 0)),
      "money",
      "From completed appointments",
    ],
    [
      "Active clients",
      new Set(month.map((b) => b.clientId)).size,
      "clients",
      "Clients booked this month",
    ],
    [
      "Attendance rate",
      past.length
        ? Math.round((complete.length / past.length) * 100) + "%"
        : "—",
      "analytics",
      "Completed vs. no-show",
    ],
  ];
  return (
    <>
      <Head
        title={a.role === "Client" ? "Your appointments" : "Overview"}
        text="A little clarity for your day ahead."
      >
        <span className="datebadge">
          <Icon name="calendar" />
          {fmtDate(today, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <Button kind="primary" icon="plus" onClick={() => a.show("booking")}>
          New booking
        </Button>
      </Head>
      <div className="welcome">
        <div className="welcome-art" aria-hidden="true" />
        <h2>
          Good{" "}
          {new Date().getHours() < 12
            ? "morning"
            : new Date().getHours() < 17
              ? "afternoon"
              : "evening"}
          ,{" "}
          {
            (a.role === "Client"
              ? a.myClient?.name
              : a.state.profile.name
            )?.split(" ")[0]
          }{" "}
          ☀
        </h2>
        <p>
          You have <strong>{list.length} appointments</strong> today. Let’s make
          every one count.
        </p>
      </div>
      <div className="metrics">
        {stats
          .filter((_, i) => a.role !== "Client" || [0, 3].includes(i))
          .map(([label, value, ic, sub]) => (
            <article className="metric" key={label}>
              <div className="metric-label">
                {label}
                <Icon name={ic} />
              </div>
              <div className="metric-value">{value}</div>
              <div className="metric-bottom">
                <strong>{sub}</strong>
                <svg className="spark" viewBox="0 0 65 24" aria-hidden="true">
                  <path d="M1 21l7-6 5 2 7-9 6 5 6-7 6 3 7-6 6 3 7-5 6 3" />
                </svg>
              </div>
            </article>
          ))}
      </div>
      <div className="dashgrid">
        <section className="panel">
          <div className="panelhead">
            <div className="row">
              <h2>Today’s schedule</h2>
              <span className="tag">{list.length} appointments</span>
            </div>
            <a className="link small" href="#calendar">
              View calendar ↗
            </a>
          </div>
          <div className="schedule-tabs">
            <div
              className="pillgroup"
              role="tablist"
              aria-label="Today’s appointments"
              onKeyDown={tabKeyboard}
            >
              {["all", "confirmed", "pending"].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                >
                  {t === "all"
                    ? "All appointments"
                    : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {list
            .filter((b) => tab === "all" || b.status === tab)
            .map((b) => (
              <div
                className="schedule-row"
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => a.show("detail", b)}
                onKeyDown={(e) => {
                  if (["Enter", " "].includes(e.key)) {
                    e.preventDefault();
                    a.show("detail", b);
                  }
                }}
              >
                <div className="schedule-time">
                  {fmtTime(b.start, zone).split(" ")[0]}
                  <small>
                    {fmtTime(b.start, zone).split(" ")[1]} · {b.duration} min
                  </small>
                </div>
                <div
                  className="schedule-line"
                  style={{
                    background:
                      a.service(b.serviceId).color === "green"
                        ? "var(--service-2)"
                        : a.service(b.serviceId).color === "blue"
                          ? "var(--service-3)"
                          : "var(--service-1)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="schedule-title">
                    {a.client(b.clientId).name}
                  </div>
                  <div className="schedule-meta">
                    {a.service(b.serviceId).name} ·{" "}
                    {a.staff(b.staffId).name.split(" ")[0]}
                  </div>
                </div>
                <Badge status={b.status} />
              </div>
            ))}
          {!list.filter((b) => tab === "all" || b.status === tab).length && (
            <Empty
              title="A little breathing room"
              text="No appointments in this view."
            >
              <Button onClick={() => a.show("booking")}>
                Create a booking
              </Button>
            </Empty>
          )}
          <div className="tablefoot">
            <span>{zone.replaceAll("_", " ")}</span>
            <span>
              {list.reduce((n, b) => n + b.duration, 0)} minutes of connection
            </span>
          </div>
        </section>
        <div className="dash-side">
          <section className="panel pad" style={{ marginBottom: 24 }}>
            <h2>Make it happen</h2>
            <p className="subtext">Your everyday shortcuts.</p>
            <div className="quicklinks">
              {[
                ["plus", "New booking", () => a.show("booking")],
                [
                  "staff",
                  a.admin ? "Invite a teammate" : "Book a time",
                  () => (a.admin ? a.show("invite") : a.go("public")),
                ],
                ["link", "Copy booking link", a.copyLink],
                [
                  "analytics",
                  a.admin ? "View reports" : "My appointments",
                  () => a.go(a.admin ? "analytics" : "bookings"),
                ],
              ].map(([ic, t, fn]) => (
                <button key={t} className="quicklink" onClick={fn}>
                  <Icon name={ic} />
                  {t}
                </button>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panelhead">
              <h2>Recent activity</h2>
              <span className="tag">
                <span className="badge-dot" style={{ color: "var(--brand)" }} />
                {a.live ? "Workspace" : "Live demo"}
              </span>
            </div>
            <div style={{ padding: "0 20px" }}>
              <Activity list={w.activity.slice(0, 3)} />
            </div>
            {!a.live && (
              <div style={{ padding: "10px 20px 16px" }}>
                <Button kind="sm" icon="bolt" onClick={a.simulate}>
                  Simulate incoming booking
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <section className="bookinglink">
        <div className="link-icon">
          <Icon name="globe" />
        </div>
        <div className="grow">
          <h3>Your next great connection starts here.</h3>
          <p>
            {w.name} · {w.services.length} bookable services
          </p>
        </div>
        <Button icon="external" onClick={() => a.go("public")}>
          Preview booking page
        </Button>
        <Button kind="sm desktop-only" icon="copy" onClick={a.copyLink}>
          Copy link
        </Button>
      </section>
    </>
  );
}
const statuses = [
  "all",
  "confirmed",
  "pending",
  "completed",
  "no-show",
  "cancelled",
];
export function Bookings() {
  const a = useApp(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [person, setPerson] = useState("all"),
    [selected, setSelected] = useState([]);
  const list = a.bookings
    .filter(
      (b) =>
        (filter === "all" || b.status === filter) &&
        (person === "all" || b.staffId === person) &&
        [
          a.client(b.clientId).name,
          a.client(b.clientId).email,
          a.service(b.serviceId).name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.start.localeCompare(a.start));
  const bulk = async (status) => {
    await a.status(selected, status);
    setSelected([]);
  };
  return (
    <>
      <Head
        title={a.role === "Client" ? "My bookings" : "Bookings"}
        text="Every appointment, in one place."
      >
        <Button kind="primary" icon="plus" onClick={() => a.show("booking")}>
          New booking
        </Button>
      </Head>
      <section className="panel">
        <div className="toolbar">
          <input
            className="input"
            aria-label="Search bookings"
            placeholder="Search clients or services…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input"
            aria-label="Filter status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setSelected([]);
            }}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
          {a.role !== "Client" && (
            <select
              className="input"
              aria-label="Filter team"
              value={person}
              onChange={(e) => {
                setPerson(e.target.value);
                setSelected([]);
              }}
            >
              <option value="all">All team members</option>
              {a.w.staff
                .filter((s) => a.role !== "Staff" || s.id === a.me?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          )}
          <span style={{ flex: 1 }} />
          <Button icon="download" onClick={() => a.exportCSV(list)}>
            Export CSV
          </Button>
        </div>
        {selected.length > 0 && (
          <div className="toolbar" style={{ background: "var(--surface2)" }}>
            <strong className="small">{selected.length} selected</strong>
            {a.role !== "Client" && (
              <Button kind="sm" onClick={() => a.run(() => bulk("confirmed"))}>
                Confirm
              </Button>
            )}
            <Button
              kind="sm"
              onClick={() =>
                a.confirm("Cancel selected bookings?", () => bulk("cancelled"))
              }
            >
              Cancel appointments
            </Button>
            <Button
              kind="sm danger"
              icon="trash"
              onClick={() =>
                a.confirm("Delete selected bookings?", async () => {
                  await a.removeBookings(selected);
                  setSelected([]);
                })
              }
            >
              Delete
            </Button>
          </div>
        )}
        {list.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all filtered bookings"
                      checked={
                        list.length > 0 &&
                        list.every((b) => selected.includes(b.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? list.map((b) => b.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Date & time</th>
                  <th>Team member</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={
                          "Select booking for " + a.client(b.clientId).name
                        }
                        checked={selected.includes(b.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, b.id]
                              : selected.filter((id) => id !== b.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="row">
                        <Avatar
                          name={a.client(b.clientId).name}
                          color={
                            a.service(b.serviceId).color === "green"
                              ? "green"
                              : ""
                          }
                        />
                        <div>
                          <strong>{a.client(b.clientId).name}</strong>
                          <div className="subtext">
                            {a.client(b.clientId).email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {a.service(b.serviceId).name}
                      {b.recurring ? " ↻" : ""}
                      <div className="subtext">{b.duration} minutes</div>
                    </td>
                    <td>
                      {fmtDate(parts(b.start, a.zone).date)}
                      <div className="subtext">{fmtTime(b.start, a.zone)}</div>
                    </td>
                    <td>{a.staff(b.staffId).name}</td>
                    <td>
                      <Badge status={b.status} />
                    </td>
                    <td>{money(b.price)}</td>
                    <td>
                      <button
                        className="iconbtn"
                        aria-label="Open appointment details"
                        onClick={() => a.show("detail", b)}
                      >
                        <Icon name="more" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No bookings found"
            text="Try another filter or create an appointment."
          >
            <Button onClick={() => a.show("booking")}>New booking</Button>
          </Empty>
        )}
        <div className="tablefoot">
          <span>
            {list.length} bookings · {a.zone}
          </span>
          <button className="link small" onClick={() => a.show("waitlist")}>
            {a.w.waitlist.length} on waitlist →
          </button>
        </div>
      </section>
    </>
  );
}
export function Calendar() {
  const a = useApp(),
    [date, setDate] = useState(dateKey(new Date(), a.zone)),
    [view, setView] = useState("week"),
    [over, setOver] = useState("");
  const day = (new Date(date + "T12:00Z").getUTCDay() + 6) % 7;
  const days =
    view === "day"
      ? [date]
      : Array.from({ length: 7 }, (_, i) => addDays(date, i - day));
  const today = dateKey(new Date(), a.zone),
    list = a.bookings.filter((b) => b.status !== "cancelled");
  function move(n) {
    if (view === "month") {
      const d = new Date(date.slice(0, 8) + "01T12:00Z");
      d.setUTCMonth(d.getUTCMonth() + n);
      setDate(d.toISOString().slice(0, 10));
    } else setDate(addDays(date, n * (view === "week" ? 7 : 1)));
  }
  async function drop(e, day, time) {
    e.preventDefault();
    setOver("");
    const b = a.w.bookings.find(
      (b) => b.id === e.dataTransfer.getData("text/bookflow"),
    );
    if (!b) return;
    const next = {
        ...b,
        start: wallISO(
          day,
          view === "month" ? parts(b.start, a.zone).time : time,
          a.zone,
        ),
      },
      error = conflict(a.w, next, b.id) || quota(a.w, [next], b.id);
    if (error) throw Error(error);
    await a.mutate(
      (w) => {
        w.bookings = w.bookings.map((x) => (x.id === b.id ? next : x));
      },
      "Moved " + a.client(b.clientId).name + "’s appointment",
    );
    a.notify("Appointment moved", "Undo", () =>
      a.run(async () => {
        const err = conflict(a.w, b, b.id);
        if (err) throw Error(err);
        await a.mutate((w) => {
          w.bookings = w.bookings.map((x) => (x.id === b.id ? b : x));
        }, "Undid appointment move");
      }),
    );
  }
  function event(b) {
    return (
      <button
        key={b.id}
        className={"cal-event " + a.service(b.serviceId).color}
        draggable={a.role !== "Client"}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/bookflow", b.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={(e) => {
          e.stopPropagation();
          a.show("detail", b);
        }}
      >
        <strong>{a.client(b.clientId).name}</strong>
        <span>
          {fmtTime(b.start, a.zone)} · {b.duration}m
        </span>
        <span>{a.service(b.serviceId).name}</span>
      </button>
    );
  }
  const start = date.slice(0, 8) + "01",
    offset = (new Date(start + "T12:00Z").getUTCDay() + 6) % 7;
  return (
    <>
      <Head title="Calendar" text="A little structure. A lot more flow.">
        <Button kind="primary" icon="plus" onClick={() => a.show("booking")}>
          New booking
        </Button>
      </Head>
      <section className="panel">
        <div className="calendar-toolbar">
          <div className="row">
            <button
              className="iconbtn"
              aria-label="Previous period"
              onClick={() => move(-1)}
            >
              <span style={{ transform: "rotate(180deg)", display: "flex" }}>
                <Icon name="chevron" />
              </span>
            </button>
            <button
              className="iconbtn"
              aria-label="Next period"
              onClick={() => move(1)}
            >
              <Icon name="chevron" />
            </button>
            <h2>
              {view === "week"
                ? fmtDate(days[0]) + " – " + fmtDate(days[6])
                : fmtDate(date, {
                    month: "long",
                    ...(view === "day" ? { day: "numeric" } : {}),
                    year: "numeric",
                  })}
            </h2>
            <Button kind="sm" onClick={() => setDate(today)}>
              Today
            </Button>
          </div>
          <div className="row wrap">
            <select
              aria-label="Calendar timezone"
              className="input"
              style={{ width: 160, minHeight: 32, fontSize: 11, padding: 5 }}
              value={a.zone}
              onChange={(e) => a.setZone(e.target.value)}
            >
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
            <div
              className="pillgroup"
              role="tablist"
              aria-label="Calendar view"
              onKeyDown={tabKeyboard}
            >
              {["day", "week", "month"].map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  tabIndex={view === v ? 0 : -1}
                  onClick={() => setView(v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="calendar-scroll">
          {view === "month" ? (
            <div className="month-grid" role="grid" aria-label="Month calendar">
              <div role="row" style={{ display: "contents" }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} role="columnheader" className="cal-heading">
                    {d}
                  </div>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, week) => (
                <div role="row" style={{ display: "contents" }} key={week}>
                  {Array.from({ length: 7 }, (_, i) =>
                    addDays(start, week * 7 + i - offset),
                  ).map((d) => (
                    <div
                      key={d}
                      role="gridcell"
                      className={
                        "month-cell " +
                        (d === today ? "today " : "") +
                        (d.slice(0, 7) !== date.slice(0, 7) ? "outside " : "") +
                        (over === d ? "over" : "")
                      }
                      aria-label={fmtDate(d)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOver(d);
                      }}
                      onDragLeave={() => setOver("")}
                      onDrop={(e) => a.run(() => drop(e, d, "09:00"))}
                    >
                      <button
                        onClick={() => {
                          setDate(d);
                          setView("day");
                        }}
                      >
                        {Number(d.slice(8))}
                      </button>
                      {list
                        .filter((b) => parts(b.start, a.zone).date === d)
                        .map(event)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div
              className={"calendar-grid " + (view === "day" ? "day" : "")}
              role="grid"
              aria-label={view + " calendar"}
              style={{
                gridTemplateColumns: `55px repeat(${days.length},minmax(0,1fr))`,
              }}
            >
              <div role="row" style={{ display: "contents" }}>
                <div className="cal-heading" role="columnheader">
                  Time
                </div>
                {days.map((d) => (
                  <div
                    key={d}
                    className={"cal-heading " + (d === today ? "today" : "")}
                    role="columnheader"
                  >
                    {fmtDate(d, { weekday: "short" })}
                    <strong>{Number(d.slice(8))}</strong>
                  </div>
                ))}
              </div>
              {Array.from({ length: 12 }, (_, i) => i + 8).map((h) => (
                <div role="row" style={{ display: "contents" }} key={h}>
                  <div className="time-label" role="rowheader">
                    {h > 12 ? h - 12 : h}
                    {h >= 12 ? " pm" : " am"}
                  </div>
                  {days.map((d) => {
                    const time = String(h).padStart(2, "0") + ":00",
                      key = d + time;
                    return (
                      <div
                        key={key}
                        role="gridcell"
                        tabIndex={0}
                        className={
                          "cal-cell " +
                          (over === key ? "over " : "") +
                          (d < today ? "past" : "")
                        }
                        aria-label={`${fmtDate(d)} ${time}. Enter to book.`}
                        onClick={() => a.show("booking", { date: d, time })}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            a.show("booking", { date: d, time });
                          }
                          const cells = [
                              ...e.currentTarget
                                .closest('[role="grid"]')
                                .querySelectorAll('[role="gridcell"]'),
                            ],
                            index = cells.indexOf(e.currentTarget);
                          const moves = {
                            ArrowRight: 1,
                            ArrowLeft: -1,
                            ArrowDown: days.length,
                            ArrowUp: -days.length,
                          };
                          if (moves[e.key]) {
                            e.preventDefault();
                            cells[index + moves[e.key]]?.focus();
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOver(key);
                        }}
                        onDragLeave={() => setOver("")}
                        onDrop={(e) => a.run(() => drop(e, d, time))}
                      >
                        {list
                          .filter((b) => {
                            const p = parts(b.start, a.zone);
                            return (
                              p.date === d && Number(p.time.slice(0, 2)) === h
                            );
                          })
                          .map(event)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="cal-tip">
          <Icon name="move" />
          Drag a booking to a new time. We’ll check availability before moving
          it. Touch or keyboard: open an appointment and choose Reschedule.
        </div>
      </section>
    </>
  );
}
export function Clients() {
  const a = useApp(),
    [q, setQ] = useState("");
  const list = a.w.clients.filter((c) =>
    (c.name + " " + c.email + " " + c.tags.join(" "))
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <>
      <Head
        title="Clients"
        text="Good relationships start with remembering the details."
      >
        <Button kind="primary" icon="plus" onClick={() => a.show("client")}>
          Add client
        </Button>
      </Head>
      <section className="panel">
        <div className="toolbar">
          <input
            className="input"
            aria-label="Search clients"
            placeholder="Search names, email or tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="muted small">{list.length} clients</span>
        </div>
        {list.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Tags</th>
                  <th>Appointments</th>
                  <th>Lifetime value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const bs = a.w.bookings.filter((b) => b.clientId === c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="row">
                          <Avatar name={c.name} />
                          <div>
                            <strong>{c.name}</strong>
                            <div className="subtext">{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {c.tags.map((t) => (
                          <span
                            className={"tag " + (t === "VIP" ? "purple" : "")}
                            key={t}
                          >
                            {t}
                          </span>
                        ))}
                      </td>
                      <td>
                        {bs.filter((b) => b.status !== "cancelled").length}
                      </td>
                      <td>
                        {money(
                          bs
                            .filter((b) => b.status === "completed")
                            .reduce((n, b) => n + b.price, 0),
                        )}
                      </td>
                      <td>
                        <Button kind="sm" onClick={() => a.show("client", c)}>
                          View profile
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No clients yet"
            text="Your next connection is a booking away."
          />
        )}
      </section>
    </>
  );
}
export function Services() {
  const a = useApp();
  return (
    <>
      <Head title="Services" text="Shape the time you share with your clients.">
        {a.admin && (
          <Button kind="primary" icon="plus" onClick={() => a.show("service")}>
            Add service
          </Button>
        )}
      </Head>
      <div className="grid3">
        {a.w.services.map((s) => (
          <article className="panel service-card" key={s.id}>
            <div
              className="service-band"
              style={{
                background:
                  s.color === "purple"
                    ? "var(--service-1)"
                    : s.color === "blue"
                      ? "var(--service-3)"
                      : "var(--service-2)",
              }}
            />
            <div className="pad">
              <span className="service-icon">
                <Icon name="services" />
              </span>
              <h2>{s.name}</h2>
              <p className="muted small" style={{ minHeight: 54 }}>
                {s.description}
              </p>
              {[
                ["Duration", s.duration + " minutes"],
                ["Price", s.price ? money(s.price) : "Complimentary"],
                ["Buffer after", s.buffer + " minutes"],
              ].map(([k, v]) => (
                <div className="service-detail" key={k}>
                  <span className="muted">{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
              <Button
                icon={a.admin ? "edit" : "arrow"}
                onClick={() =>
                  a.admin ? a.show("service", s) : a.go("public")
                }
              >
                {a.admin ? "Edit service" : "Book this service"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!a.w.services.length && (
        <Empty
          title="Create your first service"
          text="Give your clients something great to book."
        />
      )}
    </>
  );
}
export function Team() {
  const a = useApp();
  return (
    <>
      <Head title="Your team" text="Great work happens together.">
        {a.admin && (
          <Button kind="primary" icon="plus" onClick={() => a.show("invite")}>
            Invite teammate
          </Button>
        )}
      </Head>
      <div className="grid3">
        {a.w.staff.map((s, i) => (
          <article className="panel staff-card" key={s.id}>
            <Avatar name={s.name} color={["gold", "green", "blue"][i % 3]} />
            <h2>{s.name}</h2>
            <p className="subtext">{s.email}</p>
            <span className={"tag " + (s.role === "Owner" ? "purple" : "")}>
              {s.role}
            </span>
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="row between small">
              <span className="muted">Working hours</span>
              <span>
                {s.start} – {s.end}
              </span>
            </div>
            <p className="subtext" style={{ marginTop: 10 }}>
              {s.days
                .map(
                  (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d],
                )
                .join(" · ")}
            </p>
            {(a.admin || s.id === a.me?.id) && (
              <Button icon="calendar" onClick={() => a.show("availability", s)}>
                Edit availability
              </Button>
            )}
          </article>
        ))}
      </div>
      {a.w.invites.length > 0 && (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panelhead">
            <h2>Pending invitations</h2>
            <span className="tag">Simulated delivery</span>
          </div>
          <div className="pad stack">
            {a.w.invites.map((i) => (
              <div className="row between wrap" key={i.id}>
                <div>
                  <strong>{i.email}</strong>
                  <p className="subtext">
                    {i.role} ·{" "}
                    {a.live
                      ? "Sign up with this email to join"
                      : "No email sent"}
                  </p>
                </div>
                {a.admin && (
                  <Button
                    kind="sm danger"
                    onClick={() =>
                      a.run(() =>
                        a.mutate((w) => {
                          w.invites = w.invites.filter((x) => x.id !== i.id);
                        }, "Revoked team invitation"),
                      )
                    }
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function Pricing({ marketing = false }) {
  const a = useApp();
  return (
    <>
      {!marketing && (
        <Head
          title="A plan for your next chapter"
          text="Start small. Make room to grow. All prices are simulated."
        />
      )}
      <div className="grid3">
        {Object.entries(plans).map(([name, p]) => (
          <article
            className={"price-card " + (name === "Pro" ? "featured" : "")}
            key={name}
          >
            {name === "Pro" && <span className="popular">The sweet spot</span>}
            <h2>{name}</h2>
            <p className="subtext">
              {name === "Free"
                ? "For your first great connections."
                : name === "Pro"
                  ? "For a business finding its rhythm."
                  : "For teams with bigger possibilities."}
            </p>
            <div className="price">
              ${p.price}
              <small> / workspace / month</small>
            </div>
            <p className="help">No card needed in this demo</p>
            <ul>
              <li>
                {name === "Business"
                  ? "Unlimited"
                  : p.bookings.toLocaleString()}{" "}
                bookings per month
              </li>
              <li>
                {p.seats} team seat{p.seats > 1 ? "s" : ""}
              </li>
              <li>Branded booking page</li>
              <li>
                {name === "Free"
                  ? "Core scheduling & client records"
                  : "Recurring bookings & analytics"}
              </li>
              <li>
                {name === "Business"
                  ? "Developer API & audit log"
                  : name === "Pro"
                    ? "Calendar, Zoom & Stripe integrations"
                    : "CSV export & timezone support"}
              </li>
            </ul>
            {marketing ? (
              <a
                className={"btn " + (name === "Pro" ? "primary" : "")}
                href="#signup"
              >
                Get started <Icon name="arrow" />
              </a>
            ) : (
              <Button
                kind={name === "Pro" ? "primary" : ""}
                disabled={a.w.plan === name}
                onClick={() => a.changePlan(name)}
              >
                {a.w.plan === name ? "Current plan" : "Choose " + name}
              </Button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
export function Locked({
  title = "See the bigger picture",
  text = "This feature is available on Pro and Business.",
}) {
  return (
    <section className="panel restricted">
      <span className="service-icon" style={{ margin: "0 auto 20px" }}>
        <Icon name="bolt" />
      </span>
      <h1>{title}</h1>
      <p className="muted" style={{ margin: "16px 0 24px" }}>
        {text}
      </p>
      <a className="btn primary" href="#pricing">
        Explore plans <Icon name="arrow" />
      </a>
    </section>
  );
}
export function Analytics() {
  const a = useApp();
  if (a.w.plan === "Free") return <Locked />;
  const complete = a.bookings.filter((b) => b.status === "completed"),
    past = a.bookings.filter((b) =>
      ["completed", "no-show"].includes(b.status),
    ),
    total = complete.reduce((n, b) => n + b.price, 0);
  const bars = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(dateKey(new Date(), a.w.timezone), i - 6);
      return {
        date,
        value: complete
          .filter((b) => parts(b.start, a.w.timezone).date === date)
          .reduce((n, b) => n + b.price, 0),
      };
    }),
    max = Math.max(1, ...bars.map((b) => b.value));
  const heat = Array.from({ length: 5 }, (_, d) =>
      Array.from(
        { length: 9 },
        (_, h) =>
          a.bookings.filter(
            (b) =>
              b.status !== "cancelled" &&
              new Date(
                parts(b.start, a.w.timezone).date + "T12:00Z",
              ).getUTCDay() ===
                d + 1 &&
              Number(parts(b.start, a.w.timezone).time.slice(0, 2)) === h + 9,
          ).length,
      ),
    ),
    hmax = Math.max(1, ...heat.flat());
  return (
    <>
      <Head title="Analytics" text="Less guesswork. More perspective.">
        <Button icon="download" onClick={() => a.exportCSV(a.bookings)}>
          Export data
        </Button>
      </Head>
      <div className="metrics">
        {[
          ["Total revenue", money(total)],
          ["Completed appointments", complete.length],
          [
            "No-show rate",
            past.length
              ? Math.round(
                  ((past.length - complete.length) / past.length) * 100,
                ) + "%"
              : "—",
          ],
          [
            "Average booking",
            complete.length ? money(total / complete.length) : "—",
          ],
        ].map(([t, v]) => (
          <div className="metric" key={t}>
            <div className="metric-label">
              {t}
              <Icon name="analytics" />
            </div>
            <div className="metric-value">{v}</div>
            <p className="subtext">Based on workspace records</p>
          </div>
        ))}
      </div>
      <div className="grid2">
        <section className="panel pad">
          <h2>Revenue over time</h2>
          <p className="subtext">Completed bookings · last 7 days</p>
          <div
            className="chart"
            role="img"
            aria-label={bars
              .map((b) => fmtDate(b.date) + " " + money(b.value))
              .join(", ")}
          >
            {bars.map((b) => (
              <div className="chart-col" key={b.date}>
                <small>{money(b.value)}</small>
                <i
                  style={{ height: Math.max(1, (b.value / max) * 80) + "%" }}
                />
                <span>{fmtDate(b.date, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel pad">
          <h2>Your busiest hours</h2>
          <p className="subtext">All active bookings · {a.w.timezone}</p>
          <div
            className="heatmap"
            role="img"
            aria-label="Appointments by weekday and hour; darker cells mean busier"
          >
            <span />
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i}>{i + 9 > 12 ? i - 3 : i + 9}</span>
            ))}
            {heat.map((day, i) => (
              <React.Fragment key={i}>
                <span>{["Mon", "Tue", "Wed", "Thu", "Fri"][i]}</span>
                {day.map((v, h) => (
                  <i
                    key={h}
                    style={{ opacity: 0.08 + (v / hmax) * 0.92 }}
                    title={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][i]} ${h + 9}:00: ${v} bookings`}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
          <p className="help" style={{ marginTop: 20, textAlign: "right" }}>
            Light: less busy · Dark: more busy
          </p>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panelhead">
          <h2>Service performance</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Completed</th>
                <th>Revenue</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {a.w.services.map((s) => {
                const records = complete.filter((b) => b.serviceId === s.id),
                  rev = records.reduce((n, b) => n + b.price, 0);
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{records.length}</td>
                    <td>{money(rev)}</td>
                    <td>{total ? Math.round((rev / total) * 100) : 0}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function Integrations() {
  const a = useApp();
  return (
    <>
      <Head
        title="A well-connected workspace"
        text="Your favorite tools, working in the same rhythm."
      />
      <div className="grid3">
        {[
          [
            "google",
            "Google Calendar",
            "Keep your schedule in sync. Simulated two-way calendar connection.",
            "calendar",
          ],
          [
            "zoom",
            "Zoom",
            "A place to meet, automatically. Simulated booking meeting links.",
            "globe",
          ],
          [
            "stripe",
            "Stripe",
            "Make getting paid part of the flow. Simulated payment connection.",
            "money",
          ],
        ].map(([id, t, d, ic]) => (
          <article className="panel pad" key={id}>
            <div className="row between">
              <span className="service-icon">
                <Icon name={ic} />
              </span>
              <span
                className={"tag " + (a.w.integrations[id] ? "confirmed" : "")}
              >
                {a.w.integrations[id] ? "Connected" : "Not connected"}
              </span>
            </div>
            <h2 style={{ margin: "20px 0 10px" }}>{t}</h2>
            <p className="muted small" style={{ minHeight: 60 }}>
              {d}
            </p>
            <div className="divider" />
            <div className="row between">
              <span className="small">
                Demo connection{a.w.plan === "Free" ? " · Pro" : ""}
              </span>
              <Switch
                label={"Connect " + t}
                checked={a.w.integrations[id]}
                onChange={() =>
                  a.w.plan === "Free"
                    ? a.show("upgrade", { feature: "Integrations" })
                    : a.run(() =>
                        a.mutate(
                          (w) => {
                            w.integrations[id] = !w.integrations[id];
                          },
                          "Changed " + t + " demo connection",
                        ),
                      )
                }
              />
            </div>
          </article>
        ))}
      </div>
      <p className="help" style={{ marginTop: 20 }}>
        These switches save simulated connection states. No external account is
        accessed and no payments are processed.
      </p>
    </>
  );
}
export function Settings() {
  const a = useApp(),
    tab =
      new URLSearchParams(location.hash.split("?")[1]).get("tab") || "profile";
  const tabs = [
      ["profile", "My profile"],
      ...(a.admin ? [["workspace", "Workspace"]] : []),
      ["notifications", "Notifications"],
      ...(a.role === "Owner"
        ? [
            ["billing", "Plans & billing"],
            ["danger", "Danger zone"],
          ]
        : []),
    ],
    active = tabs.some((t) => t[0] === tab) ? tab : "profile";
  return (
    <>
      <Head title="Settings" text="The details that make this space yours." />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map(([id, t]) => (
            <a
              key={id}
              href={"#settings?tab=" + id}
              className={active === id ? "active" : ""}
              aria-current={active === id ? "page" : undefined}
            >
              {t}
            </a>
          ))}
        </nav>
        <section className="settings-content panel">
          <div className="panelhead">
            <h2>{tabs.find((t) => t[0] === active)?.[1]}</h2>
          </div>
          <div className="pad" key={active + a.w.id}>
            {active === "profile" && (
              <Form onSubmit={a.saveProfile} submit="Save profile">
                <Field
                  label="Full name"
                  name="name"
                  value={a.state.profile.name}
                  required
                  maxLength={80}
                />
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  value={a.state.profile.email}
                  required
                  disabled={a.live}
                />
                <p className="help" style={{ marginBottom: 20 }}>
                  {a.live
                    ? "Your account is authenticated by FastAPI."
                    : "Demo identity · use the profile menu to try another role."}
                </p>
              </Form>
            )}
            {active === "workspace" && (
              <Form
                submit="Save workspace"
                onSubmit={async (d, fd) => {
                  const days = fd.getAll("days").map(Number);
                  if (d.start >= d.end || !days.length)
                    throw Error(
                      "Choose valid working hours and at least one day.",
                    );
                  if (!d.name.trim()) throw Error("Enter a workspace name.");
                  await a.mutate(
                    (w) =>
                      Object.assign(w, {
                        name: d.name.trim(),
                        color: d.color,
                        timezone: d.timezone,
                        hours: { start: d.start, end: d.end, days },
                      }),
                    "Updated workspace settings",
                  );
                  a.notify("Workspace saved");
                }}
              >
                <Field
                  label="Workspace name"
                  name="name"
                  value={a.w.name}
                  required
                  maxLength={80}
                />
                <Field
                  label="Logo color"
                  name="color"
                  type="color"
                  value={a.w.color}
                />
                <Zone name="timezone" value={a.w.timezone} />
                <div className="grid2">
                  <Field
                    label="Workday starts"
                    name="start"
                    type="time"
                    value={a.w.hours.start}
                    required
                  />
                  <Field
                    label="Workday ends"
                    name="end"
                    type="time"
                    value={a.w.hours.end}
                    required
                  />
                </div>
                <Days days={a.w.hours.days} />
                <p className="help" style={{ marginBottom: 20 }}>
                  Existing appointments keep their exact scheduled instant.
                </p>
              </Form>
            )}
            {active === "notifications" && (
              <>
                {[
                  [
                    "email",
                    "Booking confirmations",
                    "An update when a client books or changes a time.",
                  ],
                  [
                    "reminders",
                    "Appointment reminders",
                    "A gentle nudge before each appointment.",
                  ],
                  [
                    "digest",
                    "Daily agenda",
                    "Tomorrow’s schedule, every evening.",
                  ],
                ].map(([id, t, d]) => (
                  <div className="setting-row" key={id}>
                    <div>
                      <h3>{t}</h3>
                      <p className="subtext">{d}</p>
                    </div>
                    <Switch
                      label={t}
                      checked={a.w.notifications[id]}
                      onChange={() =>
                        a.run(() =>
                          a.mutate((w) => {
                            w.notifications[id] = !w.notifications[id];
                          }, "Updated notification preferences"),
                        )
                      }
                    />
                  </div>
                ))}
                <p className="help" style={{ marginTop: 20 }}>
                  Preferences are saved. Message delivery is simulated.
                </p>
              </>
            )}
            {active === "billing" && <Billing />}
            {active === "danger" && (
              <>
                <h3>Reset browser demo</h3>
                <p className="muted small" style={{ margin: "10px 0 24px" }}>
                  Restore the sample workspaces and clear local demo changes.
                </p>
                <Button
                  kind="danger"
                  icon="trash"
                  disabled={a.live}
                  onClick={() =>
                    a.confirm("Reset all browser demo data?", a.reset)
                  }
                >
                  Reset demo data
                </Button>
                <div className="divider" />
                <h3>Delete this workspace</h3>
                <p className="muted small" style={{ margin: "10px 0 24px" }}>
                  Remove {a.w.name} and its records. This cannot be undone.
                </p>
                <Button
                  kind="danger"
                  icon="trash"
                  onClick={() =>
                    a.confirm(
                      "Permanently delete this workspace?",
                      a.deleteWorkspace,
                    )
                  }
                >
                  Delete workspace
                </Button>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function Billing() {
  const a = useApp(),
    w = a.w,
    p = plans[w.plan],
    n = w.bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        parts(b.start, w.timezone).date.startsWith(
          dateKey(new Date(), w.timezone).slice(0, 7),
        ),
    ).length;
  return (
    <>
      <div className="row between">
        <div>
          <span className="tag purple">{w.plan} plan</span>
          <h2 style={{ fontSize: 28, margin: "12px 0" }}>
            ${p.price}
            <span className="muted small"> / month</span>
          </h2>
          <p className="help">Demo subscription · no payment method</p>
        </div>
        <a className="btn primary" href="#pricing">
          Change plan
        </a>
      </div>
      <div className="divider" />
      <h3>Workspace usage</h3>
      {[
        ["Monthly bookings", n, p.bookings],
        [
          "Team seats (including invites)",
          w.staff.length + w.invites.length,
          p.seats,
        ],
      ].map(([t, n, max]) => (
        <div style={{ marginTop: 24 }} key={t}>
          <div className="row between small">
            <span>{t}</span>
            <span>
              {n} / {max === 100000 ? "Unlimited" : max}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: Math.min(100, (n / max) * 100) + "%" }} />
          </div>
          <p className="help">
            {n >= max
              ? "You’ve reached this plan’s limit."
              : max === 100000
                ? "Room to grow."
                : max - n + " remaining on your plan."}
          </p>
        </div>
      ))}
      <div className="divider" />
      <h3>Billing history</h3>
      <p className="muted small" style={{ marginTop: 10 }}>
        No invoices. Plan changes do not charge a card.
      </p>
    </>
  );
}
export function Audit() {
  const a = useApp();
  if (a.w.plan !== "Business")
    return (
      <Locked
        title="A clear record of every change"
        text="Audit logs are included with Business."
      />
    );
  return (
    <>
      <Head title="Audit log" text="A trail of the changes that matter." />
      <section className="panel">
        {a.w.audit.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {a.w.audit.map((x) => (
                  <tr key={x.id}>
                    <td>{x.text}</td>
                    <td>{x.actor}</td>
                    <td>{x.role}</td>
                    <td>{new Date(x.time).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="A fresh start"
            text="Actions you take in this workspace will appear here."
          />
        )}
      </section>
    </>
  );
}
export function Developer() {
  const a = useApp();
  if (a.w.plan !== "Business")
    return (
      <Locked
        title="Build your own connections"
        text="Mock API keys are available on Business."
      />
    );
  return (
    <>
      <Head
        title="Developer API"
        text="A foundation for your next integration. Mock keys only."
      >
        <Button kind="primary" icon="plus" onClick={() => a.show("key")}>
          Create mock key
        </Button>
      </Head>
      <section className="panel pad">
        <h2>Your API keys</h2>
        <p className="help" style={{ margin: "8px 0 24px" }}>
          These demo keys cannot authenticate requests.
        </p>
        {a.w.keys.length ? (
          a.w.keys.map((k) => (
            <div className="setting-row" key={k.id}>
              <div>
                <strong>{k.name}</strong>
                <p className="subtext mono">bf_demo_••••••••{k.last}</p>
                <p className="subtext">Created {fmtDate(k.date)}</p>
              </div>
              <Button
                kind="sm danger"
                onClick={() =>
                  a.run(() =>
                    a.mutate((w) => {
                      w.keys = w.keys.filter((x) => x.id !== k.id);
                    }, "Revoked mock API key"),
                  )
                }
              >
                Revoke
              </Button>
            </div>
          ))
        ) : (
          <Empty
            title="No keys yet"
            text="Create a mock key to explore the experience."
          />
        )}
        <div className="divider" />
        <h3>Example request</h3>
        <code style={{ marginTop: 12 }}>
          GET /api/v1/bookings
          <br />
          Authorization: Bearer bf_demo_your_mock_key
          <br />
          X-Workspace-ID: {a.w.id}
        </code>
        <p className="help" style={{ marginTop: 12 }}>
          Mock example only. Use the FastAPI /docs page for the implemented API.
        </p>
      </section>
    </>
  );
}
