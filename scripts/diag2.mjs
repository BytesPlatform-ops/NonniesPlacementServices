import { chromium } from "playwright";
const b = await chromium.launch({ args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
const bad=[];
p.on("response", r=>{ if(r.url().includes("/assets/new/") && r.status()>=400) bad.push(r.status()+" "+r.url().split("/").pop()); });
await p.goto("http://localhost:3000/",{waitUntil:"load"});
await p.waitForTimeout(4500);
const info = await p.evaluate(()=>{
  const root=document.querySelector("#care-story .relative");
  const arts=[...document.querySelectorAll("#care-story article")];
  const first=arts[0];
  const img=first?.querySelector("img");
  const vid=first?.querySelector("video");
  const sec=document.getElementById("care-story");
  return {
    sectionTop: sec?Math.round(sec.offsetTop):-1,
    rootOpacity: root?getComputedStyle(root).opacity:"none",
    rootClip: root?getComputedStyle(root).clipPath:"none",
    artCount: arts.length,
    firstW: first?Math.round(first.getBoundingClientRect().width):-1,
    imgComplete: img?img.complete:"noimg",
    imgNatural: img?img.naturalWidth:"n/a",
    vidReady: vid?vid.readyState:"novid",
  };
});
console.log("bad responses:", bad.slice(0,6));
console.log(JSON.stringify(info,null,1));
await b.close();
