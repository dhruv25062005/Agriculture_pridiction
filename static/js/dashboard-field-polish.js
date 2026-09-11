/* Signed-in dashboard field visual system.
 * The visual rules are loaded as render-blocking CSS by the signed-in route
 * so the legacy dashboard is never painted first. This file remains as a
 * lightweight compatibility marker for pages that still reference it.
 */
(() => {
  "use strict";
  document.documentElement.classList.add("agri-dashboard-field-ready");
})();
