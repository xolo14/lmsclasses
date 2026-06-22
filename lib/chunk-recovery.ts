/** Shared sessionStorage key for stale _next/static chunk recovery after deploy. */
export const CHUNK_RELOAD_STORAGE_KEY = "lms-chunk-reload-v2";

/**
 * Inline script run before React loads. Cached HTML may reference removed chunks;
 * reload once, then cache-bust so users get fresh asset URLs.
 */
export const CHUNK_RECOVERY_SCRIPT = `
(function () {
  var key = "${CHUNK_RELOAD_STORAGE_KEY}";
  var isAuthPage = /^\\/(login|hr\\/login|hr\\/register)(\\?|$)/.test(location.pathname);

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

  function assetSrc(target) {
    if (!target) return "";
    return target.src || target.href || "";
  }

  function bumpReload() {
    var attempts = parseInt(sessionStorage.getItem(key) || "0", 10);
    if (attempts >= 2) {
      document.documentElement.classList.add("lms-recovery-failed");
      markAuthReady();
      return true;
    }
    sessionStorage.setItem(key, String(attempts + 1));
    if (attempts === 0) location.reload();
    else reloadFresh();
    return true;
  }

  addEventListener(
    "error",
    function (event) {
      var src = assetSrc(event.target) || event.filename || "";
      if (src.indexOf("/_next/static/") === -1) return;
      bumpReload();
    },
    true
  );

  function markAuthReady() {
    document.documentElement.classList.remove("lms-auth-pending");
    document.documentElement.classList.add("lms-ready");
  }

  function cssLoaded() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].href || "";
      if (href.indexOf("/_next/static/css/") === -1) continue;
      try {
        if (links[i].sheet) return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  function verifyAuthAssets() {
    if (!isAuthPage) return;
    if (cssLoaded()) {
      markAuthReady();
      return;
    }
    bumpReload();
  }

  if (isAuthPage) {
    document.documentElement.classList.add("lms-auth-pending");
    if (document.readyState === "complete") verifyAuthAssets();
    else addEventListener("load", verifyAuthAssets);
  }
})();
`.trim();
