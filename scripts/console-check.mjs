import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const routes = ["/","/families","/providers","/pricing","/about","/contact"];
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const page = await ctx.newPage();
for (const r of routes){
  const errs=[];
  page.removeAllListeners("console"); page.removeAllListeners("pageerror");
  page.on("console", m => { if(m.type()==="error") errs.push("CONSOLE: "+m.text().slice(0,300)); });
  page.on("pageerror", e => errs.push("PAGEERROR: "+String(e).slice(0,300)));
  await page.goto(BASE+r,{waitUntil:"networkidle"});
  await page.waitForTimeout(3500);
  await page.evaluate(async()=>{const h=document.body.scrollHeight;for(let y=0;y<h;y+=800){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,50));}});
  await page.waitForTimeout(500);
  console.log(`\n=== ${r} === (${errs.length} errors)`);
  [...new Set(errs)].slice(0,12).forEach(e=>console.log("  "+e));
}
await b.close();
