(function () {
  "use strict";

  var scriptTag = document.currentScript;
  if (!scriptTag) return;

  var apiKey = scriptTag.getAttribute("data-key");
  var targetId = scriptTag.getAttribute("data-target") || "lms-enroll-widget";
  if (!apiKey) {
    console.error("[LMS Widget] data-key attribute is required");
    return;
  }

  var baseUrl = (function () {
    try {
      return new URL(scriptTag.src).origin;
    } catch (e) {
      return "https://lmsclasses.com";
    }
  })();

  var container = document.getElementById(targetId);
  if (!container) {
    console.error("[LMS Widget] Target element #" + targetId + " not found");
    return;
  }

  var shadow = container.attachShadow({ mode: "open" });
  var state = {
    config: null,
    loading: true,
    submitting: false,
    message: "",
    messageType: "",
  };

  var styles =
    ".lms-widget-container{background:#f5f3ef;border:2px solid #000;padding:32px;max-width:480px;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box}" +
    ".lms-widget-container *{box-sizing:border-box}" +
    ".lms-widget-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#444;margin-bottom:8px;display:block}" +
    ".lms-widget-input,.lms-widget-select{width:100%;padding:14px 16px;border:1px solid #999;background:#f5f3ef;font-size:15px;margin-bottom:24px;font-family:inherit}" +
    ".lms-widget-input.emphasis{border:1.5px solid #000}" +
    ".lms-widget-row{display:flex;gap:16px}" +
    ".lms-widget-row > *{flex:1}" +
    ".lms-widget-submit{width:100%;background:#e8392f;color:#fff;padding:18px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit}" +
    ".lms-widget-submit:hover{background:#d12e25}" +
    ".lms-widget-submit:disabled{opacity:.6;cursor:not-allowed}" +
    ".lms-widget-footer{text-align:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin-top:16px}" +
    ".lms-widget-error{color:#e8392f;font-size:13px;margin:-16px 0 16px}" +
    ".lms-widget-success{color:#166534;font-size:14px;margin-bottom:16px;line-height:1.5}" +
    ".lms-widget-loading{padding:24px;text-align:center;color:#555;font-size:14px}";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function render() {
    shadow.innerHTML = "";
    var styleEl = document.createElement("style");
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    if (state.loading) {
      shadow.appendChild(el("div", { className: "lms-widget-loading", text: "Loading enrollment form…" }));
      return;
    }

    if (!state.config) {
      shadow.appendChild(
        el("div", { className: "lms-widget-error", text: state.message || "Unable to load form." })
      );
      return;
    }

    var wrap = el("div", { className: "lms-widget-container" });
    if (state.message) {
      wrap.appendChild(
        el("div", {
          className: state.messageType === "success" ? "lms-widget-success" : "lms-widget-error",
          text: state.message,
        })
      );
    }

    var form = el("form");
    form.addEventListener("submit", onSubmit);

    form.appendChild(el("label", { className: "lms-widget-label", text: "Full Name" }));
    form.appendChild(
      el("input", {
        className: "lms-widget-input emphasis",
        type: "text",
        name: "fullName",
        required: "true",
        placeholder: "Your full name",
      })
    );

    form.appendChild(el("label", { className: "lms-widget-label", text: "Email" }));
    form.appendChild(
      el("input", {
        className: "lms-widget-input",
        type: "email",
        name: "email",
        required: "true",
        placeholder: "you@example.com",
      })
    );

    form.appendChild(el("label", { className: "lms-widget-label", text: "Phone" }));
    form.appendChild(
      el("input", {
        className: "lms-widget-input",
        type: "tel",
        name: "phone",
        required: "true",
        placeholder: "10-digit mobile",
      })
    );

    form.appendChild(el("label", { className: "lms-widget-label", text: "College" }));
    form.appendChild(
      el("input", {
        className: "lms-widget-input",
        type: "text",
        name: "college",
        placeholder: "College / university",
      })
    );

    var row = el("div", { className: "lms-widget-row" });
    var yearWrap = el("div");
    yearWrap.appendChild(el("label", { className: "lms-widget-label", text: "Year of Study" }));
    var yearSelect = el("select", { className: "lms-widget-select", name: "yearOfStudy" });
    yearSelect.appendChild(el("option", { value: "", text: "Select year" }));
    (state.config.formConfig.yearOptions || []).forEach(function (y) {
      yearSelect.appendChild(el("option", { value: y, text: y }));
    });
    yearWrap.appendChild(yearSelect);

    var degreeWrap = el("div");
    degreeWrap.appendChild(el("label", { className: "lms-widget-label", text: "Degree" }));
    degreeWrap.appendChild(
      el("input", {
        className: "lms-widget-input",
        type: "text",
        name: "degree",
        placeholder: "B.Tech, MBA…",
        style: "margin-bottom:0",
      })
    );

    row.appendChild(yearWrap);
    row.appendChild(degreeWrap);
    form.appendChild(row);
    form.appendChild(el("div", { style: "height:24px" }));

    var price = state.config.price || 0;
    var btn = el("button", {
      className: "lms-widget-submit",
      type: "submit",
      text: state.submitting
        ? "Processing…"
        : "Confirm Enrollment ₹" + price.toLocaleString("en-IN") + " →",
    });
    btn.disabled = state.submitting;
    form.appendChild(btn);

    wrap.appendChild(form);
    wrap.appendChild(
      el("div", {
        className: "lms-widget-footer",
        text: "Limited Seats · " + (state.config.orgName || "LMS Classes"),
      })
    );
    shadow.appendChild(wrap);
  }

  function loadRazorpay() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = function () {
        resolve(window.Razorpay);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, json: j };
      });
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.submitting || !state.config) return;

    var fd = new FormData(e.target);
    var payload = {
      key: apiKey,
      fullName: String(fd.get("fullName") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      college: String(fd.get("college") || "").trim() || null,
      yearOfStudy: String(fd.get("yearOfStudy") || "") || null,
      degree: String(fd.get("degree") || "").trim() || null,
      landingPageUrl: window.location.href,
    };

    if (!payload.fullName || !payload.email || !payload.phone) {
      state.message = "Please fill in all required fields.";
      state.messageType = "error";
      render();
      return;
    }

    state.submitting = true;
    state.message = "";
    render();

    postJson(baseUrl + "/api/widget/submit", payload)
      .then(function (res) {
        if (res.json.alreadyEnrolled) {
          state.submitting = false;
          state.message = res.json.message;
          state.messageType = "error";
          render();
          return;
        }
        if (!res.ok) {
          throw new Error(res.json.message || "Could not start enrollment");
        }

        var data = res.json;
        var orderId = data.razorpayOrderId;
        var amount = data.amount;
        var keyId = data.razorpayKeyId || state.config.razorpayKeyId;
        var leadId = data.leadId;

        if (orderId.indexOf("order_test_") === 0) {
          return postJson(baseUrl + "/api/widget/payment-callback", {
            key: apiKey,
            leadId: leadId,
            razorpay_payment_id: "pay_test_" + leadId.slice(0, 8),
            razorpay_order_id: orderId,
            razorpay_signature: "test",
          }).then(handleCallback);
        }

        return loadRazorpay().then(function (Razorpay) {
          return new Promise(function (resolve, reject) {
            var rzp = new Razorpay({
              key: keyId,
              amount: amount,
              currency: data.currency || "INR",
              name: "LMS Classes",
              description: data.courseName || state.config.courseName,
              order_id: orderId,
              prefill: { name: payload.fullName, email: payload.email, contact: payload.phone },
              theme: { color: "#e8392f" },
              handler: function (response) {
                postJson(baseUrl + "/api/widget/payment-callback", {
                  key: apiKey,
                  leadId: leadId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                })
                  .then(handleCallback)
                  .then(resolve)
                  .catch(reject);
              },
              modal: {
                ondismiss: function () {
                  postJson(baseUrl + "/api/widget/payment-callback", {
                    key: apiKey,
                    leadId: leadId,
                    razorpay_order_id: orderId,
                    status: "cancelled",
                    error_description: "User closed payment window",
                  })
                    .then(handleCallback)
                    .then(resolve)
                    .catch(reject);
                },
              },
            });
            rzp.on("payment.failed", function (resp) {
              postJson(baseUrl + "/api/widget/payment-callback", {
                key: apiKey,
                leadId: leadId,
                razorpay_order_id: orderId,
                status: "failed",
                error_description:
                  (resp.error && resp.error.description) || "Payment failed",
              })
                .then(handleCallback)
                .then(resolve)
                .catch(reject);
            });
            rzp.open();
          });
        });
      })
      .catch(function (err) {
        state.submitting = false;
        state.message = err.message || "Something went wrong. Please try again.";
        state.messageType = "error";
        render();
      });
  }

  function handleCallback(res) {
    state.submitting = false;
    if (!res.ok && !res.json.message) {
      state.message = "Payment verification failed.";
      state.messageType = "error";
      render();
      return;
    }
    if (res.json.success && res.json.redirectUrl) {
      state.message = res.json.message || "Enrollment confirmed!";
      state.messageType = "success";
      render();
      setTimeout(function () {
        window.location.href = res.json.redirectUrl;
      }, 1200);
      return;
    }
    state.message =
      res.json.message ||
      "Payment didn't go through. We'll be in touch shortly.";
    state.messageType = "error";
    render();
  }

  fetch(baseUrl + "/api/widget/config?key=" + encodeURIComponent(apiKey))
    .then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, json: j };
      });
    })
    .then(function (res) {
      state.loading = false;
      if (!res.ok) {
        state.message = res.json.message || "Unable to load enrollment form.";
        render();
        return;
      }
      state.config = res.json;
      render();
    })
    .catch(function () {
      state.loading = false;
      state.message = "Network error. Please refresh and try again.";
      render();
    });
})();
