/**
 * Shared kernel: core domain concepts (roles, capability matrix, the Profile
 * type) used across multiple modules within THIS repo. This is not shared code
 * between repositories -- hok-web maintains its own independent copy of the
 * same rules (the same "no shared package, on purpose" rule as needleye).
 */
export * from "./roles";
export * from "./capabilities";
export * from "./profile";
export * from "./time-zone";
export * from "./contact";
export * from "./time-range";
