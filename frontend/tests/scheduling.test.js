import test from "node:test";
import assert from "node:assert/strict";
import { seedWorkspace, wallISO, parts, addDays } from "../src/domain.js";
import { conflict, createSeries, quota, slots } from "../src/scheduling.js";
function fixture() {
  const w = seedWorkspace("test", "Test", "#234567");
  w.timezone = "UTC";
  w.bookings = [];
  w.hours.days = [0, 1, 2, 3, 4, 5, 6];
  w.staff.forEach((s) => (s.days = [0, 1, 2, 3, 4, 5, 6]));
  return w;
}
const date = "2099-03-02";
const booking = (w, time = "10:00", person = w.staff[0].id) => ({
  id: "b1",
  staffId: person,
  serviceId: w.services[0].id,
  clientId: w.clients[0].id,
  start: wallISO(date, time, w.timezone),
  duration: 30,
  price: 0,
  status: "confirmed",
});
test("overlap and after-buffer reject, exact buffer boundary allows", () => {
  const w = fixture();
  w.bookings = [booking(w)];
  assert.match(conflict(w, { ...booking(w, "10:30"), id: "b2" }), /overlaps/);
  assert.equal(conflict(w, { ...booking(w, "10:45"), id: "b2" }), "");
  assert.match(conflict(w, { ...booking(w, "09:30"), id: "b2" }), /overlaps/);
});
test("different staff can share a time", () => {
  const w = fixture();
  w.bookings = [booking(w)];
  assert.equal(
    conflict(w, { ...booking(w, "10:00", w.staff[1].id), id: "b2" }),
    "",
  );
});
test("cancelled and no-show appointments release the slot", () => {
  const w = fixture();
  for (const status of ["cancelled", "no-show"]) {
    w.bookings = [{ ...booking(w), status }];
    assert.equal(conflict(w, { ...booking(w), id: "b2" }), "");
  }
});
test("moving booking ignores its original slot", () => {
  const w = fixture();
  w.bookings = [booking(w)];
  assert.equal(conflict(w, booking(w), "b1"), "");
});
test("working hours and days validated in workspace timezone", () => {
  const w = fixture();
  assert.match(conflict(w, booking(w, "08:00")), /working hours/);
  w.hours.days = [];
  assert.match(conflict(w, booking(w)), /not working/);
});
test("past times rejected", () => {
  const w = fixture();
  assert.match(
    conflict(w, { ...booking(w), start: "2000-01-01T10:00:00Z" }),
    /already passed/,
  );
});
test("UTC instant converts across IANA timezones", () => {
  const iso = wallISO("2028-05-01", "10:00", "Asia/Kolkata");
  assert.equal(iso, "2028-05-01T04:30:00.000Z");
  assert.deepEqual(parts(iso, "Asia/Kolkata"), {
    date: "2028-05-01",
    time: "10:00",
  });
});
test("DST nonexistent times rejected", () =>
  assert.throws(
    () => wallISO("2027-03-14", "02:30", "America/New_York"),
    /does not exist/,
  ));
test("recurring series validates every date atomically", () => {
  const w = fixture(),
    d = {
      serviceId: w.services[0].id,
      clientId: w.clients[0].id,
      staffId: w.staff[0].id,
      date,
      time: "10:00",
      zone: "UTC",
      repeat: "weekly",
      count: 4,
    };
  const batch = createSeries(w, d);
  assert.equal(batch.length, 4);
  assert.equal(parts(batch[1].start, "UTC").date, addDays(date, 7));
  w.bookings = [{ ...batch[2], id: "existing" }];
  assert.throws(() => createSeries(w, d), /Appointment 3/);
  assert.equal(w.bookings.length, 1);
});
test("free plan blocks recurrence and enforces monthly limits", () => {
  const w = fixture();
  w.plan = "Free";
  assert.throws(
    () => createSeries(w, { repeat: "weekly", serviceId: w.services[0].id }),
    /require Pro/,
  );
  w.bookings = Array.from({ length: 50 }, (_, i) => ({
    ...booking(w),
    id: String(i),
  }));
  assert.match(quota(w, [{ ...booking(w), id: "extra" }]), /limit/);
});
test("open slots exclude buffered appointments", () => {
  const w = fixture();
  w.bookings = [booking(w)];
  const times = slots(w, w.services[0], w.staff[0], date, "UTC");
  assert.ok(!times.includes("10:00"));
  assert.ok(!times.includes("10:30"));
  assert.ok(times.includes("11:00"));
});
