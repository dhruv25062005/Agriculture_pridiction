/* AgriSense AI premium auth polish.
 * Presentation only. Keeps existing authentication logic untouched.
 */
(() => {
  "use strict";
  const start = () => {
    if (window.__agriPremiumAuthPolish) return;
    const card = document.querySelector(".auth-card");
    if (!card) return;
    window.__agriPremiumAuthPolish = true;

    const style = document.createElement("style");
    style.id = "agri-premium-auth-polish";
    style.textContent = `
      :root{
        --premium-green:#43f3b2;
        --premium-cyan:#35dcff;
        --premium-white:#f7fffc;
        --premium-muted:rgba(235,247,243,.72);
      }

      body{
        position:relative!important;
        isolation:isolate!important;
        overflow-x:hidden!important;
        background:
          linear-gradient(90deg,rgba(0,18,12,.60) 0%,rgba(0,18,13,.28) 32%,rgba(0,12,12,.10) 57%,rgba(0,8,8,.24) 100%),
          linear-gradient(180deg,rgba(0,12,8,.10),rgba(0,8,8,.30)),
          url("https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2400&q=88") center center/cover fixed no-repeat!important;
      }
      body:after{
        content:"";
        position:fixed;inset:0;pointer-events:none;z-index:-1;
        background:
          radial-gradient(ellipse at 18% 48%,rgba(67,243,178,.10),transparent 35%),
          radial-gradient(ellipse at 78% 40%,rgba(53,220,255,.07),transparent 32%),
          linear-gradient(90deg,transparent 0 54%,rgba(1,12,11,.16) 100%);
      }

      .auth-3d-stage{opacity:.72!important;}
      .auth-3d-stage canvas{opacity:.58!important;mix-blend-mode:screen;}
      .auth-depth-orb{opacity:.10!important;}
      .auth-ring{opacity:.24!important;}
      .auth-holo{opacity:.20!important;}
      .auth-scanline{opacity:.35!important;}

      .auth-card{
        width:min(1480px,100%)!important;
        height:min(90vh,820px)!important;
        gap:clamp(30px,6vw,105px)!important;
        padding:0 clamp(4px,2vw,28px)!important;
      }
      .left{align-items:center!important;}
      .left-content{
        max-width:720px!important;
        padding:0!important;
        transform:translateY(-1vh)!important;
      }

      .agri-brand{
        gap:13px!important;
        margin-bottom:32px!important;
        animation:agriRise .7s ease both;
      }
      .agri-logo{width:51px!important;height:51px!important;}
      .agri-brand-name{font-size:26px!important;letter-spacing:-.8px!important;text-shadow:0 3px 18px rgba(0,0,0,.35);}
      .agri-brand-sub{color:rgba(239,249,245,.78)!important;}
      .agri-pill{
        padding:8px 14px!important;
        background:rgba(3,35,28,.20)!important;
        box-shadow:0 0 26px rgba(67,243,178,.10)!important;
        backdrop-filter:blur(4px)!important;
      }
      .agri-title{
        max-width:680px!important;
        margin:19px 0 15px!important;
        font-size:clamp(46px,5.1vw,76px)!important;
        line-height:.99!important;
        letter-spacing:-3.5px!important;
        text-shadow:0 7px 30px rgba(0,0,0,.40)!important;
      }
      .agri-title span{
        filter:drop-shadow(0 5px 22px rgba(42,236,183,.12));
      }
      .agri-description{
        max-width:560px!important;
        font-size:16px!important;
        line-height:1.65!important;
        color:rgba(248,255,252,.84)!important;
        text-shadow:0 2px 14px rgba(0,0,0,.32);
      }
      .agri-features{
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:10px!important;
        max-width:690px!important;
        margin-top:28px!important;
      }
      .agri-feature{
        min-height:70px!important;
        padding:10px 11px!important;
        border:1px solid rgba(255,255,255,.13)!important;
        border-radius:15px!important;
        background:rgba(2,24,21,.15)!important;
        backdrop-filter:blur(2px)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 10px 28px rgba(0,0,0,.08)!important;
        transition:transform .25s ease,border-color .25s ease,background .25s ease!important;
      }
      .agri-feature:hover{transform:translateY(-3px)!important;border-color:rgba(67,243,178,.40)!important;background:rgba(4,34,29,.22)!important;}
      .agri-feature-icon{width:35px!important;height:35px!important;border-radius:10px!important;background:rgba(8,51,42,.25)!important;}

      .right{
        width:min(460px,36vw)!important;
        min-width:380px!important;
        padding:40px 40px 30px!important;
        border:1px solid rgba(255,255,255,.25)!important;
        border-radius:28px!important;
        background:linear-gradient(145deg,rgba(7,28,28,.36),rgba(4,18,21,.20))!important;
        backdrop-filter:blur(18px) saturate(130%)!important;
        -webkit-backdrop-filter:blur(18px) saturate(130%)!important;
        box-shadow:0 30px 80px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.16),0 0 50px rgba(47,236,185,.06)!important;
      }
      .right:before{
        background:linear-gradient(135deg,rgba(255,255,255,.09),transparent 28%,transparent 68%,rgba(55,228,255,.045))!important;
      }
      .auth-header h1{font-size:33px!important;letter-spacing:-1.2px!important;text-shadow:0 4px 18px rgba(0,0,0,.28)!important;}
      .auth-header p{color:rgba(238,248,245,.72)!important;}

      input{
        min-height:57px!important;
        border-color:rgba(255,255,255,.22)!important;
        background:rgba(1,19,22,.30)!important;
        transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease!important;
      }
      input:hover{border-color:rgba(255,255,255,.34)!important;}
      input:focus{transform:translateY(-1px)!important;}
      button.primary-btn{
        position:relative!important;
        overflow:hidden!important;
        min-height:57px!important;
        background:linear-gradient(105deg,#42f1b1 0%,#31e4b5 48%,#28d0ed 100%)!important;
        box-shadow:0 14px 32px rgba(34,224,174,.22),inset 0 1px 0 rgba(255,255,255,.36)!important;
        font-weight:800!important;
        letter-spacing:.1px!important;
        transition:transform .22s ease,box-shadow .22s ease!important;
      }
      button.primary-btn:before{
        content:"";position:absolute;top:0;bottom:0;width:70px;left:-90px;transform:skewX(-18deg);
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);
        animation:agriButtonShine 4.8s ease-in-out infinite;
      }
      button.primary-btn:hover{transform:translateY(-2px)!important;box-shadow:0 18px 38px rgba(34,224,174,.30),inset 0 1px 0 rgba(255,255,255,.38)!important;}
      .google-btn,.guest-btn{background:rgba(4,23,26,.28)!important;backdrop-filter:blur(5px)!important;}
      .google-btn:hover,.guest-btn:hover{transform:translateY(-1px)!important;}

      @keyframes agriRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes agriButtonShine{0%,62%{left:-90px;opacity:0}68%{opacity:1}78%{left:calc(100% + 30px);opacity:0}100%{left:calc(100% + 30px);opacity:0}}

      @media(max-width:1050px){
        .auth-card{gap:34px!important;padding:0 6px!important;}
        .agri-features{grid-template-columns:1fr!important;max-width:500px!important;}
        .agri-feature{min-height:52px!important;}
        .right{width:min(450px,42vw)!important;min-width:370px!important;padding:34px 30px 28px!important;}
      }
      @media(max-width:800px){
        body{background-attachment:scroll!important;}
        .auth-card{height:auto!important;gap:20px!important;padding:8px 0 24px!important;}
        .left-content{transform:none!important;}
        .agri-title{font-size:clamp(39px,11vw,54px)!important;letter-spacing:-2.4px!important;}
        .agri-description{font-size:14px!important;}
        .right{width:100%!important;min-width:0!important;max-width:510px!important;}
      }
      @media(max-width:500px){
        .agri-brand{margin-bottom:23px!important;}
        .agri-title{font-size:38px!important;}
        .agri-features{margin-top:19px!important;}
        .right{padding:29px 22px 24px!important;border-radius:23px!important;}
      }
      @media(prefers-reduced-motion:reduce){
        .agri-brand,button.primary-btn:before{animation:none!important;}
        .agri-feature,button.primary-btn,input{transition:none!important;}
      }
    `;
    document.head.appendChild(style);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 120), { once:true });
  else setTimeout(start, 120);
})();
