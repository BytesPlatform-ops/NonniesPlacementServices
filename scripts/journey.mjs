import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,160)));
await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
await p.waitForTimeout(4500);
// scroll into the journey section and sample a couple frames
const y = await p.evaluate(()=>{const el=[...document.querySelectorAll("section")].find(s=>s.getAttribute("aria-label")?.includes("resident")); return el?el.offsetTop:0;});
await p.evaluate((yy)=>window.scrollTo(0,yy+300), y); await p.waitForTimeout(1200);
await p.screenshot({ path:"docs/audit-screenshots/final/journey-1.png" });
await p.evaluate((yy)=>window.scrollTo(0,yy+2600), y); await p.waitForTimeout(1200);
await p.screenshot({ path:"docs/audit-screenshots/final/journey-2.png" });
console.log("errors:", errs.length, errs.slice(0,3));
await b.close();
