import React, { useEffect, useRef, useState } from "react";
import { icons } from "./icons.js";
import { initials, zones } from "./domain.js";
export function tabKeyboard(e) {
  const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement);
  const keys = {
    ArrowRight: (current + 1) % tabs.length,
    ArrowLeft: (current - 1 + tabs.length) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  };
  if (keys[e.key] !== undefined) {
    e.preventDefault();
    tabs[keys[e.key]]?.focus();
    tabs[keys[e.key]]?.click();
  }
}
export function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name] || icons.calendar} />
    </svg>
  );
}
export function Logo() {
  return (
    <a href="#landing" className="logo" aria-label="BebinBook home">
      <img
        className="brand-logo-image"
        src="/bebinbook-logo.png"
        alt=""
        width="40"
        height="40"
      />
      <span className="logo-name">
        Bebin<span className="brand-word-accent">Book</span>
      </span>
    </a>
  );
}
export function Button({ children, icon, kind = "", ...props }) {
  return (
    <button className={"btn " + kind} {...props}>
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
export function Avatar({ name = "", color = "" }) {
  return (
    <span className={"avatar " + color} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function Badge({ status }) {
  return (
    <span className={"tag " + status}>
      <span className="badge-dot" />
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
export function Head({ title, text, children }) {
  return (
    <div className="screenhead">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="row wrap">{children}</div>
    </div>
  );
}
export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <Icon name="calendar" />
      <h3>{title}</h3>
      <p>{text}</p>
      {children && <div style={{ marginTop: 20 }}>{children}</div>}
    </div>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  options,
  ...props
}) {
  return (
    <div className="field">
      <label htmlFor={"f-" + name}>{label}</label>
      {options ? (
        <select id={"f-" + name} name={name} defaultValue={value} {...props}>
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          id={"f-" + name}
          name={name}
          defaultValue={value}
          {...props}
        />
      ) : (
        <input
          id={"f-" + name}
          name={name}
          type={type}
          defaultValue={value}
          {...props}
        />
      )}
    </div>
  );
}
export function Zone({ name = "zone", value, ...props }) {
  return (
    <Field
      label="Timezone"
      name={name}
      value={value}
      options={zones}
      {...props}
    />
  );
}
export function Days({ days = [1, 2, 3, 4, 5] }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: "0 0 20px" }}>
      <legend className="small" style={{ marginBottom: 10 }}>
        Working days
      </legend>
      <div className="row wrap">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
          <label className="small" key={d}>
            <input
              name="days"
              type="checkbox"
              value={i}
              defaultChecked={days.includes(i)}
            />{" "}
            {d}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function Form({ children, onSubmit, submit = "Save", id }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      id={id}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setError("");
        setBusy(true);
        try {
          const fd = new FormData(form);
          await onSubmit(Object.fromEntries(fd), fd, form);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <div className="error" role="alert">
        {error}
      </div>
      <Button kind="primary" disabled={busy}>
        {busy ? "Saving…" : submit}
      </Button>
    </form>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const app = document.getElementById("app");
    if (app) app.inert = true;
    const dialog = ref.current;
    const focus = () =>
      [
        ...dialog.querySelectorAll(
          'button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]',
        ),
      ].filter((x) => x.getClientRects().length);
    const initialFocus = focus();
    (initialFocus[1] || initialFocus[0] || dialog).focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const fs = focus(),
          first = fs[0],
          last = fs.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      if (app) app.inert = false;
      dialog.removeEventListener("keydown", key);
      previous?.isConnected && previous.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-head">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="iconbtn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
export function Switch({ label, checked, onChange }) {
  return (
    <button
      className="switch"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
    />
  );
}
