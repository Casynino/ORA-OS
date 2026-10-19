/**
 * The Developer's own tracks (every ActivityLog row whose action starts with "DEV_") belong to the
 * Developer area only. Admin, Finance and every other screen leave them out. Use this in any query
 * that lists the activity log for someone who is not the Developer.
 */
export const notDeveloperTrack = { action: { not: { startsWith: "DEV_" } } } as const;
