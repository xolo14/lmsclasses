/** Shared sessionStorage key for stale _next/static chunk recovery after deploy. */
export const CHUNK_RELOAD_STORAGE_KEY = "lms-chunk-reload-v2";

/**
 * Inline script run before React loads. Cached HTML may reference removed chunks;
 * reload once, then cache-bust so users get fresh asset URLs.
 */
export const CHUNK_RECOVERY_SCRIPT = `
(function () {
  var key = "${CHUNK_RELOAD_STORAGE_KEY}";
  try {
    if (location.search.indexOf("_cb=") !== -1) {
      sessionStorage.removeItem(key);
      var clean = new URL(location.href);
      clean.searchParams.delete("_cb");
      var next = clean.pathname + clean.search + clean.hash;
      if (next !== location.pathname + location.search + location.hash) {
        history.replaceState(null, "", next);
      }
    }
  } catch (e) {}

  function reloadFresh() {
    try {
      var url = new URL(location.href);
      url.searchParams.set("_cb", String(Date.now()));
      location.replace(url.toString());
    } catch (e) {
      location.reload();
    }
  }

  addEventListener(
    "error",
    function (event) {
      var target = event.target;
      var src = (target && target.src) || event.filename || "";
      if (src.indexOf("/_next/static/") === -1) return;
      var attempts = parseInt(sessionStorage.getItem(key) || "0", 10);
      if (attempts >= 2) return;
      sessionStorage.setItem(key, String(attempts + 1));
      if (attempts === 0) location.reload();
      else reloadFresh();
    },
    true
  );
})();
`.trim();
