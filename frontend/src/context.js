import { createContext, useContext } from "react";
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
export const navigation = [
  ["dashboard", "Overview", "dashboard"],
  ["calendar", "Calendar", "calendar"],
  ["bookings", "Bookings", "bookings"],
  ["clients", "Clients", "clients"],
  ["services", "Services", "services"],
  ["staff", "Team members", "staff"],
  ["booking-page", "Booking page", "link"],
  ["analytics", "Analytics", "analytics"],
  ["integrations", "Integrations", "integrations"],
  ["settings", "Settings", "settings"],
  ["audit", "Audit log", "audit"],
  ["api", "Developer API", "key"],
];
export function permitted(role, path) {
  if (role === "Client")
    return [
      "dashboard",
      "bookings",
      "booking-page",
      "settings",
      "pricing",
    ].includes(path);
  if (role === "Staff")
    return !["analytics", "integrations", "audit", "api"].includes(path);
  return true;
}
