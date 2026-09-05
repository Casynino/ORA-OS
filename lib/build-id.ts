/**
 * Which build this is — the one fact a running page needs to know it's stale.
 *
 * Vercel stamps the commit into the environment at build time, so every
 * deployment carries a different string. Read in a CLIENT module it inlines the
 * build-time value (NEXT_PUBLIC_…); read on the server it resolves at runtime to
 * the deployment currently serving. Comparing the two is how we spot a new
 * version. Locally there's no commit, so it falls back to "development" and the
 * update banner stays quiet while the dev server rebuilds under your feet.
 */
export const BUILD_ID =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "development";
