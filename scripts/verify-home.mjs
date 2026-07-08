import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
await p.waitForTimeout(5000);
await p.screenshot({ path:"docs/audit-screenshots/final/home-hero.png" });
await p.evaluate(()=>document.getElementById("marketplace")?.scrollIntoView());
await p.waitForTimeout(1200);
await p.screenshot({ path:"docs/audit-screenshots/final/marketplace.png" });
await p.evaluate(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);});
await p.waitForTimeout(800);
try{ await p.screenshot({ path:"docs/audit-screenshots/final/home-desktop.png", fullPage:true, animations:"disabled", timeout:60000 }); }catch(e){ console.log("full fail",e.message); }
console.log("done");
await b.close();
