import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://ora-os-eight.vercel.app";
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
await p.goto(BASE+"/login",{waitUntil:"networkidle2"});
await p.type('input[name="email"]',"admin@orapads.org"); await p.type('input[name="password"]',"Admin@123");
await Promise.all([p.waitForNavigation({waitUntil:"networkidle2"}).catch(()=>{}),p.click('button[type="submit"]')]);
await new Promise(r=>setTimeout(r,1500));
// poll customers list until "Open" links exist (new build)
let href=null;
for(let i=1;i<=10 && !href;i++){
  await p.goto(BASE+"/admin/customers",{waitUntil:"networkidle2"}); await new Promise(r=>setTimeout(r,800));
  href = await p.evaluate(()=>{const a=[...document.querySelectorAll('a[href^="/admin/customers/"]')].find(x=>/customers\/[a-z0-9]+/i.test(x.getAttribute("href")||"")); return a? a.getAttribute("href"):null;});
  if(!href){console.log(`poll ${i}: no profile links yet`); await new Promise(r=>setTimeout(r,20000));}
}
if(!href){console.log("timed out"); await b.close(); process.exit(0);}
console.log("profile:", href);
await p.goto(BASE+href,{waitUntil:"networkidle2"}); await p.evaluate(()=>document.fonts.ready); await new Promise(r=>setTimeout(r,1000));
// scroll through to trigger any reveals
await p.evaluate(async()=>{for(let y=0;y<=document.body.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));} window.scrollTo(0,0);});
await new Promise(r=>setTimeout(r,500));
const docW = await p.evaluate(()=>document.documentElement.scrollWidth);
await p.screenshot({path:"/tmp/customer_profile.png",fullPage:true});
console.log("captured, docW="+docW);
// mobile overflow check
await p.setViewport({width:393,height:852,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+href,{waitUntil:"networkidle2"}); await p.evaluate(()=>document.fonts.ready); await new Promise(r=>setTimeout(r,800));
const m = await p.evaluate(()=>{document.documentElement.style.overflowX="visible";document.body.style.overflowX="visible";const vw=innerWidth;let off=[];for(const el of document.querySelectorAll("main *")){const r=el.getBoundingClientRect();const cls=(typeof el.className==="string"?el.className:"");if(r.right>vw+1&&!cls.includes("pointer-events-none"))off.push(el.tagName.toLowerCase());}return {docW:document.documentElement.scrollWidth,vw,n:[...new Set(off)].length};});
console.log(`MOBILE docW=${m.docW}/${m.vw} offenders=${m.n}`);
await b.close();
