export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
export const zones = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];
export const localZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
if (!zones.includes(localZone)) zones.unshift(localZone);
export const dateKey = (date = new Date(), zone = localZone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function parts(iso, zone) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function wallISO(date, time, zone) {
  const target = Date.parse(date + "T" + time + ":00Z");
  let n = target;
  for (let i = 0; i < 4; i++) {
    const p = parts(n, zone);
    const delta = target - Date.parse(p.date + "T" + p.time + ":00Z");
    if (!delta) break;
    n += delta;
  }
  const p = parts(n, zone);
  if (p.date !== date || p.time !== time)
    throw Error(
      "This local time does not exist because of daylight saving. Choose another time.",
    );
  return new Date(n).toISOString();
}
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fmtDate(date, opts = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );
}
export function fmtTime(iso, zone = localZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
export const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const initials = (name) =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const plans = {
  Free: { price: 0, bookings: 50, seats: 1 },
  Pro: { price: 19, bookings: 1000, seats: 5 },
  Business: { price: 49, bookings: 100000, seats: 25 },
};
export function seedWorkspace(id, name, color, plan = "Pro") {
  const staff = [
    {
      id: id + "-s1",
      name: "Olivia Bennett",
      role: "Owner",
      email:
        "olivia@" + (id === "ws1" ? "formstudio" : "northstar") + ".example",
      start: "09:00",
      end: "18:00",
      days: [1, 2, 3, 4, 5],
    },
    {
      id: id + "-s2",
      name: "James Wilson",
      role: "Staff",
      email: "james@example.com",
      start: "09:00",
      end: "17:00",
      days: [1, 2, 3, 4, 5],
    },
    {
      id: id + "-s3",
      name: "Mia Chen",
      role: "Admin",
      email: "mia@example.com",
      start: "10:00",
      end: "18:00",
      days: [1, 2, 3, 4, 5],
    },
  ];
  const services = [
    {
      id: id + "-v1",
      name: "Discovery call",
      description:
        "A little conversation. A lot of possibility. Let’s find the right direction for you.",
      duration: 30,
      price: 0,
      buffer: 15,
      color: "purple",
    },
    {
      id: id + "-v2",
      name: "Design consultation",
      description: "Dedicated time to work through your ideas with an expert.",
      duration: 60,
      price: 120,
      buffer: 15,
      color: "green",
    },
    {
      id: id + "-v3",
      name: "Strategy session",
      description:
        "Get clarity, define your next steps, and leave with a plan.",
      duration: 45,
      price: 90,
      buffer: 15,
      color: "blue",
    },
  ];
  const clients = [
    "Alex Morgan",
    "Sophie Williams",
    "Daniel Park",
    "Emma Davis",
    "Noah Thompson",
    "Isabella Rossi",
    "Lucas Martin",
    "Ava Patel",
  ].map((name, i) => ({
    id: id + "-c" + i,
    name,
    email: name.toLowerCase().replaceAll(" ", ".") + "@example.com",
    tags: i % 3 === 0 ? ["VIP"] : i % 2 === 0 ? ["Returning"] : ["New"],
    notes:
      i === 0
        ? "Prefers morning appointments. Interested in a brand refresh."
        : "",
  }));
  const today = dateKey(new Date(), localZone);
  const bookings = [];
  for (let d = -18; d <= 9; d++) {
    const day = addDays(today, d);
    if ([0, 6].includes(new Date(day + "T12:00Z").getUTCDay())) continue;
    [9, 10, 11, 13, 14, 15].forEach((h, j) => {
      if (d !== 0 && (j + d + 40) % 3 === 0) return;
      const st = staff[j % 3];
      const svc = services[j % 3];
      const start = wallISO(
        day,
        `${String(h).padStart(2, "0")}:${j === 1 ? "30" : "00"}`,
        localZone,
      );
      bookings.push({
        id: uid(),
        clientId: clients[(j + d + 80) % 8].id,
        serviceId: svc.id,
        staffId: st.id,
        start,
        duration: svc.duration,
        price: svc.price,
        status:
          d < 0
            ? (j + d + 50) % 13 === 0
              ? "no-show"
              : "completed"
            : j === 4
              ? "pending"
              : "confirmed",
        recurring: false,
        notes: "",
      });
    });
  }
  return {
    id,
    name,
    color,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    plan,
    timezone: localZone,
    hours: { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
    staff,
    services,
    clients,
    bookings,
    waitlist: [],
    invites: [],
    keys: [],
    integrations: { google: false, zoom: false, stripe: false },
    notifications: { email: true, reminders: true, digest: false },
    activity: [
      {
        id: uid(),
        text: "Alex Morgan booked a design consultation",
        time: Date.now() - 8 * 60000,
      },
      {
        id: uid(),
        text: "James Wilson joined your workspace",
        time: Date.now() - 37 * 60000,
      },
      {
        id: uid(),
        text: "Your booking page is ready to share",
        time: Date.now() - 70 * 60000,
      },
    ],
    audit: [],
  };
}
export function seed() {
  return {
    version: 1,
    active: "ws1",
    role: "Owner",
    theme: "light",
    collapsed: false,
    profile: { name: "Olivia Bennett", email: "olivia@formstudio.example" },
    workspaces: [
      seedWorkspace("ws1", "Form Studio", "#0757e8"),
      seedWorkspace("ws2", "Northstar Co.", "#2145a0", "Business"),
    ],
  };
}
