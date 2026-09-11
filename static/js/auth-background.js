/* Authentication background tuned for the crop-field hero image. */
(() => {
  "use strict";
  if (window.__agriAuthBackground) return;
  window.__agriAuthBackground = true;

  const apply = () => {
    const style = document.createElement("style");
    style.textContent = `
      html,body{min-height:100%;}
      body{
        background-color:#17351b!important;
        background-image:
          linear-gradient(90deg,rgba(0,0,0,.14),rgba(0,0,0,0) 48%,rgba(0,0,0,.06)),
          url("https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1920&q=88")!important;
        background-size:cover!important;
        background-position:center center!important;
        background-repeat:no-repeat!important;
        background-attachment:fixed!important;
      }
      body:before{
        background:radial-gradient(circle at 78% 42%,rgba(57,242,176,.035),transparent 28%),radial-gradient(circle at 20% 78%,rgba(0,0,0,.035),transparent 32%)!important;
      }
      .left,.left-content,.auth-card{
        background:transparent!important;
        background-color:transparent!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
        filter:none!important;
      }
      .agri-title,.agri-brand-name,.agri-feature,.agri-description,.agri-brand-sub{
        text-shadow:0 2px 10px rgba(0,0,0,.48)!important;
      }
      .agri-pill{background:rgba(0,20,12,.12)!important;}
      .agri-feature-icon{background:rgba(0,30,16,.12)!important;}
      @media(max-width:800px){body{background-attachment:scroll!important;background-position:center center!important;}}
    `;
    document.head.appendChild(style);
  };

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",apply,{once:true});
  else apply();
})();
