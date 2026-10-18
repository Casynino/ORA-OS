/**
 * Deleting an account removes the person's ACCESS and their place in the system's people
 * lists. It never removes what they recorded: sales, payments, stock moves and the activity
 * log keep pointing at the same person, with the same name, so history still shows who did what.
 *
 * Those records need the user row to stay, so a deleted account keeps its row with the name
 * untouched, the email swapped for this unusable placeholder (the real one is freed for a new
 * account), and the account locked. The placeholder is also the marker that hides it from lists.
 */
export const DELETED_EMAIL_DOMAIN = "deleted.invalid";

export const deletedEmail = (id: string) => `deleted-${id}@${DELETED_EMAIL_DOMAIN}`;

export const isDeletedEmail = (email: string) => email.endsWith(`@${DELETED_EMAIL_DOMAIN}`);

/** Prisma `where` fragment: leave deleted accounts out of people lists and counts. */
export const notDeleted = { NOT: { email: { endsWith: `@${DELETED_EMAIL_DOMAIN}` } } } as const;
