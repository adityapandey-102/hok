/**
 * RBAC roles/capabilities, time-zone rules, formatting utils, and zod
 * validation schemas -- the business rules this app's UI reflects.
 * Deliberately NOT a shared package: hok-api keeps its own copy of the same
 * rules. The two apps are fully independent repos that only talk over HTTP;
 * if that duplication ever becomes painful, that's a signal to introduce a
 * documented API contract, not to re-couple the repos with shared code.
 *
 * UI-side capability checks here are convenience/UX only (hide a button,
 * disable a field) -- the API is what actually enforces access.
 */
export * from "./constants/roles";
export * from "./constants/capabilities";
export * from "./types";
export * from "./utils/date";
export * from "./utils/timeZone";
export * from "./validation/user";
export * from "./types/client";
export * from "./validation/client";
export * from "./types/event";
export * from "./utils/zonedTime";
export * from "./utils/lastSeen";
export * from "./types/asset";
export * from "./validation/asset";
export * from "./utils/calendar";
export * from "./types/staffTask";
export * from "./validation/staffTask";
export * from "./types/clientTodo";
export * from "./validation/clientTodo";
