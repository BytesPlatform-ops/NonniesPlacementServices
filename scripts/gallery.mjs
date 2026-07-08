import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
// Loader capture (mid-animation)
await p.goto("http://localhost:3000/?loader=1",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(1100);
await p.screenshot({ path:"docs/audit-screenshots/final/loader.png" });
// Gallery capture
await p.goto("http://localhost:3000/",{waitUntil:"load"});
await p.waitForTimeout(4500);
await p.evaluate(()=>document.getElementById("care-story")?.scrollIntoView({block:"center"}));
await p.waitForTimeout(1800);
await p.screenshot({ path:"docs/audit-screenshots/final/home-gallery-4-card-carousel.png" });
// count visible cards
const n = await p.evaluate(()=>{
  const cards=[...document.querySelectorAll("#care-story article")];
  const vw=window.innerWidth;
  return cards.filter(c=>{const r=c.getBoundingClientRect(); return r.left< vw-20 && r.right>20 && r.width>60;}).length;
});
console.log("visible-ish cards:", n);
await b.close();
