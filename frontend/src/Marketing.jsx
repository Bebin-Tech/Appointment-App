import React, { useState } from "react";
import { Logo, Icon, Button, Form, Field, Zone, Days } from "./ui.jsx";
import { useApp } from "./context.js";
import { Pricing } from "./screens.jsx";
import {
  dateKey,
  addDays,
  fmtDate,
  seedWorkspace,
  uid,
  localZone,
} from "./domain.js";
import { api } from "./api.js";
export function Landing() {
  const a = useApp(),
    [day, setDay] = useState(addDays(dateKey(), 1)),
    [time, setTime] = useState("");
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <Logo />
        <nav className="row" aria-label="Marketing navigation">
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("features")
                ?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion:reduce)")
                    .matches
                    ? "instant"
                    : "smooth",
                });
            }}
          >
            Why BookFlow
          </a>
          <a href="#pricing">Pricing</a>
          <a href="#login">Log in</a>
          <a className="btn primary" href="#signup">
            Find your flow <Icon name="arrow" />
          </a>
        </nav>
      </header>
      <main id="main">
        <section className="hero">
          <div>
            <span
              className="tag"
              style={{
                background: "var(--lime)",
                color: "#2c4a30",
                marginBottom: 24,
              }}
            >
              A little less admin. A lot more possibility.
            </span>
            <h1>
              Make room for
              <br />
              what <em>matters.</em>
            </h1>
            <p>
              Meet BookFlow. The thoughtful scheduling platform that brings your
              team, your clients, and your time into a better rhythm.
            </p>
            <div className="row wrap">
              <a href="#signup" className="btn primary">
                Start your workspace <Icon name="arrow" />
              </a>
              <a href="#dashboard" className="btn">
                Explore the live demo
              </a>
            </div>
            <div className="hero-note muted">
              Free to start. No credit card. Just a little more breathing room.
            </div>
          </div>
          <div className="hero-demo">
            <div className="row between">
              <div className="row">
                <span className="workspace-icon">F</span>
                <strong>Form Studio</strong>
              </div>
              <span className="tag confirmed">
                <span className="badge-dot" />
                Live booking demo
              </span>
            </div>
            <h3>Your next good conversation.</h3>
            <p style={{ fontSize: 12, margin: "6px 0 20px" }}>
              A discovery call · 30 minutes · Complimentary
            </p>
            <div className="row between">
              <strong className="small">Choose a day</strong>
              <span className="small muted">
                {fmtDate(day, { month: "long" })}
              </span>
            </div>
            <div className="booking-days">
              {Array.from({ length: 5 }, (_, i) =>
                addDays(dateKey(), i + 1),
              ).map((d) => (
                <button
                  key={d}
                  className={"booking-day " + (day === d ? "selected" : "")}
                  aria-pressed={day === d}
                  onClick={() => setDay(d)}
                >
                  <small>{fmtDate(d, { weekday: "short" })}</small>
                  <strong>{Number(d.slice(8))}</strong>
                </button>
              ))}
            </div>
            <div className="slots">
              {["09:00", "10:30", "14:00"].map((t) => (
                <button
                  key={t}
                  className={"slot " + (time === t ? "selected" : "")}
                  aria-pressed={time === t}
                  onClick={() => setTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button
              kind="primary"
              style={{ width: "100%", marginTop: 20 }}
              icon="arrow"
              onClick={() =>
                time ? a.go("public") : a.notify("Choose a time to continue.")
              }
            >
              Find my time
            </Button>
            <div
              className="row"
              style={{
                justifyContent: "center",
                marginTop: 16,
                color: "var(--muted)",
                fontSize: 10,
              }}
            >
              <Icon name="shield" />
              Your time, thoughtfully protected.
            </div>
          </div>
        </section>
        <div className="trustbar">
          <span style={{ fontSize: 11, fontWeight: 400 }}>
            Made for teams like yours
          </span>
          <span>form® studio</span>
          <span>northstar ↗</span>
          <span>Layers & Co.</span>
          <span>◌ goodspace</span>
        </div>
        <section className="marketing-section" id="features">
          <h2>Everything clicks into place.</h2>
          <p>One calm home for a beautifully busy business.</p>
          <div className="grid3">
            {[
              [
                "calendar",
                "A schedule that just works",
                "Share availability, avoid overlaps, and move appointments with a simple drag. More time doing what you love.",
              ],
              [
                "clients",
                "People, not just appointments",
                "Remember the little details. Client notes, history, and preferences together so every meeting feels personal.",
              ],
              [
                "analytics",
                "Clarity for what comes next",
                "See revenue, understand your busiest hours, and find the patterns that help your business grow.",
              ],
            ].map(([ic, t, d]) => (
              <article className="feature" key={t}>
                <Icon name={ic} />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="marketing-section" style={{ paddingTop: 30 }}>
          <h2>Room for every stage.</h2>
          <p>Simple plans. A clear path forward.</p>
          <Pricing marketing />
        </section>
        <section className="marketing-section faq">
          <h2>A few things you might wonder.</h2>
          {[
            [
              "Can I try it before signing up?",
              "Absolutely. Explore the demo workspace with sample bookings, clients and services. Browser mode needs no backend.",
            ],
            [
              "Can my whole team use BookFlow?",
              "Each workspace has its own team, availability, services and booking page. Pro includes five seats; Business includes twenty-five.",
            ],
            [
              "Will clients need an account?",
              "No. Clients can choose a service, a time and enter their contact details on your public booking page.",
            ],
            [
              "Does this connect to real services?",
              "The Python FastAPI server handles authentication, workspace storage and scheduling. Billing, password reset delivery and integrations are simulated.",
            ],
            [
              "Where is the data stored?",
              "Browser demo changes stay in localStorage. Connected accounts store their workspace in the backend SQLite database.",
            ],
          ].map(([q, answer]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>
        <section className="marketing-section">
          <div className="cta">
            <div>
              <h2>A better rhythm starts here.</h2>
              <p>Give your business a little more room to grow.</p>
            </div>
            <a href="#signup" className="btn lime">
              Create your workspace <Icon name="arrow" />
            </a>
          </div>
        </section>
      </main>
      <footer className="marketing-nav">
        <span className="muted small">
          © {new Date().getFullYear()} BookFlow · Interactive product demo
        </span>
        <a className="link small" href="#dashboard">
          Open demo workspace ↗
        </a>
      </footer>
    </div>
  );
}
export function Auth({ type }) {
  const a = useApp(),
    [demo, setDemo] = useState(false),
    [sent, setSent] = useState(false),
    signup = type === "signup",
    forgot = type === "forgot";
  async function submit(d) {
    if (forgot) {
      if (!demo) await api.reset(d.email);
      setSent(true);
      return;
    }
    if (demo) {
      a.enterDemo({ name: d.name || "Olivia Bennett", email: d.email });
      a.go(signup ? "onboarding" : "dashboard");
    } else {
      const profile = await (signup ? api.signup(d) : api.login(d));
      const count = await a.enterLive(profile);
      a.go(count ? "dashboard" : "onboarding");
    }
  }
  return (
    <div className="authpage">
      <aside className="authaside">
        <Logo />
        <div>
          <h2>
            Your time.
            <br />
            Your people.
            <br />A better flow.
          </h2>
          <p>A thoughtful home for a beautifully busy business.</p>
        </div>
        <small style={{ color: "#9ab4a3" }}>Make room for what matters.</small>
      </aside>
      <main className="authmain" id="main">
        <div className="authform">
          <h1>
            {forgot
              ? "A fresh start"
              : signup
                ? "Find your flow."
                : "Welcome back."}
          </h1>
          <p>
            {forgot
              ? "We’ll simulate a password reset for you."
              : signup
                ? "Create a workspace that works your way."
                : "Your next great day starts here."}
          </p>
          {sent ? (
            <div role="status">
              <h2>Reset request simulated.</h2>
              <p className="help" style={{ margin: "12px 0 24px" }}>
                A real service would email a reset link if the account exists.
                No email is sent in this prototype.
              </p>
              <a className="btn primary" href="#login">
                Back to login
              </a>
            </div>
          ) : (
            <Form
              onSubmit={submit}
              submit={
                forgot
                  ? "Request demo reset"
                  : signup
                    ? "Create account"
                    : demo
                      ? "Log in to browser demo"
                      : "Log in with FastAPI"
              }
            >
              {signup && (
                <Field
                  label="Your name"
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                />
              )}
              <Field
                label="Email address"
                name="email"
                type="email"
                required
                maxLength={160}
                autoComplete="email"
              />
              {!forgot && (
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                />
              )}
              <label className="small row" style={{ marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => setDemo(e.target.checked)}
                />{" "}
                Use browser-only demo (no backend)
              </label>
              {!signup && !forgot && (
                <p style={{ textAlign: "right", margin: "-5px 0 20px" }}>
                  <a className="link small" href="#forgot">
                    Forgot password?
                  </a>
                </p>
              )}
            </Form>
          )}
          <p className="help" style={{ marginTop: 16 }}>
            {demo
              ? "Demo credentials are never stored. Use any email and an 8+ character password."
              : "Connected mode requires the FastAPI server. Passwords are hashed on the server."}
          </p>
          <div className="authlinks">
            {signup ? (
              <>
                Already have a workspace?{" "}
                <a className="link" href="#login">
                  Log in
                </a>
              </>
            ) : (
              <a className="link" href="#signup">
                Create a workspace
              </a>
            )}
          </div>
          <div className="authlinks">
            <a className="muted" href="#dashboard">
              Explore without signing up ↗
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
export function Onboarding() {
  const a = useApp(),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState({});
  async function submit(data, fd) {
    const d = { ...draft, ...data };
    if (step < 3) {
      setDraft(d);
      setStep(step + 1);
      return;
    }
    const days = fd.getAll("days").map(Number);
    if (d.start >= d.end || !days.length)
      throw Error("Choose valid working hours and at least one day.");
    if (!d.company.trim() || !d.service.trim())
      throw Error("Enter a company and service name.");
    const w = seedWorkspace(uid(), d.company.trim(), d.color, "Free");
    w.slug =
      d.company
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70) || "workspace";
    w.timezone = d.timezone;
    w.hours = { start: d.start, end: d.end, days };
    w.bookings = [];
    w.clients = [
      {
        id: uid(),
        name: a.state.profile.name,
        email: a.state.profile.email,
        tags: ["New"],
        notes: "",
      },
    ];
    w.staff = [
      {
        id: uid(),
        name: a.state.profile.name,
        email: a.state.profile.email,
        role: "Owner",
        start: d.start,
        end: d.end,
        days,
      },
    ];
    w.services = [
      {
        id: uid(),
        name: d.service.trim(),
        duration: Number(d.duration),
        price: Number(d.price),
        buffer: 15,
        description: "A little time to connect.",
        color: "green",
      },
    ];
    w.activity = [
      {
        id: uid(),
        text: "Your workspace is ready. Welcome to BookFlow!",
        time: Date.now(),
      },
    ];
    await a.addWorkspace(w);
    a.go("dashboard");
    a.notify("Your workspace is ready. Find your flow.");
  }
  return (
    <>
      <header className="marketing-nav">
        <Logo />
        <span className="muted small">Step {step} of 3</span>
      </header>
      <main id="main" className="onboard">
        <div className="steps" aria-label={"Step " + step + " of 3"}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= step ? "active" : ""} />
          ))}
        </div>
        <h1>
          {
            ["Let’s make it yours.", "What do you offer?", "Find your rhythm."][
              step - 1
            ]
          }
        </h1>
        <p>
          {
            [
              "First, a little about your company.",
              "Start with one service. You can add more later.",
              "Set the hours you’re happy to share.",
            ][step - 1]
          }
        </p>
        <Form
          key={step}
          onSubmit={submit}
          submit={step === 3 ? "Launch workspace" : "Continue"}
        >
          {step === 1 ? (
            <>
              <Field
                label="Company name"
                name="company"
                value={draft.company || ""}
                required
                maxLength={80}
                placeholder="e.g. Goodspace Studio"
              />
              <Field
                label="Logo color"
                name="color"
                type="color"
                value={draft.color || "#4c7962"}
              />
              <Zone name="timezone" value={draft.timezone || localZone} />
            </>
          ) : step === 2 ? (
            <>
              <Field
                label="Service name"
                name="service"
                value={draft.service || "Discovery call"}
                required
                maxLength={80}
              />
              <div className="grid2">
                <Field
                  label="Duration (minutes)"
                  name="duration"
                  type="number"
                  value={draft.duration || 30}
                  required
                  min={15}
                  max={240}
                  step={15}
                />
                <Field
                  label="Price (USD)"
                  name="price"
                  type="number"
                  value={draft.price || 0}
                  required
                  min={0}
                  max={100000}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid2">
                <Field
                  label="Workday starts"
                  name="start"
                  type="time"
                  value={draft.start || "09:00"}
                  required
                />
                <Field
                  label="Workday ends"
                  name="end"
                  type="time"
                  value={draft.end || "17:00"}
                  required
                />
              </div>
              <Days />
              <p className="help" style={{ marginBottom: 20 }}>
                Your workspace starts on Free: 50 bookings a month and one seat.
              </p>
            </>
          )}
        </Form>
        {step > 1 && (
          <button
            className="link small"
            style={{ marginTop: 24 }}
            onClick={() => setStep(step - 1)}
          >
            ← Back
          </button>
        )}
      </main>
    </>
  );
}
