import { parts, wallISO, plans, addDays, uid } from "./domain.js";
export function conflict(
  workspace,
  booking,
  ignoreId = "",
  batch = [],
  now = Date.now(),
) {
  const w = workspace,
    b = booking,
    s = w.services.find((x) => x.id === b.serviceId),
    person = w.staff.find((x) => x.id === b.staffId);
  if (!s || !person) return "Choose a valid service and team member.";
  const start = Date.parse(b.start),
    end = start + b.duration * 60000;
  if (!Number.isFinite(start)) return "Choose a valid date and time.";
  if (start < now) return "That time has already passed. Choose a future time.";
  const p = parts(start, w.timezone),
    ep = parts(end, w.timezone),
    day = new Date(p.date + "T12:00Z").getUTCDay();
  if (!w.hours.days.includes(day) || !person.days.includes(day))
    return "This team member is not working that day.";
  if (
    p.date !== ep.date ||
    p.time < w.hours.start ||
    p.time < person.start ||
    ep.time > w.hours.end ||
    ep.time > person.end
  )
    return "That appointment falls outside working hours.";
  const overlap = [...w.bookings, ...batch].some((other) => {
    if (
      other.id === ignoreId ||
      other.staffId !== b.staffId ||
      ["cancelled", "no-show"].includes(other.status)
    )
      return false;
    const os = Date.parse(other.start),
      oe = os + other.duration * 60000,
      buffer = w.services.find((x) => x.id === other.serviceId)?.buffer || 0;
    return start < oe + buffer * 60000 && end + (s.buffer || 0) * 60000 > os;
  });
  return overlap
    ? "That time overlaps another appointment or its buffer. Choose an open time."
    : "";
}
export function quota(w, batch, ignoreId = "") {
  const counts = {};
  for (const b of [
    ...w.bookings.filter((x) => x.id !== ignoreId),
    ...batch,
  ].filter((b) => b.status !== "cancelled")) {
    const month = parts(b.start, w.timezone).date.slice(0, 7);
    counts[month] = (counts[month] || 0) + 1;
    if (counts[month] > plans[w.plan].bookings)
      return `The ${w.plan} monthly booking limit is reached for ${month}. Upgrade your plan.`;
  }
  return "";
}
export function slots(w, s, person, date, zone) {
  const list = [];
  if (!s || !person) return list;
  for (let h = 0; h < 24; h++)
    for (const m of [0, 30]) {
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      try {
        if (
          !conflict(w, {
            serviceId: s.id,
            staffId: person.id,
            start: wallISO(date, time, zone),
            duration: s.duration,
          })
        )
          list.push(time);
      } catch {
        /* DST gaps are not bookable. */
      }
    }
  return list;
}
export function createSeries(w, data) {
  const old = w.bookings.find((b) => b.id === data.id),
    s = w.services.find((s) => s.id === data.serviceId);
  if (!s) throw Error("Select a valid service.");
  if (data.repeat && data.repeat !== "none" && w.plan === "Free")
    throw Error("Recurring appointments require Pro. Upgrade in Billing.");
  const count =
    !old && data.repeat && data.repeat !== "none" ? Number(data.count) : 1;
  if (!Number.isInteger(count) || count < 1 || count > 12)
    throw Error("Choose 2–12 appointments.");
  const batch = [];
  for (let i = 0; i < count; i++) {
    const b = {
      id: old?.id || uid(),
      clientId: data.clientId,
      serviceId: s.id,
      staffId: data.staffId,
      start: wallISO(
        addDays(data.date, i * (data.repeat === "fortnightly" ? 14 : 7)),
        data.time,
        data.zone,
      ),
      duration: s.duration,
      price: s.price,
      status:
        old?.status === "cancelled" ? "confirmed" : old?.status || "confirmed",
      recurring: count > 1 || old?.recurring || false,
      notes: data.notes || "",
    };
    const err = conflict(w, b, old?.id, batch);
    if (err) throw Error(`Appointment ${i + 1}: ${err}`);
    batch.push(b);
  }
  const limit = quota(w, batch, old?.id);
  if (limit) throw Error(limit);
  return batch;
}
