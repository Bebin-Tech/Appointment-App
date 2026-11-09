import React, { useEffect, useState } from "react";
import { useApp } from "./context.js";
import { Button, Icon, Head, Field, Zone, Form, Empty } from "./ui.jsx";
import { slots, conflict, quota } from "./scheduling.js";
import {
  dateKey,
  addDays,
  fmtDate,
  fmtTime,
  money,
  initials,
  wallISO,
  uid,
  localZone,
} from "./domain.js";
import { api } from "./api.js";
export function BookingPage() {
  const a = useApp();
  return (
    <>
      <Head
        title="Your door is always open"
        text="A booking page that feels like your business."
      >
        <Button icon="copy" onClick={() => a.show("embed")}>
          Embed code
        </Button>
        <Button kind="primary" icon="link" onClick={a.copyLink}>
          Copy link
        </Button>
      </Head>
      <section className="panel pad">
        <div className="row between wrap">
          <div className="row">
            <span className="workspace-icon">{initials(a.w.name)}</span>
            <div>
              <h2>{a.w.name}</h2>
              <p className="subtext">bookflow / {a.w.slug}</p>
            </div>
          </div>
          <Button icon="external" onClick={() => a.go("public")}>
            Open public preview
          </Button>
        </div>
      </section>
      <div style={{ marginTop: 24 }}>
        <PublicBooking embedded />
      </div>
    </>
  );
}
export function PublicBooking({ embedded = false }) {
  const a = useApp(),
    slug = new URLSearchParams(location.hash.split("?")[1]).get("slug"),
    [external, setExternal] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(Boolean(slug && !embedded)),
    [date, setDate] = useState(addDays(dateKey(), 1)),
    [zone, setZone] = useState(localZone),
    [serviceId, setService] = useState(""),
    [personId, setPerson] = useState(""),
    [time, setTime] = useState(""),
    [contact, setContact] = useState(false),
    [success, setSuccess] = useState(null),
    [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!slug || embedded) return;
    let ignore = false;
    api
      .publicGet(slug)
      .then((w) => {
        if (!ignore) setExternal(w);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [slug, embedded]);
  const w = external || a.w,
    s = w.services.find((x) => x.id === serviceId) || w.services[0],
    person = w.staff.find((x) => x.id === personId) || w.staff[0];
  if (loading)
    return (
      <div className="public-page" role="status">
        <div className="skeleton" />
        Loading booking page…
      </div>
    );
  if (error) return <Empty title="Booking page unavailable" text={error} />;
  if (!s || !person)
    return (
      <Empty
        title="No services available"
        text="This workspace is preparing its booking page."
      />
    );
  const available = slots(w, s, person, date, zone);
  const dates = Array.from({ length: 7 }, (_, i) =>
    addDays(dateKey(new Date(), zone), i),
  );
  async function book(d) {
    if (!d.name.trim()) throw Error("Enter your name.");
    const start = wallISO(date, time, zone);
    if (external || a.live) {
      await api.publicBook(w.slug, {
        name: d.name,
        email: d.email,
        serviceId: s.id,
        staffId: person.id,
        start,
      });
      const updated = await api.publicGet(w.slug);
      setExternal(updated);
      if (a.live) await a.refresh();
    } else {
      const b = {
        id: uid(),
        serviceId: s.id,
        staffId: person.id,
        start,
        duration: s.duration,
        price: s.price,
        status: "confirmed",
        recurring: false,
        notes: "Booked through public page",
      };
      const err = conflict(w, b) || quota(w, [b]);
      if (err) throw Error(err);
      await a.mutate(
        (w) => {
          let c = w.clients.find(
            (c) => c.email.toLowerCase() === d.email.toLowerCase(),
          );
          if (!c) {
            c = {
              id: uid(),
              name: d.name.trim(),
              email: d.email,
              tags: ["New"],
              notes: "",
            };
            w.clients.push(c);
          }
          b.clientId = c.id;
          w.bookings.push(b);
        },
        d.name + " booked " + s.name + " through the booking page",
      );
    }
    setSuccess({ ...d, start });
    setContact(false);
    setTime("");
  }
  async function wait(d) {
    if (external || a.live) {
      await api.waitlist(w.slug, { ...d, date, serviceId: s.id });
    } else
      await a.mutate((w) => {
        if (
          w.waitlist.some(
            (x) =>
              x.email === d.email && x.date === date && x.serviceId === s.id,
          )
        )
          throw Error("You are already on this waitlist.");
        w.waitlist.push({ id: uid(), ...d, date, serviceId: s.id });
      }, d.name + " joined the waitlist");
    setWaiting(false);
    a.notify("Waitlist request saved. Notification delivery is simulated.");
  }
  const widget = (
    <>
      {!embedded && (
        <header className="public-header">
          <a href="#landing" className="small muted">
            Powered by BookFlow ↗
          </a>
          <div
            className="workspace-icon"
            style={{ marginTop: 24, background: w.color }}
          >
            {initials(w.name)}
          </div>
          <h1>{w.name}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Good things start with a conversation.
          </p>
        </header>
      )}
      {success ? (
        <section className="panel pad" role="status">
          <span className="service-icon">
            <Icon name="check" />
          </span>
          <h1 style={{ marginTop: 20 }}>
            You’re booked, {success.name.split(" ")[0]}.
          </h1>
          <p className="muted" style={{ margin: "16px 0" }}>
            {s.name} with {person.name}
            <br />
            {fmtDate(date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            at {fmtTime(success.start, zone)}
            <br />
            {zone}
          </p>
          <p className="help" style={{ marginBottom: 20 }}>
            Confirmation email and payment are simulated.
          </p>
          <Button onClick={() => setSuccess(null)}>Book another time</Button>
        </section>
      ) : (
        <section className="panel booking-widget">
          <div className="booking-intro">
            <span className="service-icon">
              <Icon name="calendar" />
            </span>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            <div className="divider" />
            <div className="row small">
              <Icon name="clock" />
              {s.duration} minutes
            </div>
            <div className="row small" style={{ marginTop: 14 }}>
              <Icon name="money" />
              {s.price ? money(s.price) : "Complimentary"}
            </div>
            <div className="row small" style={{ marginTop: 14 }}>
              <Icon name="staff" />
              With {person.name}
            </div>
            <p style={{ marginTop: 24, fontSize: 11 }}>
              A little time. A meaningful connection.
            </p>
          </div>
          <div className="booking-options">
            {contact ? (
              <>
                <h2>You’re one step away.</h2>
                <p className="subtext" style={{ marginBottom: 24 }}>
                  {fmtDate(date)} · {time} · {zone}
                </p>
                <Form submit="Confirm booking" onSubmit={book}>
                  <Field
                    label="Your name"
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                  />
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                    autoComplete="email"
                  />
                  <p className="help" style={{ marginBottom: 20 }}>
                    No payment required. Notification delivery is simulated.
                  </p>
                </Form>
                <button
                  className="link small"
                  style={{ marginTop: 20 }}
                  onClick={() => setContact(false)}
                >
                  ← Choose a different time
                </button>
              </>
            ) : waiting ? (
              <>
                <h2>A spot for you, when one opens.</h2>
                <p className="subtext" style={{ marginBottom: 20 }}>
                  {fmtDate(date)} · {s.name}
                </p>
                <Form submit="Join waitlist" onSubmit={wait}>
                  <Field
                    label="Your name"
                    name="name"
                    required
                    maxLength={100}
                  />
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                  />
                </Form>
                <button
                  className="link small"
                  style={{ marginTop: 20 }}
                  onClick={() => setWaiting(false)}
                >
                  ← Go back
                </button>
              </>
            ) : (
              <>
                <h2>Find your moment</h2>
                <p className="subtext">
                  Choose a service, a day, and a time that works.
                </p>
                <div className="grid2" style={{ gap: 12, marginTop: 24 }}>
                  <Field
                    label="Service"
                    name="public-service"
                    options={w.services.map((x) => ({
                      value: x.id,
                      label: x.name,
                    }))}
                    value={s.id}
                    onChange={(e) => {
                      setService(e.target.value);
                      setTime("");
                    }}
                  />
                  <Field
                    label="Team member"
                    name="public-staff"
                    options={w.staff.map((x) => ({
                      value: x.id,
                      label: x.name,
                    }))}
                    value={person.id}
                    onChange={(e) => {
                      setPerson(e.target.value);
                      setTime("");
                    }}
                  />
                </div>
                <div className="row between">
                  <h3>{fmtDate(date, { month: "long", year: "numeric" })}</h3>
                  <input
                    aria-label="Choose booking date"
                    className="input"
                    style={{
                      width: 145,
                      padding: 6,
                      fontSize: 11,
                      minHeight: 32,
                    }}
                    type="date"
                    min={dateKey(new Date(), zone)}
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDate(e.target.value);
                        setTime("");
                      }
                    }}
                  />
                </div>
                <div className="booking-days">
                  {dates.map((d) => (
                    <button
                      key={d}
                      className={
                        "booking-day " + (date === d ? "selected" : "")
                      }
                      aria-pressed={date === d}
                      onClick={() => {
                        setDate(d);
                        setTime("");
                      }}
                    >
                      <small>{fmtDate(d, { weekday: "short" })}</small>
                      <strong>{Number(d.slice(8))}</strong>
                    </button>
                  ))}
                </div>
                <div className="slots">
                  {available.map((t) => (
                    <button
                      className={"slot " + (time === t ? "selected" : "")}
                      key={t}
                      aria-pressed={time === t}
                      onClick={() => setTime(t)}
                    >
                      {fmtTime(wallISO(date, t, zone), zone)}
                    </button>
                  ))}
                </div>
                {!available.length && (
                  <>
                    <Empty
                      title="No open times this day"
                      text="Try another day or join the waitlist."
                    />
                    <Button kind="sm" onClick={() => setWaiting(true)}>
                      Join waitlist
                    </Button>
                  </>
                )}
                <div style={{ marginTop: 24 }}>
                  <Zone
                    name="public-zone"
                    value={zone}
                    onChange={(e) => {
                      setZone(e.target.value);
                      setTime("");
                    }}
                  />
                </div>
                <Button
                  kind="primary"
                  style={{ width: "100%" }}
                  disabled={!time}
                  icon="arrow"
                  onClick={() => setContact(true)}
                >
                  Continue
                </Button>
                <p
                  className="help"
                  style={{ textAlign: "center", marginTop: 12 }}
                >
                  No payment required ·{" "}
                  {external || a.live
                    ? "Saved with FastAPI"
                    : "Saved in this browser"}
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
  return embedded ? (
    widget
  ) : (
    <main className="public-page" id="main">
      {widget}
      <p className="small muted" style={{ textAlign: "center", margin: 24 }}>
        <a href="#dashboard">← Back to workspace</a>
      </p>
    </main>
  );
}
