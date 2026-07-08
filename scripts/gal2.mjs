import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/",{waitUntil:"load"});
await p.waitForTimeout(4500);
await p.evaluate(()=>{ const a=document.querySelector("#care-story article"); if(a) a.scrollIntoView({block:"center"}); });
await p.waitForTimeout(2000);
await p.screenshot({ path:"docs/audit-screenshots/final/home-gallery-4-card-carousel.png" });
// also mobile
await p.setViewportSize({width:390,height:844});
await p.evaluate(()=>{ const a=document.querySelector("#care-story article"); if(a) a.scrollIntoView({block:"center"}); });
await p.waitForTimeout(1500);
await p.screenshot({ path:"docs/audit-screenshots/final/gallery-mobile.png" });
console.log("done");
await b.close();
