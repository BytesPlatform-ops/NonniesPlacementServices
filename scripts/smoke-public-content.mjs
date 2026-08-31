#!/usr/bin/env node
/**
 * Runtime smoke test for public website CMS content.
 *
 * Because an empty /blog page previously slipped past build/typecheck/unit tests,
 * this hits the ACTUAL rendered pages and asserts seeded content is present. It
 * requires the website AND the platform backend to be running.
 *
 *   WEB_URL (default http://localhost:3000)   the running public website
 *
 * Run:  npm run test:smoke
 * Exits non-zero on the first failed assertion.
 */

const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${WEB_URL}${path}`, { headers: { Accept: "text/html" } });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.text();
}

function assert(cond, message) {
  if (!cond) {
    console.error(`  ✗ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function main() {
  console.log(`Smoke-testing public content at ${WEB_URL}`);

  const blog = await get("/blog");
  assert(/Planning a Safe Hospital Discharge/.test(blog), "/blog renders a seeded blog title");
  assert(/Short stories from the/i.test(blog), "/blog renders the Short Videos section heading");
  assert(/supabase\.co\/storage\/v1\/object\/public\/nonnis-content\//.test(blog), "/blog references Supabase-hosted media");

  const home = await get("/");
  assert(/Trusted by families/i.test(home), "/ renders the Testimonials section heading");
  assert(/Demo Family Testimonial|Demo Hospital Partner|Demo Provider Partner/.test(home), "/ renders at least one seeded testimonial");

  if (process.exitCode) {
    console.error("\nSmoke test FAILED — public content is not rendering correctly.");
  } else {
    console.log("\nSmoke test passed.");
  }
}

main().catch((err) => {
  console.error(`Smoke test error: ${err.message}`);
  console.error("Is the website (and platform backend) running?");
  process.exitCode = 1;
});
