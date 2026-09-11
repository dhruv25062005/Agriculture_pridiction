/* Signed-in dashboard field visual system.
 * Presentation only: existing dashboard handlers and data flow stay untouched.
 */
(() => {
  "use strict";
  if (window.__agriDashboardFieldPolish) return;
  window.__agriDashboardFieldPolish = true;

  const css = `
    :root{
      --field-green:#39f2b0;
      --field-cyan:#35dcff;
      --field-ink:#04120e;
      --field-panel:rgba(4,20,15,.70);
      --field-panel-soft:rgba(5,25,19,.52);
      --field-border:rgba(255,255,255,.12);
    }

    body{
      background:
        linear-gradient(180deg,rgba(2,15,10,.80) 0%,rgba(2,16,12,.76) 35%,rgba(1,11,9,.92) 100%),
        linear-gradient(90deg,rgba(1,13,10,.58),rgba(2,14,12,.18) 52%,rgba(1,10,9,.55)),
        url("https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2400&q=88") center/cover fixed!important;
      background-attachment:fixed!important;
    }
    body:before{
      content:"";position:fixed;inset:0;pointer-events:none;z-index:-4;
      background:radial-gradient(circle at 18% 20%,rgba(57,242,176,.09),transparent 27%),radial-gradient(circle at 82% 55%,rgba(53,220,255,.055),transparent 30%);
    }
    body:after{
      content:"";position:fixed;inset:0;pointer-events:none;z-index:-3;
      background-image:linear-gradient(rgba(57,242,176,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(53,220,255,.024) 1px,transparent 1px);
      background-size:72px 72px;mask-image:linear-gradient(to bottom,#000,transparent 88%);opacity:.55;
    }

    .top-navbar{
      background:rgba(3,16,12,.68)!important;
      backdrop-filter:blur(20px) saturate(135%)!important;
      -webkit-backdrop-filter:blur(20px) saturate(135%)!important;
      border-bottom:1px solid rgba(255,255,255,.12)!important;
      box-shadow:0 12px 35px rgba(0,0,0,.26)!important;
    }
    .brand-icon{background:rgba(57,242,176,.10)!important;border-color:rgba(57,242,176,.34)!important;box-shadow:0 0 24px rgba(57,242,176,.13)!important;}
    .brand-title{background:linear-gradient(90deg,#fff 20%,#a7f3d0 65%,#39f2b0)!important;-webkit-background-clip:text!important;background-clip:text!important;}
    .nav-actions{gap:10px!important;}
    .lang-selector,.profile-btn-nav{background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.14)!important;backdrop-filter:blur(10px)!important;}
    .profile-btn-nav:hover,.user-profile-section.open .profile-btn-nav{background:rgba(57,242,176,.12)!important;border-color:rgba(57,242,176,.45)!important;box-shadow:0 8px 25px rgba(57,242,176,.10)!important;}

    main, .main-content, .page-content{position:relative;z-index:1;}
    .hero-section{
      background:linear-gradient(135deg,rgba(5,28,20,.48),rgba(3,19,16,.22))!important;
      border:1px solid rgba(255,255,255,.11)!important;
      box-shadow:0 24px 70px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.09)!important;
      backdrop-filter:blur(8px) saturate(120%)!important;
      -webkit-backdrop-filter:blur(8px) saturate(120%)!important;
    }
    .hero-title,.hero-section h1{ text-shadow:0 6px 28px rgba(0,0,0,.38)!important; }
    .hero-section p,.hero-content p{color:rgba(238,249,245,.76)!important;}

    .section-card,.tool-card,.weather-card,.scanner-card,.yield-card,.crop-card,.info-card,.dashboard-grid>*,.feature-grid>*,.tools-grid>*{
      background:linear-gradient(145deg,rgba(7,29,22,.70),rgba(3,18,15,.52))!important;
      border-color:rgba(255,255,255,.105)!important;
      box-shadow:0 18px 55px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.055)!important;
      backdrop-filter:blur(15px) saturate(118%)!important;
      -webkit-backdrop-filter:blur(15px) saturate(118%)!important;
    }
    .section-card:hover,.tool-card:hover,.weather-card:hover,.scanner-card:hover,.yield-card:hover,.crop-card:hover,.info-card:hover{
      border-color:rgba(57,242,176,.30)!important;
      box-shadow:0 22px 65px rgba(0,0,0,.28),0 0 30px rgba(57,242,176,.045),inset 0 1px 0 rgba(255,255,255,.075)!important;
    }
    .card-title-group h2,.section-card h2,.tool-card h3{color:#f7fffc!important;}
    .card-title-group p,.section-card p,.tool-card p{color:rgba(221,239,232,.67)!important;}

    button,.action-btn,.primary-btn,.tool-button{
      transition:transform .22s cubic-bezier(.16,1,.3,1),box-shadow .22s ease,border-color .22s ease!important;
    }
    button:hover,.action-btn:hover,.tool-button:hover{transform:translateY(-2px);}
    .accent-button,.primary-action,.primary-btn{
      background:linear-gradient(105deg,#39efae,#2cdec0 48%,#25cae7)!important;
      color:#032019!important;
      box-shadow:0 12px 30px rgba(44,224,184,.18),inset 0 1px 0 rgba(255,255,255,.35)!important;
    }
    input,select,textarea{
      background:rgba(2,17,18,.46)!important;
      border-color:rgba(255,255,255,.14)!important;
      color:#f5fffb!important;
    }
    input:focus,select:focus,textarea:focus{border-color:rgba(57,242,176,.55)!important;box-shadow:0 0 0 3px rgba(57,242,176,.07),0 0 22px rgba(57,242,176,.045)!important;}

    .profile-dropdown-card{
      background:rgba(3,20,15,.94)!important;
      backdrop-filter:blur(24px) saturate(130%)!important;
      -webkit-backdrop-filter:blur(24px) saturate(130%)!important;
      border-color:rgba(57,242,176,.24)!important;
      box-shadow:0 28px 80px rgba(0,0,0,.68),0 0 30px rgba(57,242,176,.08)!important;
    }

    .visual-orbit{opacity:.42!important;}
    .visual-command-pill{border-color:rgba(57,242,176,.20)!important;background:rgba(57,242,176,.055)!important;}

    @media(max-width:800px){
      body{background-attachment:scroll!important;}
      .top-navbar{padding:10px 16px!important;}
      .visual-command-pill{display:none!important;}
      .hero-section{backdrop-filter:blur(6px)!important;}
      .section-card,.tool-card,.weather-card,.scanner-card,.yield-card,.crop-card,.info-card{backdrop-filter:blur(10px)!important;}
    }
    @media(prefers-reduced-motion:reduce){button:hover,.action-btn:hover,.tool-button:hover{transform:none!important;}}
  `;

  const style=document.createElement("style");
  style.id="agri-dashboard-field-polish";
  style.textContent=css;
  (document.head||document.documentElement).appendChild(style);
})();
