/* Premium authentication UI layer.
 * Presentation only: keeps existing auth IDs, forms, Firebase handlers and navigation intact.
 */
(() => {
  "use strict";
  if (window.__agriAuthUIUpgrade) return;

  const boot = () => {
    const card = document.querySelector(".auth-card");
    if (!card) return;
    window.__agriAuthUIUpgrade = true;

    const style = document.createElement("style");
    style.textContent = `
      :root{
        --agri-neon:#39f2b0;
        --agri-cyan:#20d9ff;
        --agri-white:#f7fffb;
        --agri-muted:rgba(231,245,240,.72);
        --agri-line:rgba(255,255,255,.18);
        --agri-glass:rgba(10,27,31,.38);
      }
      html,body{min-height:100%;}
      body{
        min-height:100vh!important;
        padding:28px 38px!important;
        align-items:center!important;
        justify-content:center!important;
        background:
          linear-gradient(90deg,rgba(1,16,17,.72) 0%,rgba(2,19,20,.48) 45%,rgba(2,13,17,.30) 100%),
          linear-gradient(180deg,rgba(0,0,0,.16),rgba(0,10,8,.50)),
          url("/static/smart_agri_hero.webp") center/cover fixed no-repeat!important;
      }
      body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 72% 46%,rgba(32,217,255,.08),transparent 28%),radial-gradient(circle at 20% 78%,rgba(57,242,176,.10),transparent 30%);z-index:0;}
      .bg-orb{display:none!important;}
      .auth-card{
        width:min(1450px,100%)!important;
        max-width:none!important;
        min-height:760px!important;
        height:min(86vh,820px)!important;
        display:flex!important;
        align-items:stretch!important;
        gap:clamp(20px,4vw,68px)!important;
        overflow:visible!important;
        background:transparent!important;
        box-shadow:none!important;
        border:0!important;
        position:relative!important;
        z-index:2!important;
        transform:none!important;
      }
      .auth-card:hover{box-shadow:none!important;}
      .auth-card:after{display:none!important;}
      .shine-layer{display:none!important;}
      .left{
        width:auto!important;
        flex:1 1 auto!important;
        min-width:0!important;
        border:0!important;
        background:transparent!important;
        position:relative!important;
        display:flex!important;
        align-items:stretch!important;
      }
      .left-content{
        width:100%!important;
        height:100%!important;
        padding:18px 10px 18px 28px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:space-between!important;
      }
      .right{
        width:min(510px,42vw)!important;
        min-width:430px!important;
        flex:0 0 auto!important;
        align-self:center!important;
        padding:48px 48px 42px!important;
        border:1px solid rgba(255,255,255,.28)!important;
        border-radius:30px!important;
        background:linear-gradient(145deg,rgba(255,255,255,.19),rgba(255,255,255,.055))!important;
        backdrop-filter:blur(24px) saturate(125%)!important;
        -webkit-backdrop-filter:blur(24px) saturate(125%)!important;
        box-shadow:0 28px 70px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.24),0 0 55px rgba(45,240,190,.06)!important;
        position:relative!important;
        overflow:hidden!important;
      }
      .right:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.11),transparent 26%,transparent 70%,rgba(32,217,255,.06));}
      .right>*{position:relative;z-index:1;}
      .agri-brand{display:flex;align-items:center;gap:13px;}
      .agri-logo{width:52px;height:52px;filter:drop-shadow(0 0 16px rgba(57,242,176,.25));flex:0 0 auto;}
      .agri-brand-name{font-size:25px;font-weight:700;letter-spacing:-.6px;color:#fff;line-height:1.05;}
      .agri-brand-name span{color:var(--agri-neon);}
      .agri-brand-sub{margin-top:6px;color:rgba(225,239,235,.68);font-size:16px;line-height:1.2;}
      .agri-nav{position:absolute;right:0;top:5px;display:flex;gap:22px;color:rgba(244,250,247,.70);font-size:14px;}
      .agri-nav span:after{content:"";display:inline-block;width:4px;height:4px;margin:0 0 2px 22px;border-radius:50%;background:rgba(255,255,255,.5);}
      .agri-nav span:last-child:after{display:none;}
      .agri-hero-copy{max-width:610px;margin-top:auto;margin-bottom:auto;padding-top:22px;}
      .agri-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 15px;border:1px solid rgba(57,242,176,.75);border-radius:999px;color:var(--agri-neon);font-size:13px;font-weight:700;letter-spacing:.3px;background:rgba(4,33,28,.36);box-shadow:0 0 25px rgba(57,242,176,.09);}
      .agri-pill i{width:8px;height:8px;border-radius:50%;background:var(--agri-neon);box-shadow:0 0 10px var(--agri-neon);}
      .agri-title{margin:25px 0 14px;font-size:clamp(38px,4.1vw,63px);line-height:1.03;letter-spacing:-2.5px;font-weight:800;color:#fff;}
      .agri-title span{display:block;background:linear-gradient(90deg,#4bf4b6,#22d9ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
      .agri-description{max-width:590px;color:rgba(235,246,242,.80);font-size:16px;line-height:1.65;}
      .agri-features{display:grid;gap:10px;margin-top:26px;max-width:520px;}
      .agri-feature{display:flex;align-items:center;gap:15px;color:rgba(245,251,249,.92);font-size:15px;}
      .agri-feature-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(57,242,176,.22);background:linear-gradient(145deg,rgba(35,244,180,.17),rgba(3,45,40,.35));box-shadow:inset 0 0 18px rgba(57,242,176,.06),0 8px 18px rgba(0,0,0,.16);font-size:20px;}
      .agri-footer{padding-top:10px;}
      .agri-quote{font-family:cursive;font-style:italic;font-size:24px;line-height:1.15;color:rgba(255,255,255,.88);max-width:390px;}
      .agri-quote-line{width:135px;height:3px;border-radius:50%;background:linear-gradient(90deg,#36efae,transparent);transform:rotate(-9deg);margin:8px 0 18px 72px;box-shadow:0 0 12px rgba(57,242,176,.35);}
      .agri-stats{display:flex;gap:28px;}
      .agri-stat{min-width:88px;position:relative;}
      .agri-stat:not(:last-child):after{content:"";position:absolute;right:-15px;top:3px;width:1px;height:42px;background:rgba(255,255,255,.16);}
      .agri-stat strong{display:block;color:var(--agri-neon);font-size:20px;line-height:1.1;}
      .agri-stat small{display:block;margin-top:5px;color:rgba(240,250,247,.70);font-size:11px;}
      .auth-header{margin-bottom:25px!important;}
      .auth-header h1{font-size:35px!important;line-height:1.1!important;letter-spacing:-1.2px!important;color:#fff!important;}
      .auth-header p{font-size:14px!important;color:rgba(224,240,235,.70)!important;margin-top:9px!important;}
      .auth-header a,.forgot-btn{color:var(--agri-neon)!important;}
      input{
        min-height:60px!important;
        padding:17px 18px!important;
        margin-bottom:14px!important;
        border-radius:14px!important;
        border:1px solid rgba(255,255,255,.21)!important;
        background:rgba(9,27,34,.53)!important;
        color:#fff!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
      }
      input:focus{border-color:rgba(57,242,176,.72)!important;box-shadow:0 0 0 3px rgba(57,242,176,.10),0 0 22px rgba(57,242,176,.06)!important;background:rgba(7,29,34,.72)!important;}
      input::placeholder{color:rgba(207,225,220,.56)!important;}
      button.primary-btn{
        min-height:60px!important;
        border-radius:15px!important;
        background:linear-gradient(105deg,#39eead,#29e0bb 48%,#16bfe5)!important;
        color:#031c18!important;
        font-size:16px!important;
        box-shadow:0 12px 32px rgba(31,225,174,.22)!important;
      }
      button.primary-btn:hover{transform:translateY(-2px)!important;box-shadow:0 16px 38px rgba(31,225,174,.34)!important;}
      .google-btn,.guest-btn{
        min-height:55px!important;
        border-radius:14px!important;
        border:1px solid rgba(255,255,255,.18)!important;
        background:rgba(10,31,37,.46)!important;
        color:rgba(247,252,250,.92)!important;
      }
      .google-btn:hover,.guest-btn:hover{border-color:rgba(57,242,176,.45)!important;background:rgba(20,55,57,.58)!important;}
      .forgot-wrapper{margin-bottom:16px!important;}
      .auth-feedback{border-radius:13px!important;}
      .agri-divider{display:flex;align-items:center;gap:13px;margin:21px 0 12px;color:rgba(224,240,235,.60);font-size:13px;}
      .agri-divider:before,.agri-divider:after{content:"";height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18));}
      .agri-divider:after{background:linear-gradient(90deg,rgba(255,255,255,.18),transparent);}
      .agri-login-row{display:flex;align-items:center;justify-content:space-between;margin:1px 0 13px;color:rgba(234,246,242,.82);font-size:13px;}
      .agri-remember{display:flex;align-items:center;gap:9px;cursor:pointer;}
      .agri-remember input{display:none!important;}
      .agri-check{width:21px;height:21px;border-radius:6px;display:grid;place-items:center;background:linear-gradient(135deg,#35edaa,#1cced1);color:#06352a;font-weight:900;font-size:13px;box-shadow:0 4px 14px rgba(50,236,171,.22);}
      .agri-bottom-note{text-align:center;color:rgba(230,243,239,.72);font-size:13px;margin-top:18px;}
      .agri-bottom-note a{color:var(--agri-neon);font-weight:600;cursor:pointer;}
      .agri-form-foot{margin-top:15px!important;}
      @media(max-width:1100px){
        body{padding:22px!important;}
        .auth-card{gap:28px!important;}
        .left-content{padding-left:8px!important;}
        .agri-nav{display:none;}
        .right{width:min(500px,46vw)!important;min-width:400px!important;padding:40px 34px 34px!important;}
      }
      @media(max-width:800px){
        body{padding:18px!important;overflow-y:auto!important;}
        .auth-card{height:auto!important;min-height:0!important;flex-direction:column!important;gap:18px!important;}
        .left{min-height:410px!important;}
        .left-content{padding:8px 4px!important;}
        .agri-hero-copy{margin-top:36px!important;}
        .agri-title{font-size:42px!important;}
        .right{width:100%!important;min-width:0!important;max-width:520px!important;margin:0 auto!important;padding:34px 24px 28px!important;}
      }
      @media(max-width:500px){
        .left{min-height:360px!important;}
        .agri-brand-name{font-size:21px;}
        .agri-brand-sub{font-size:13px;}
        .agri-logo{width:44px;height:44px;}
        .agri-title{font-size:36px!important;letter-spacing:-1.7px;}
        .agri-description{font-size:14px;}
        .agri-feature{font-size:13px;}
        .agri-feature-icon{width:37px;height:37px;font-size:17px;}
        .agri-quote{font-size:19px;}
        .agri-stats{gap:18px;}
        .agri-stat strong{font-size:17px;}
        .auth-header h1{font-size:30px!important;}
      }
    `;
    document.head.appendChild(style);

    const leftContent = card.querySelector(".left-content");
    if (leftContent) {
      leftContent.innerHTML = `
        <div class="agri-top">
          <div class="agri-brand">
            <svg class="agri-logo" viewBox="0 0 64 64" aria-hidden="true">
              <defs><linearGradient id="agriLeafGradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#20d9ff"/><stop offset=".52" stop-color="#36efae"/><stop offset="1" stop-color="#8affc9"/></linearGradient></defs>
              <path fill="url(#agriLeafGradient)" d="M52.8 7.5C37.1 9.7 20.1 16.1 14 29.1c-4.2 9-1.1 17.1 6.8 19.9C14.5 55.2 10.7 58 7.4 61h6.2c4.8-4.7 9.1-8.4 14.2-11.6 8.5-5.2 17.2-8.9 22.1-17.7 3.5-6.2 3.7-15.7 2.9-24.2Z"/>
              <path fill="rgba(4,55,42,.85)" d="M16.8 51.8c8.4-12.7 18.2-20.6 31.4-28.2-11.2 9.4-18.4 17.5-26.8 30.1Z"/>
            </svg>
            <div><div class="agri-brand-name">AgriSense <span>AI</span></div><div class="agri-brand-sub">Smarter Agriculture<br>for a Brighter Tomorrow</div></div>
          </div>
          <div class="agri-nav"><span>Grow Smarter</span><span>Farm Better</span><span>A Greener Tomorrow</span></div>
        </div>
        <div class="agri-hero-copy">
          <div class="agri-pill"><i></i> AI POWERED</div>
          <h2 class="agri-title">Healthy Crops<span>Brighter Futures</span></h2>
          <p class="agri-description">Use the power of AI to detect plant diseases, get crop recommendations, predict yield, check live weather and make smarter farming decisions — all in one place.</p>
          <div class="agri-features">
            <div class="agri-feature"><span class="agri-feature-icon">◒</span><span>Plant Disease Detection</span></div>
            <div class="agri-feature"><span class="agri-feature-icon">♧</span><span>Crop Recommendation</span></div>
            <div class="agri-feature"><span class="agri-feature-icon">▥</span><span>Yield Prediction</span></div>
            <div class="agri-feature"><span class="agri-feature-icon">☁</span><span>Live Weather Insights</span></div>
            <div class="agri-feature"><span class="agri-feature-icon">⚙</span><span>Smart Farming Tools</span></div>
          </div>
        </div>
        <div class="agri-footer">
          <div class="agri-quote">Farming Today<br>for a Greener Tomorrow</div>
          <div class="agri-quote-line"></div>
          <div class="agri-stats"><div class="agri-stat"><strong>10K+</strong><small>Happy Farmers</small></div><div class="agri-stat"><strong>95%</strong><small>Prediction Accuracy</small></div><div class="agri-stat"><strong>50+</strong><small>Crop Types</small></div></div>
        </div>`;
    }

    const login = card.querySelector("#login-box");
    if (login) {
      const forgot = login.querySelector(".forgot-wrapper");
      if (forgot && !login.querySelector(".agri-login-row")) {
        const row = document.createElement("div");
        row.className = "agri-login-row";
        row.innerHTML = '<label class="agri-remember"><span class="agri-check">✓</span><span>Remember me</span></label><span></span>';
        forgot.parentNode.insertBefore(row, forgot);
      }
    }

    card.querySelectorAll(".right > div:not(.hidden)").forEach(box => {
      if (!box.querySelector(".agri-divider")) {
        const buttons = box.querySelector(".google-btn");
        if (buttons) {
          const divider = document.createElement("div");
          divider.className = "agri-divider";
          divider.textContent = "or continue with";
          buttons.parentNode.insertBefore(divider, buttons);
        }
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
