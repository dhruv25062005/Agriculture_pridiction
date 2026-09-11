/* KisanAI authentication 3D scene
 * Decorative only: does not touch auth state, forms, Firebase, or navigation.
 */
(() => {
  "use strict";
  if (window.__kisanAuth3D) return;
  window.__kisanAuth3D = true;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const style = document.createElement("style");
  style.textContent = `
    .auth-3d-stage{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;perspective:1200px;background:radial-gradient(circle at 50% 35%,rgba(16,185,129,.09),transparent 42%)}
    .auth-3d-stage canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.92}
    .auth-depth-orb{position:absolute;border-radius:50%;filter:blur(2px);transform-style:preserve-3d;will-change:transform;opacity:.18}
    .auth-depth-orb.a{width:420px;height:420px;left:-150px;top:12%;background:radial-gradient(circle at 35% 30%,rgba(52,211,153,.65),rgba(6,182,212,.08) 42%,transparent 70%);box-shadow:0 0 100px rgba(16,185,129,.16)}
    .auth-depth-orb.b{width:520px;height:520px;right:-190px;bottom:-120px;background:radial-gradient(circle at 40% 35%,rgba(34,211,238,.45),rgba(139,92,246,.07) 45%,transparent 72%);box-shadow:0 0 120px rgba(34,211,238,.12)}
    .auth-ring{position:absolute;border:1px solid rgba(103,232,249,.16);border-radius:50%;transform-style:preserve-3d;box-shadow:0 0 30px rgba(52,211,153,.05),inset 0 0 30px rgba(34,211,238,.03)}
    .auth-ring.r1{width:430px;height:430px;left:50%;top:48%;transform:translate(-50%,-50%) rotateX(67deg) rotateZ(18deg)}
    .auth-ring.r2{width:620px;height:620px;left:50%;top:48%;transform:translate(-50%,-50%) rotateX(69deg) rotateZ(-24deg);opacity:.55}
    .auth-holo{position:absolute;left:50%;top:52%;width:180px;height:180px;transform:translate(-50%,-50%) rotateX(60deg);border:1px solid rgba(52,211,153,.2);border-radius:50%;box-shadow:0 0 45px rgba(52,211,153,.1),inset 0 0 35px rgba(34,211,238,.05)}
    .auth-holo:before,.auth-holo:after{content:"";position:absolute;inset:15%;border:1px dashed rgba(103,232,249,.22);border-radius:50%}
    .auth-holo:after{inset:30%;border-style:solid;border-color:rgba(52,211,153,.2)}
    .auth-scanline{position:absolute;left:8%;right:8%;height:1px;background:linear-gradient(90deg,transparent,rgba(52,211,153,.28),transparent);box-shadow:0 0 18px rgba(52,211,153,.2);animation:authScan 7s ease-in-out infinite}
    @keyframes authScan{0%,100%{top:20%;opacity:0}15%{opacity:1}50%{top:78%;opacity:.65}75%{opacity:1}}
    .auth-card{transform-style:preserve-3d}
    .auth-card:after{content:"";position:absolute;inset:1px;border-radius:inherit;pointer-events:none;border:1px solid rgba(167,243,208,.08);box-shadow:inset 0 0 45px rgba(52,211,153,.035)}
    @media(max-width:700px){.auth-depth-orb.a{width:260px;height:260px}.auth-depth-orb.b{width:300px;height:300px}.auth-ring.r1{width:300px;height:300px}.auth-ring.r2{width:430px;height:430px}.auth-holo{width:120px;height:120px}.auth-scanline{left:2%;right:2%}}
    @media(prefers-reduced-motion:reduce){.auth-scanline{animation:none;top:50%;opacity:.5}.auth-ring,.auth-holo{transform:none!important}}
  `;
  document.head.appendChild(style);

  const stage = document.createElement("div");
  stage.className = "auth-3d-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = '<canvas></canvas><div class="auth-depth-orb a"></div><div class="auth-depth-orb b"></div><div class="auth-ring r1"></div><div class="auth-ring r2"></div><div class="auth-holo"></div><div class="auth-scanline"></div>';
  document.body.prepend(stage);

  const canvas = stage.querySelector("canvas");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  let w=0,h=0,dpr=1,mx=.5,my=.5,tx=.5,ty=.5,last=0;
  const stars=[],dust=[],leaves=[];
  const rand=(a,b)=>Math.random()*(b-a)+a;

  function resize(){
    w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function seed(){
    stars.length=0;dust.length=0;leaves.length=0;
    const count=Math.min(95,Math.max(45,Math.floor(w/15)));
    for(let i=0;i<count;i++)stars.push({x:Math.random(),y:Math.random(),z:rand(.1,1),r:rand(.4,1.8),p:rand(0,6.28),s:rand(.0005,.0018)});
    for(let i=0;i<75;i++)dust.push({x:Math.random(),y:Math.random(),z:rand(.2,1),r:rand(.3,1.4),s:rand(.003,.012),p:rand(0,6.28)});
    for(let i=0;i<12;i++)leaves.push({x:rand(-.05,1.05),y:rand(.05,.95),z:rand(.25,1),a:rand(-3.14,3.14),s:rand(-.003,.003),d:rand(.0003,.001)});
  }
  function drawLeaf(l,t){
    const s=(8+l.z*14),x=l.x*w+Math.sin(t*l.d+l.z*8)*34,y=l.y*h+Math.cos(t*l.d*.8+l.z*6)*20;
    ctx.save();ctx.translate(x,y);ctx.rotate(l.a+t*l.s);ctx.globalAlpha=.035+l.z*.1;ctx.fillStyle="#34d399";
    ctx.beginPath();ctx.moveTo(0,-s);ctx.bezierCurveTo(s*1.3,-s*.4,s*1.1,s*.7,0,s);ctx.bezierCurveTo(-s*1.1,s*.7,-s*1.3,-s*.4,0,-s);ctx.fill();ctx.restore();
  }
  function frame(t){
    const dt=Math.min(40,t-last||16);last=t;mx+=(tx-mx)*.035;my+=(ty-my)*.035;ctx.clearRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w*mx,h*my,0,w*mx,h*my,Math.max(w,h)*.58);glow.addColorStop(0,"rgba(52,211,153,.10)");glow.addColorStop(.45,"rgba(34,211,238,.025)");glow.addColorStop(1,"transparent");ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    stars.forEach(p=>{const x=p.x*w+(mx-.5)*28*p.z,y=p.y*h+(my-.5)*20*p.z,pulse=.5+.5*Math.sin(t*p.s*1000+p.p);ctx.beginPath();ctx.arc(x,y,p.r*(.7+p.z),0,6.28);ctx.fillStyle=`rgba(167,243,208,${.08+p.z*.28*pulse})`;ctx.shadowBlur=8;ctx.shadowColor="#34d399";ctx.fill();ctx.shadowBlur=0;});
    dust.forEach(p=>{p.y-=p.s*dt*.01;if(p.y<-.02)p.y=1.02;const x=p.x*w+(mx-.5)*18*p.z,y=p.y*h+(my-.5)*14*p.z;ctx.beginPath();ctx.arc(x,y,p.r,0,6.28);ctx.fillStyle=`rgba(103,232,249,${.05+p.z*.16})`;ctx.fill();});
    leaves.forEach(l=>drawLeaf(l,t));
    if(!reduce)requestAnimationFrame(frame);
  }

  const orbA=stage.querySelector(".auth-depth-orb.a"),orbB=stage.querySelector(".auth-depth-orb.b"),r1=stage.querySelector(".auth-ring.r1"),r2=stage.querySelector(".auth-ring.r2");
  function parallax(){
    if(reduce)return;
    const x=(mx-.5)*2,y=(my-.5)*2;
    orbA.style.transform=`translate3d(${x*-28}px,${y*-20}px,40px)`;
    orbB.style.transform=`translate3d(${x*22}px,${y*18}px,20px)`;
    r1.style.transform=`translate(-50%,-50%) rotateX(${67+y*4}deg) rotateY(${x*5}deg) rotateZ(${18+x*3}deg)`;
    r2.style.transform=`translate(-50%,-50%) rotateX(${69-y*3}deg) rotateY(${x*-4}deg) rotateZ(${-24+y*4}deg)`;
  }
  addEventListener("resize",()=>{resize();seed();},{passive:true});
  addEventListener("pointermove",e=>{tx=e.clientX/Math.max(w,1);ty=e.clientY/Math.max(h,1);parallax();},{passive:true});
  resize();seed();frame(performance.now());parallax();
})();
