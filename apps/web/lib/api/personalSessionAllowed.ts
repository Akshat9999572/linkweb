import { timingSafeEqual } from "node:crypto";

export function personalSessionAllowed(host: unknown, proxyKey: unknown) {
  if (typeof host !== "string") return false;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return true;

  if (
    process.env.VERCEL === "1" &&
    process.env.PERSONAL_VERCEL_PROTECTED === "true" &&
    [
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ].includes(host)
  )
    return true;

  // The VPS reverse proxy authenticates visitors and overwrites this header.
  // Neither a matching Host header nor a public direct connection is sufficient.
  const secret = process.env.PERSONAL_PROXY_SECRET;
  if (
    host !== process.env.PERSONAL_PROXY_HOST ||
    !secret ||
    secret.length < 32 ||
    typeof proxyKey !== "string"
  )
    return false;
  const expected = new Uint8Array(Buffer.from(secret));
  const supplied = new Uint8Array(Buffer.from(proxyKey));
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
