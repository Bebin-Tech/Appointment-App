import React, { useState } from "react";
import { useApp, navigation, permitted } from "./context.js";
import {
  Modal,
  Form,
  Field,
  Zone,
  Days,
  Button,
  Icon,
  Avatar,
  Badge,
  Empty,
} from "./ui.jsx";
import {
  parts,
  fmtDate,
  fmtTime,
  dateKey,
  addDays,
  money,
  plans,
  uid,
} from "./domain.js";
import { createSeries } from "./scheduling.js";
import { Activity } from "./screens.jsx";
export default function Dialogs() {
  const a = useApp(),
    { dialog, close } = a;
  if (!dialog) return null;
  const { type, data: d = {} } = dialog;
  let title = "",
    body = null,
    wide = false;
  if (type === "booking") {
    const b = d.id ? a.w.bookings.find((x) => x.id === d.id) : null,
      p = b ? parts(b.start, a.zone) : null;
    title = b ? "Reschedule appointment" : "Make a little time";
    wide = true;
    body = (
      <Form
        submit={b ? "Save new time" : "Create booking"}
        onSubmit={async (values) => {
          const batch = createSeries(a.w, { ...values, id: b?.id });
          if (!a.w.clients.some((c) => c.id === values.clientId))
            throw Error("Add a client before booking.");
          await a.mutate(
            (w) => {
              w.bookings = b
                ? w.bookings.map((x) => (x.id === b.id ? batch[0] : x))
                : [...w.bookings, ...batch];
            },
            b
              ? "Rescheduled appointment"
              : `Created ${batch.length} appointment${batch.length > 1 ? "s" : ""}`,
          );
          close();
          a.notify(
            b
              ? "Appointment rescheduled"
              : batch.length > 1
                ? batch.length + " recurring appointments created"
                : "You’re booked. A little more flow.",
          );
        }}
      >
        <div className="grid2">
          <Field
            label="Client"
            name="clientId"
            required
            value={b?.clientId || a.myClient?.id}
            options={(a.role === "Client"
              ? a.w.clients.filter((c) => c.id === a.myClient?.id)
              : a.w.clients
            ).map((c) => ({ value: c.id, label: c.name }))}
          />
          <Field
            label="Service"
            name="serviceId"
            required
            value={b?.serviceId || a.w.services[0]?.id}
            options={a.w.services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>
        <div className="grid2">
          <Field
            label="Team member"
            name="staffId"
            required
            value={
              b?.staffId || (a.role === "Staff" ? a.me?.id : a.w.staff[0]?.id)
            }
            options={a.w.staff
              .filter((s) => a.role !== "Staff" || s.id === a.me?.id)
              .map((s) => ({ value: s.id, label: s.name }))}
          />
          <Zone value={a.zone} />
        </div>
        <div className="grid2">
          <Field
            label="Date"
            name="date"
            type="date"
            value={p?.date || d.date || addDays(dateKey(new Date(), a.zone), 1)}
            required
            min={dateKey(new Date(), a.zone)}
          />
          <Field
            label="Start time"
            name="time"
            type="time"
            value={p?.time || d.time || "10:00"}
            required
            step={900}
          />
        </div>
        {!b && (
          <div className="grid2">
            <Field
              label="Repeat"
              name="repeat"
              value="none"
              options={[
                { value: "none", label: "Does not repeat" },
                { value: "weekly", label: "Weekly · Pro" },
                { value: "fortnightly", label: "Every 2 weeks · Pro" },
              ]}
            />
            <Field
              label="Number of appointments"
              name="count"
              type="number"
              value={4}
              min={2}
              max={12}
            />
          </div>
        )}
        <Field
          label="Appointment note (optional)"
          name="notes"
          type="textarea"
          value={b?.notes || ""}
          maxLength={1000}
        />
        <p className="help" style={{ marginBottom: 20 }}>
          Working hours, timezones and buffers are checked before saving.
          Recurring series are saved together only if every appointment is
          available.
        </p>
      </Form>
    );
  } else if (type === "detail") {
    const b = a.w.bookings.find((x) => x.id === d.id);
    if (!b) return null;
    title = "Appointment details";
    wide = true;
    body = (
      <>
        <div className="row">
          <Avatar name={a.client(b.clientId).name} />
          <div>
            <h2>{a.client(b.clientId).name}</h2>
            <p className="subtext">{a.client(b.clientId).email}</p>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Badge status={b.status} />
          </span>
        </div>
        <div className="divider" />
        {[
          ["Service", a.service(b.serviceId).name],
          [
            "When",
            fmtDate(parts(b.start, a.zone).date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            }) +
              " · " +
              fmtTime(b.start, a.zone),
          ],
          ["Timezone", a.zone],
          ["With", a.staff(b.staffId).name],
          ["Duration", b.duration + " minutes"],
          ["Amount", money(b.price)],
          [
            "Recurrence",
            b.recurring ? "Part of a recurring series" : "One-time appointment",
          ],
        ].map(([k, v]) => (
          <div className="service-detail" key={k}>
            <span className="muted">{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
        {b.notes && (
          <p className="help" style={{ marginTop: 16 }}>
            {b.notes}
          </p>
        )}
        {a.role !== "Client" && (
          <div className="row wrap" style={{ marginTop: 20 }}>
            {["confirmed", "completed", "no-show"].map((s) => (
              <Button
                key={s}
                kind="sm"
                disabled={s === b.status}
                onClick={() =>
                  a.run(async () => {
                    await a.status([b.id], s);
                    close();
                  })
                }
              >
                Mark {s}
              </Button>
            ))}
          </div>
        )}
        <div className="divider" />
        <div className="row wrap">
          <Button
            kind="danger"
            icon="trash"
            onClick={() =>
              a.confirm("Delete this appointment?", () =>
                a.removeBookings([b.id]),
              )
            }
          >
            Delete
          </Button>
          <Button
            disabled={b.status === "cancelled"}
            onClick={() =>
              a.confirm("Cancel this appointment?", () =>
                a.status([b.id], "cancelled"),
              )
            }
          >
            Cancel appointment
          </Button>
          <Button kind="primary" onClick={() => a.show("booking", b)}>
            Reschedule
          </Button>
        </div>
      </>
    );
  } else if (type === "client") {
    title = d.id ? "Client profile" : "A new connection";
    body = (
      <>
        <Form
          submit="Save client"
          onSubmit={async (values) => {
            if (!values.name.trim()) throw Error("Enter a name.");
            if (
              a.w.clients.some(
                (c) =>
                  c.id !== d.id &&
                  c.email.toLowerCase() === values.email.toLowerCase(),
              )
            )
              throw Error("A client with this email already exists.");
            const c = {
              id: d.id || uid(),
              name: values.name.trim(),
              email: values.email.trim(),
              tags: values.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 8),
              notes: values.notes,
            };
            await a.mutate((w) => {
              w.clients = d.id
                ? w.clients.map((x) => (x.id === d.id ? c : x))
                : [...w.clients, c];
            }, "Saved client " + c.name);
            close();
            a.notify("Client saved");
          }}
        >
          <Field
            label="Full name"
            name="name"
            value={d.name || ""}
            required
            maxLength={100}
          />
          <Field
            label="Email address"
            name="email"
            type="email"
            value={d.email || ""}
            required
            maxLength={160}
          />
          <Field
            label="Tags (comma separated)"
            name="tags"
            value={d.tags?.join(", ") || ""}
            maxLength={160}
          />
          <Field
            label="Private notes"
            name="notes"
            type="textarea"
            value={d.notes || ""}
            maxLength={2000}
          />
        </Form>
        {d.id && (
          <>
            <div className="divider" />
            <h3>Appointment history</h3>
            <div style={{ maxHeight: 220, overflow: "auto" }}>
              {a.bookings
                .filter((b) => b.clientId === d.id)
                .sort((a, b) => b.start.localeCompare(a.start))
                .map((b) => (
                  <div className="service-detail" key={b.id}>
                    <div>
                      {a.service(b.serviceId).name}
                      <p className="subtext">
                        {fmtDate(parts(b.start, a.zone).date)} ·{" "}
                        {fmtTime(b.start, a.zone)}
                      </p>
                    </div>
                    <Badge status={b.status} />
                  </div>
                ))}
            </div>
          </>
        )}
      </>
    );
  } else if (type === "service") {
    title = d.id ? "Edit service" : "Create a service";
    body = (
      <Form
        submit="Save service"
        onSubmit={async (values) => {
          if (!values.name.trim()) throw Error("Enter a service name.");
          const s = {
            ...values,
            id: d.id || uid(),
            name: values.name.trim(),
            duration: Number(values.duration),
            price: Number(values.price),
            buffer: Number(values.buffer),
          };
          await a.mutate((w) => {
            w.services = d.id
              ? w.services.map((x) => (x.id === d.id ? s : x))
              : [...w.services, s];
          }, "Saved service " + s.name);
          close();
          a.notify("Service saved");
        }}
      >
        <Field
          label="Service name"
          name="name"
          value={d.name || ""}
          required
          maxLength={80}
        />
        <Field
          label="Description"
          name="description"
          type="textarea"
          value={d.description || ""}
          maxLength={500}
        />
        <div className="grid2">
          <Field
            label="Duration (minutes)"
            name="duration"
            type="number"
            value={d.duration || 30}
            required
            min={15}
            max={240}
            step={15}
          />
          <Field
            label="Price (USD)"
            name="price"
            type="number"
            value={d.price || 0}
            required
            min={0}
            max={100000}
          />
        </div>
        <div className="grid2">
          <Field
            label="Buffer after (minutes)"
            name="buffer"
            type="number"
            value={d.buffer ?? 15}
            min={0}
            max={120}
            step={5}
            required
          />
          <Field
            label="Calendar color"
            name="color"
            value={d.color || "green"}
            options={["purple", "green", "blue"]}
          />
        </div>
        <p className="help" style={{ marginBottom: 20 }}>
          Existing bookings retain their original duration and price.
        </p>
      </Form>
    );
  } else if (type === "invite") {
    title = "Good work takes good people";
    const limit =
      a.w.staff.length + a.w.invites.length >= plans[a.w.plan].seats;
    body = limit ? (
      <>
        <h2>Your team has filled this plan.</h2>
        <p className="muted" style={{ margin: "12px 0 24px" }}>
          Upgrade to make room for another teammate.
        </p>
        <a className="btn primary" href="#pricing">
          Explore plans
        </a>
      </>
    ) : (
      <Form
        submit="Prepare invite"
        onSubmit={async (values) => {
          if (
            a.w.invites.some(
              (i) => i.email.toLowerCase() === values.email.toLowerCase(),
            ) ||
            a.w.staff.some(
              (s) => s.email.toLowerCase() === values.email.toLowerCase(),
            )
          )
            throw Error(
              "This person is already a member or has a pending invite.",
            );
          await a.mutate(
            (w) => w.invites.push({ id: uid(), ...values }),
            "Invited " + values.email,
          );
          close();
          a.notify(
            a.live
              ? "Invitation prepared. They can sign up with this email."
              : "Demo invitation prepared. No email sent.",
          );
        }}
      >
        <Field
          label="Email address"
          name="email"
          type="email"
          required
          maxLength={160}
        />
        <Field
          label="Workspace role"
          name="role"
          value="Staff"
          options={
            a.role === "Owner"
              ? ["Staff", "Admin", "Client"]
              : ["Staff", "Client"]
          }
        />
        <p className="help" style={{ marginBottom: 20 }}>
          No email is sent. Pending invites count toward the seat limit.{" "}
          {a.live ? "A matching account joins when it next logs in." : ""}
        </p>
      </Form>
    );
  } else if (type === "availability") {
    title = "Availability · " + d.name;
    body = (
      <Form
        submit="Save availability"
        onSubmit={async (values, fd) => {
          const days = fd.getAll("days").map(Number);
          if (values.start >= values.end || !days.length)
            throw Error("Choose valid hours and at least one working day.");
          await a.mutate((w) => {
            w.staff = w.staff.map((s) =>
              s.id === d.id ? { ...s, ...values, days } : s,
            );
          }, "Updated availability for " + d.name);
          close();
          a.notify("Availability saved");
        }}
      >
        <p className="help" style={{ marginBottom: 20 }}>
          Hours in {a.w.timezone}. Existing appointments are preserved.
        </p>
        <div className="grid2">
          <Field
            label="Starts"
            name="start"
            type="time"
            value={d.start}
            required
          />
          <Field label="Ends" name="end" type="time" value={d.end} required />
        </div>
        <Days days={d.days} />
      </Form>
    );
  } else if (type === "profile") {
    title = "Make yourself at home";
    body = (
      <>
        <div className="row">
          <Avatar name={a.state.profile.name} color="gold" />
          <div>
            <h2>{a.state.profile.name}</h2>
            <p className="subtext">{a.state.profile.email}</p>
          </div>
        </div>
        <div className="divider" />
        {a.live ? (
          <>
            <Badge status="active" />
            <p className="help" style={{ margin: "12px 0 20px" }}>
              Authenticated as {a.role}. Server permissions come from your
              workspace membership.
            </p>
          </>
        ) : (
          <>
            <Field
              label="Explore a demo role"
              name="demo-role"
              value={a.role}
              options={["Owner", "Admin", "Staff", "Client"]}
              onChange={(e) => {
                a.setPreferences({ role: e.target.value });
                close();
                if (!permitted(e.target.value, a.page)) a.go("dashboard");
              }}
            />
            <p className="help">
              Staff uses{" "}
              {a.w.staff.find((s) => s.role === "Staff")?.name ||
                a.w.staff[0]?.name}
              ’s calendar. Client uses {a.w.clients[0]?.name}’s profile. Role
              switching is available only in browser demo mode.
            </p>
          </>
        )}
        <div className="divider" />
        <div className="stack">
          <a className="btn" href="#settings">
            <Icon name="settings" />
            Profile settings
          </a>
          <a className="btn" href="#onboarding">
            <Icon name="plus" />
            Create another workspace
          </a>
          <Button icon="logout" onClick={() => a.run(a.logout)}>
            {a.live ? "Log out" : "Leave demo workspace"}
          </Button>
        </div>
      </>
    );
  } else if (type === "notifications") {
    title = "Your workspace, in motion";
    body = (
      <div className="notification-list">
        <Activity list={a.w.activity} />
      </div>
    );
  } else if (type === "command") {
    title = "A little shortcut";
    body = <Command />;
  } else if (type === "navigation") {
    title = "Your workspace";
    body = (
      <nav className="stack">
        {navigation
          .filter(([id]) => permitted(a.role, id))
          .map(([id, t, ic]) => (
            <a
              key={id}
              className="btn"
              style={{ justifyContent: "flex-start" }}
              href={"#" + id}
            >
              <Icon name={ic} />
              {t}
            </a>
          ))}
      </nav>
    );
  } else if (type === "waitlist") {
    title = "Waitlist";
    body = a.w.waitlist.length ? (
      a.w.waitlist.map((x) => (
        <div className="setting-row" key={x.id}>
          <div>
            <h3>{x.name}</h3>
            <p className="subtext">
              {x.email} · {fmtDate(x.date)} · {a.service(x.serviceId).name}
            </p>
          </div>
          {a.admin && (
            <Button
              kind="sm"
              onClick={() =>
                a.run(async () => {
                  await a.mutate((w) => {
                    w.waitlist = w.waitlist.filter((i) => i.id !== x.id);
                  }, "Removed waitlist entry");
                  close();
                })
              }
            >
              Remove
            </Button>
          )}
        </div>
      ))
    ) : (
      <Empty
        title="Nobody waiting"
        text="Waitlist requests from the booking page appear here."
      />
    );
  } else if (type === "upgrade") {
    title = "A little more room to grow";
    body = (
      <>
        <span className="service-icon" style={{ marginBottom: 16 }}>
          <Icon name="bolt" />
        </span>
        <h2>{d.feature || "This feature"} is a premium feature.</h2>
        <p className="muted" style={{ margin: "12px 0 24px" }}>
          Explore Pro for recurring bookings, analytics and integrations, or
          Business for audit logs and API access. Plan changes are simulated.
        </p>
        <a className="btn primary" href="#pricing">
          Explore plans <Icon name="arrow" />
        </a>
      </>
    );
  } else if (type === "embed") {
    title = "Bring your booking page along";
    const embed = `<iframe src="${a.link()}" title="Book an appointment" width="100%" height="850" style="border:0"></iframe>`;
    body = (
      <>
        <p className="help" style={{ marginBottom: 20 }}>
          {a.live
            ? "Use your hosted frontend URL when embedding on another site."
            : "The browser demo link works with this browser’s local data. Use connected mode for a shareable booking page."}
        </p>
        <code>{embed}</code>
        <Button
          kind="primary"
          icon="copy"
          style={{ marginTop: 20 }}
          onClick={() => a.copy(embed)}
        >
          Copy embed code
        </Button>
      </>
    );
  } else if (type === "key") {
    title = "Create a mock API key";
    body = (
      <Form
        submit="Create mock key"
        onSubmit={async (values) => {
          if (!values.name.trim()) throw Error("Name your mock key.");
          const token = "bf_demo_" + uid().replaceAll("-", "");
          await a.mutate(
            (w) =>
              w.keys.push({
                id: uid(),
                name: values.name.trim(),
                last: token.slice(-4),
                date: dateKey(),
              }),
            "Created mock API key",
          );
          a.show("key-created", { token });
        }}
      >
        <Field label="Key name" name="name" required maxLength={80} />
        <p className="help" style={{ marginBottom: 20 }}>
          Creates a non-functional demo key. Only its suffix will be stored.
        </p>
      </Form>
    );
  } else if (type === "key-created") {
    title = "Your new mock key";
    body = (
      <>
        <p className="help" style={{ marginBottom: 16 }}>
          Copy it now. Only its last four characters are saved.
        </p>
        <code>{d.token}</code>
        <Button
          kind="primary"
          style={{ marginTop: 20 }}
          onClick={() => a.copy(d.token)}
        >
          Copy mock key
        </Button>
      </>
    );
  } else if (type === "confirm") {
    title = d.title;
    body = (
      <>
        <p className="muted" style={{ marginBottom: 24 }}>
          {d.text || "Please confirm this change."}
        </p>
        <Form
          submit="Confirm"
          onSubmit={async () => {
            await d.action();
            close();
          }}
        >
          <Button type="button" style={{ marginRight: 8 }} onClick={close}>
            Go back
          </Button>
        </Form>
      </>
    );
  } else if (type === "copy") {
    title = "Copy this text";
    body = (
      <Field
        label="Select and copy"
        name="copy"
        type="textarea"
        value={d.text}
        readOnly
        onFocus={(e) => e.target.select()}
      />
    );
  }
  return (
    <Modal title={title} onClose={close} wide={wide} key={type + (d.id || "")}>
      {body}
    </Modal>
  );
}
function Command() {
  const a = useApp(),
    [q, setQ] = useState("");
  const items = [
    ...navigation
      .filter(([id]) => permitted(a.role, id))
      .map(([id, label, ic]) => ({
        id,
        label,
        ic,
        action: () => {
          a.close();
          a.go(id);
        },
      })),
    {
      id: "new",
      label: "New booking",
      ic: "plus",
      action: () => a.show("booking"),
    },
    ...(a.role !== "Client"
      ? a.w.clients.map((c) => ({
          id: c.id,
          label: c.name,
          ic: "clients",
          action: () => a.show("client", c),
        }))
      : []),
  ]
    .filter((x) => x.label.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 12);
  return (
    <div
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          const buttons = [
              ...e.currentTarget.querySelectorAll(".command-result"),
            ],
            current = buttons.indexOf(document.activeElement),
            i =
              e.key === "ArrowDown"
                ? (current + 1) % buttons.length
                : (current - 1 + buttons.length) % buttons.length;
          buttons[i]?.focus();
        }
      }}
    >
      <input
        aria-label="Search pages and clients"
        className="command-input"
        placeholder="Where would you like to go?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="command-results">
        {items.map((x) => (
          <button key={x.id} className="command-result" onClick={x.action}>
            <Icon name={x.ic} />
            {x.label}
            <small>↵</small>
          </button>
        ))}
        {!items.length && (
          <Empty title="No results" text="Try calendar or a client’s name." />
        )}
      </div>
      <p className="help">
        ↑ ↓ to move · Enter to open · Esc to close · N new booking · G then C
        calendar
      </p>
    </div>
  );
}
