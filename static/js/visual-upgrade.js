/* KisanAI Premium Visual Upgrade
 * Pure front-end enhancement: no API, auth, model, or form behavior changes.
 */
(function () {
  "use strict";
  if (window.__kisanAiVisualUpgrade) return;
  window.__kisanAiVisualUpgrade = true;

  const css = `
    :root {
      --visual-lime: #34d399;
      --visual-cyan: #22d3ee;
      --visual-violet: #8b5cf6;
      --visual-glow: rgba(52,211,153,.22);
    }

    body.visual-upgraded::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -3;
      pointer-events: none;
      opacity: .22;
      background-image:
        linear-gradient(rgba(52,211,153,.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34,211,238,.045) 1px, transparent 1px);
      background-size: 72px 72px;
      mask-image: linear-gradient(to bottom, #000, transparent 82%);
    }

    body.visual-upgraded::after {
      content: "";
      position: fixed;
      width: 520px;
      height: 520px;
      left: var(--mouse-x, 50%);
      top: var(--mouse-y, 20%);
      transform: translate(-50%, -50%);
      border-radius: 50%;
      pointer-events: none;
      z-index: -1;
      background: radial-gradient(circle, rgba(52,211,153,.07), transparent 66%);
      transition: left .18s ease-out, top .18s ease-out;
    }

    .visual-command-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-left: 12px;
      padding: 6px 10px;
      border: 1px solid rgba(52,211,153,.22);
      border-radius: 999px;
      background: rgba(16,185,129,.07);
      color: #a7f3d0;
      font: 600 10px/1 'Plus Jakarta Sans', sans-serif;
      letter-spacing: .12em;
      text-transform: uppercase;
      vertical-align: middle;
      box-shadow: inset 0 0 18px rgba(52,211,153,.04);
    }
    .visual-command-pill i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 10px #34d399;
      animation: visualPulse 1.8s ease-in-out infinite;
    }

    .visual-orbit {
      position: fixed;
      width: 280px;
      height: 280px;
      right: -100px;
      top: 150px;
      border: 1px solid rgba(52,211,153,.08);
      border-radius: 50%;
      pointer-events: none;
      z-index: -2;
      animation: visualOrbit 18s linear infinite;
    }
    .visual-orbit::after {
      content: "";
      position: absolute;
      width: 7px;
      height: 7px;
      top: 36px;
      left: 50%;
      border-radius: 50%;
      background: #22d3ee;
      box-shadow: 0 0 18px #22d3ee;
    }

    .visual-card-lift {
      transition: transform .35s cubic-bezier(.16,1,.3,1), border-color .35s ease, box-shadow .35s ease !important;
      will-change: transform;
    }
    .visual-card-lift:hover {
      transform: translateY(-5px) !important;
      border-color: rgba(52,211,153,.32) !important;
      box-shadow: 0 18px 55px rgba(0,0,0,.28), 0 0 28px rgba(52,211,153,.055) !important;
    }

    .visual-reveal {
      opacity: 0;
      transform: translateY(14px);
      transition: opacity .65s ease, transform .65s cubic-bezier(.16,1,.3,1);
    }
    .visual-reveal.is-visible { opacity: 1; transform: none; }

    .visual-progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      z-index: 3000;
      pointer-events: none;
      transform-origin: left center;
      transform: scaleX(0);
      background: linear-gradient(90deg, #10b981, #22d3ee, #8b5cf6);
      box-shadow: 0 0 14px rgba(34,211,238,.55);
    }

    .visual-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      z-index: 2900;
      transform: translate(-50%, 18px);
      opacity: 0;
      pointer-events: none;
      padding: 10px 14px;
      border: 1px solid rgba(52,211,153,.25);
      border-radius: 12px;
      background: rgba(4,20,14,.88);
      backdrop-filter: blur(18px);
      color: #d1fae5;
      font: 600 12px/1.3 'Plus Jakarta Sans', sans-serif;
      box-shadow: 0 16px 45px rgba(0,0,0,.4);
      transition: opacity .25s ease, transform .25s ease;
    }
    .visual-toast.show { opacity: 1; transform: translate(-50%, 0); }

    @keyframes visualPulse { 0%,100%{opacity:.55;transform:scale(.8)} 50%{opacity:1;transform:scale(1.15)} }
    @keyframes visualOrbit { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      .visual-orbit, .visual-command-pill i { animation: none !important; }
      .visual-reveal { opacity: 1; transform: none; transition: none; }
    }
    @media (max-width: 720px) {
      .visual-command-pill { display: none; }
      .visual-orbit { opacity: .5; width: 180px; height: 180px; right: -80px; }
      body.visual-upgraded::before { background-size: 52px 52px; }
    }
  `;

  const style = document.createElement("style");
  style.id = "kisanai-visual-upgrade-style";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  document.body?.classList.add("visual-upgraded");

  function init() {
    document.body.classList.add("visual-upgraded");

    const progress = document.createElement("div");
    progress.className = "visual-progress";
    document.body.appendChild(progress);

    const orbit = document.createElement("div");
    orbit.className = "visual-orbit";
    orbit.setAttribute("aria-hidden", "true");
    document.body.appendChild(orbit);

    const brand = document.querySelector(".brand-wrapper");
    if (brand && !brand.querySelector(".visual-command-pill")) {
      const pill = document.createElement("span");
      pill.className = "visual-command-pill";
      pill.innerHTML = '<i></i><span>AI field intelligence online</span>';
      brand.appendChild(pill);
    }

    const revealSelectors = [
      ".hero-section", ".hero-content", ".dashboard-grid", ".feature-grid",
      ".tools-grid", ".section-card", ".tool-card", ".weather-card", ".scanner-card",
      ".yield-card", ".crop-card", ".info-card"
    ];
    const revealTargets = [...new Set(revealSelectors.flatMap(s => [...document.querySelectorAll(s)]))];
    revealTargets.slice(0, 80).forEach((el, index) => {
      if (el.closest(".profile-dropdown-card")) return;
      el.classList.add("visual-reveal", "visual-card-lift");
      el.style.transitionDelay = `${Math.min(index * 35, 240)}ms`;
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: .08 });
      revealTargets.forEach(el => observer.observe(el));
    } else {
      revealTargets.forEach(el => el.classList.add("is-visible"));
    }

    let raf = 0;
    window.addEventListener("mousemove", e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
        document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
        raf = 0;
      });
    }, { passive: true });

    const updateProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.transform = `scaleX(${Math.min(1, window.scrollY / max)})`;
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
