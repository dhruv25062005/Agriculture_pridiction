/* Transparent premium authentication UI.
 * Presentation only: existing auth IDs, handlers and navigation stay intact.
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
        --agri-muted:rgba(235,247,243,.66);
      }

      html,body{min-height:100%;}
      body{
        min-height:100vh!important;
        padding:24px 34px!important;
        align-items:center!important;
        justify-content:center!important;
        color:var(--agri-white)!important;
        background:
          linear-gradient(90deg,rgba(1,12,14,.28),rgba(1,14,16,.08) 52%,rgba(1,10,13,.12)),
          url("/static/smart_agri_hero.webp") center/cover fixed no-repeat!important;
      }
      body:before{
        content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
        background:radial-gradient(circle at 73% 48%,rgba(32,217,255,.055),transparent 25%),
                   radial-gradient(circle at 18% 76%,rgba(57,242,176,.06),transparent 28%);
      }
      .bg-orb{display:none!important;}

      /* The hero side is completely transparent: no panel backdrop/filter/blur. */
      .auth-card{
        width:min(1420px,100%)!important;
        max-width:none!important;
        min-height:0!important;
        height:min(88vh,800px)!important;
        display:flex!important;
        align-items:center!important;
        gap:clamp(26px,5vw,80px)!important;
        overflow:visible!important;
        background:transparent!important;
        background-color:transparent!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
        filter:none!important;
        box-shadow:none!important;
        border:0!important;
        position:relative!important;
        z-index:2!important;
        transform:none!important;
      }
      .auth-card:hover{box-shadow:none!important;}
      .auth-card:after{display:none!important;}

      .left{
        width:auto!important;
        flex:1 1 auto!important;
        min-width:0!important;
        border:0!important;
        background:transparent!important;
        background-color:transparent!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
        filter:none!important;
        display:flex!important;
        align-items:center!important;
      }
      .left-content{
        width:100%!important;
        height:auto!important;
        padding:0 10px 0 26px!important;
        display:block!important;
        background:transparent!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
        filter:none!important;
      }

      /* Keep the hero copy deliberately short so the photograph remains visible. */
      .agri-brand{display:flex;align-items:center;gap:12px;margin-bottom:34px;}
      .agri-logo{width:48px;height:48px;filter:drop-shadow(0 0 16px rgba(57,242,176,.3));flex:0 0 auto;}
      .agri-brand-name{font-size:25px;font-weight:700;letter-spacing:-.6px;color:#fff;line-height:1.05;}
      .agri-brand-name span{color:var(--agri-neon);}
      .agri-brand-sub{margin-top:5px;color:rgba(235,247,243,.68);font-size:14px;line-height:1.2;}
      .agri-nav{display:none!important;}
      .agri-pill{
        display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border:1px solid rgba(57,242,176,.72);
        border-radius:999px;color:var(--agri-neon);font-size:12px;font-weight:700;background:rgba(0,35,29,.18);
        box-shadow:0 0 22px rgba(57,242,176,.08);
      }
      .agri-pill i{width:7px;height:7px;border-radius:50%;background:var(--agri-neon);box-shadow:0 0 9px var(--agri-neon);}
      .agri-hero-copy{max-width:610px;margin:0!important;padding:0!important;}
      .agri-title{margin:20px 0 12px;font-size:clamp(38px,4vw,60px);line-height:1.03;letter-spacing:-2.5px;font-weight:800;color:#fff;text-shadow:0 5px 24px rgba(0,0,0,.28);}
      .agri-title span{display:block;background:linear-gradient(90deg,#4bf4b6,#22d9ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
      .agri-description{max-width:500px;color:rgba(240,249,246,.78);font-size:15px;line-height:1.55;}
      .agri-features{display:grid;gap:9px;margin-top:22px;max-width:450px;}
      .agri-feature{display:flex;align-items:center;gap:12px;color:rgba(250,255,253,.88);font-size:14px;}
      .agri-feature-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;border:1px solid rgba(57,242,176,.20);background:rgba(4,38,35,.18);backdrop-filter:none;-webkit-backdrop-filter:none;font-size:18px;}
      .agri-footer{display:none!important;}

      /* Only the authentication form keeps a subtle glass surface. */
      .right{
        width:min(480px,38vw)!important;
        min-width:390px!important;
        flex:0 0 auto!important;
        align-self:center!important;
        padding:38px 42px 32px!important;
        border:1px solid rgba(255,255,255,.22)!important;
        border-radius:27px!important;
        background:rgba(7,24,27,.16)!important;
        backdrop-filter:blur(13px) saturate(120%)!important;
        -webkit-backdrop-filter:blur(13px) saturate(120%)!important;
        box-shadow:0 22px 55px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.20),0 0 35px rgba(45,240,190,.04)!important;
        position:relative!important;
        overflow:hidden!important;
      }
      .right:before{
        content:"";position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(135deg,rgba(255,255,255,.07),transparent 30%,rgba(32,217,255,.025));
      }
      .right>*{position:relative;z-index:1;}

      .auth-header{margin-bottom:21px!important;}
      .auth-header h1{font-size:31px!important;line-height:1.1!important;letter-spacing:-1px!important;color:#fff!important;}
      .auth-header p{font-size:13px!important;color:rgba(231,245,241,.65)!important;margin-top:7px!important;}
      .auth-header a,.forgot-btn{color:var(--agri-neon)!important;}

      input{
        min-height:56px!important;
        padding:15px 17px!important;
        margin-bottom:12px!important;
        border-radius:13px!important;
        border:1px solid rgba(255,255,255,.20)!important;
        background:rgba(5,25,30,.25)!important;
        color:#fff!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
      }
      input:focus{
        border-color:rgba(57,242,176,.68)!important;
        box-shadow:0 0 0 3px rgba(57,242,176,.08),0 0 20px rgba(57,242,176,.06)!important;
        background:rgba(5,30,32,.40)!important;
      }
      input::placeholder{color:rgba(221,238,233,.55)!important;}

      button.primary-btn{
        min-height:56px!important;
        border-radius:14px!important;
        background:linear-gradient(105deg,#39eead,#29e0bb 48%,#16bfe5)!important;
        color:#031c18!important;
        font-size:15px!important;
        box-shadow:0 10px 26px rgba(31,225,174,.20)!important;
      }
      button.primary-btn:hover{transform:translateY(-2px)!important;box-shadow:0 14px 32px rgba(31,225,174,.30)!important;}
      .google-btn,.guest-btn{
        min-height:49px!important;
        border-radius:13px!important;
        border:1px solid rgba(255,255,255,.18)!important;
        background:rgba(5,25,30,.20)!important;
        color:rgba(250,255,253,.90)!important;
      }
      .google-btn:hover,.guest-btn:hover{border-color:rgba(57,242,176,.42)!important;background:rgba(20,55,57,.30)!important;}
      .forgot-wrapper{margin-bottom:13px!important;}
      .auth-feedback{border-radius:12px!important;}
      .agri-divider{display:flex;align-items:center;gap:12px;margin:18px 0 11px;color:rgba(224,240,235,.54);font-size:12px;}
      .agri-divider:before,.agri-divider:after{content:"";height:1px;flex:1;background:rgba(255,255,255,.15);}
      .agri-login-row{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px;color:rgba(234,246,242,.78);font-size:12px;}
      .agri-remember{display:flex;align-items:center;gap:8px;cursor:pointer;}
      .agri-remember input{display:none!important;}
      .agri-check{width:19px;height:19px;border-radius:5px;display:grid;place-items:center;background:linear-gradient(135deg,#35edaa,#1cced1);color:#06352a;font-weight:900;font-size:12px;}
      .agri-bottom-note{text-align:center;color:rgba(230,243,239,.62);font-size:12px;margin-top:15px;}
      .agri-bottom-note a{color:var(--agri-neon);font-weight:600;cursor:pointer;}

      @media(max-width:1050px){
        body{padding:20px!important;}
        .auth-card{gap:30px!important;}
        .left-content{padding-left:5px!important;}
        .right{width:min(460px,43vw)!important;min-width:370px!important;padding:34px 30px 28px!important;}
      }
      @media(max-width:800px){
        body{padding:16px!important;overflow-y:auto!important;}
        .auth-card{height:auto!important;flex-direction:column!important;gap:18px!important;}
        .left{width:100%!important;min-height:310px!important;}
        .left-content{padding:8px 4px!important;}
        .agri-brand{margin-bottom:25px;}
        .agri-hero-copy{max-width:560px;}
        .agri-title{font-size:42px!important;}
        .right{width:100%!important;min-width:0!important;max-width:500px!important;margin:0 auto!important;padding:30px 24px 25px!important;}
      }
      @media(max-width:500px){
        .left{min-height:270px!important;}
        .agri-logo{width:42px;height:42px;}
        .agri-brand-name{font-size:21px;}
        .agri-brand-sub{font-size:12px;}
        .agri-title{font-size:35px!important;letter-spacing:-1.7px;}
        .agri-description{font-size:13px;}
        .agri-features{gap:7px;margin-top:16px;}
        .agri-feature{font-size:12px;}
        .agri-feature-icon{width:34px;height:34px;font-size:16px;}
        .auth-header h1{font-size:28px!important;}
      }
    `;
    document.head.appendChild(style);

    const leftContent = card.querySelector(".left-content");
    if (leftContent) {
      leftContent.innerHTML = `
        <div class="agri-brand">
          <svg class="agri-logo" viewBox="0 0 64 64" aria-hidden="true">
            <defs><linearGradient id="agriLeafGradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#20d9ff"/><stop offset=".52" stop-color="#36efae"/><stop offset="1" stop-color="#8affc9"/></linearGradient></defs>
            <path fill="url(#agriLeafGradient)" d="M52.8 7.5C37.1 9.7 20.1 16.1 14 29.1c-4.2 9-1.1 17.1 6.8 19.9C14.5 55.2 10.7 58 7.4 61h6.2c4.8-4.7 9.1-8.4 14.2-11.6 8.5-5.2 17.2-8.9 22.1-17.7 3.5-6.2 3.7-15.7 2.9-24.2Z"/>
            <path fill="rgba(4,55,42,.85)" d="M16.8 51.8c8.4-12.7 18.2-20.6 31.4-28.2-11.2 9.4-18.4 17.5-26.8 30.1Z"/>
          </svg>
          <div><div class="agri-brand-name">AI Smart Agriculture</div><div class="agri-brand-sub">Smarter agriculture</div></div>
        </div>
        <div class="agri-hero-copy">
          <div class="agri-pill"><i></i> AI POWERED</div>
          <h2 class="agri-title">Healthy Crops<span>Brighter Futures</span></h2>
          <p class="agri-description">AI tools for plant health, crop recommendations, yield prediction and weather insights.</p>
          <div class="agri-features">
            <div class="agri-feature"><span class="agri-feature-icon">🌿</span><span>Plant Health Detection</span></div>
            <div class="agri-feature"><span class="agri-feature-icon">🌱</span><span>Smart Crop Recommendations</span></div>
            <div class="agri-feature"><span class="agri-feature-icon">📊</span><span>Yield &amp; Weather Insights</span></div>
          </div>
        </div>
      `;
    }

    // Remove duplicated copy while retaining every functional form and action.
    const login = card.querySelector("#login-box .auth-header p");
    if (login) login.innerHTML = `Sign in to continue to <strong style="color:var(--agri-neon)">AgriSense AI</strong>`;
    const signup = card.querySelector("#signup-box .auth-header p");
    if (signup) signup.innerHTML = `Already have an account? <a onclick="showLogin()">Sign in</a>`;
    const forgot = card.querySelector("#forgot-box .auth-header p");
    if (forgot) forgot.textContent = "Enter your email to reset your password";

    const loginBtn = card.querySelector("#signin-form .primary-btn");
    if (loginBtn) loginBtn.innerHTML = `Sign In <span style="margin-left:7px;font-size:18px">→</span>`;
    const signupBtn = card.querySelector("#signup-form .primary-btn");
    if (signupBtn) signupBtn.textContent = "Create Account";

    // Replace the verbose guest CTA with a compact secondary action.
    card.querySelectorAll(".guest-btn").forEach((btn) => {
      btn.textContent = "Continue as Guest";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
