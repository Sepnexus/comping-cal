/* =============================================================================
 * Closer Control — "Get ARV / Comp" button for the GoHighLevel contact page.
 *
 * Paste this into your GHL agency Custom JS (the same place as your Zillow / Google
 * buttons). It adds a third button on the contact record. Clicking it opens the
 * Comping tool for the open contact, carrying the locationId + contactId + the
 * shared launch password.
 *
 * ── CONFIGURE THESE TWO LINES ────────────────────────────────────────────────
 *   TOOL_URL        — where the Comping tool is hosted (no trailing slash)
 *   LAUNCH_PASSWORD — the shared secret; must equal the Launch password in
 *                     Admin → Settings on the server.
 * ============================================================================ */
(function () {
  var TOOL_URL = 'https://comps.srv844822.hstgr.cloud';
  var LAUNCH_PASSWORD = 'REPLACE_WITH_LAUNCH_PASSWORD';
  var OPEN_MODE = 'tab'; // 'tab' = new tab · 'modal' = in-page iframe overlay
  var BUTTON_LABEL = 'Get ARV';

  console.log('[cc-comp] button script loaded');

  // ── Parse the GHL URL: /location/<locationId>/contacts/detail/<contactId> ──
  function getLocationId() {
    var m = window.location.pathname.match(/\/location\/([^\/]+)/);
    return m ? m[1] : null;
  }
  function getContactId() {
    var m = window.location.pathname.match(/\/contacts\/detail\/([^\/?#]+)/);
    return m ? m[1] : null;
  }
  function buildLaunchUrl() {
    var loc = getLocationId();
    var contact = getContactId();
    if (!loc || !contact) return null;
    return (
      TOOL_URL +
      '/?locationId=' + encodeURIComponent(loc) +
      '&contactId=' + encodeURIComponent(contact) +
      '&token=' + encodeURIComponent(LAUNCH_PASSWORD)
    );
  }

  // ── Open the tool (new tab, or an in-page modal iframe) ──
  function openModal(url) {
    var existing = document.getElementById('cc-comp-modal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'cc-comp-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(8,11,6,.55);display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    var frameWrap = document.createElement('div');
    frameWrap.style.cssText =
      'position:relative;width:100%;max-width:1200px;height:90vh;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)';
    var close = document.createElement('button');
    close.innerHTML = '&#10006;';
    close.style.cssText =
      'position:absolute;top:10px;right:12px;z-index:2;width:34px;height:34px;border-radius:9px;border:none;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;font-size:14px';
    close.addEventListener('click', function () { overlay.remove(); });
    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'width:100%;height:100%;border:0';
    iframe.allow = 'clipboard-write';
    frameWrap.appendChild(close);
    frameWrap.appendChild(iframe);
    overlay.appendChild(frameWrap);
    document.body.appendChild(overlay);
  }

  function openTool(e) {
    if (e) e.preventDefault();
    var url = buildLaunchUrl();
    if (!url) {
      alert('Open a contact record first, then click ' + BUTTON_LABEL + '.');
      return;
    }
    if (OPEN_MODE === 'modal') openModal(url);
    else window.open(url, '_blank');
  }

  // ── Find the address field in BOTH layouts (edit = input, view = read-only text) ──
  function findAddressContainer() {
    var input =
      document.querySelector('input[name="contact.address1"]') ||
      document.querySelector('input[name*=".address1"]');
    if (input) return input.closest('.hr-form-item') || input.closest('div[id]') || input.parentElement;

    var labels = document.querySelectorAll('span.hr-form-item-label__text, label');
    for (var i = 0; i < labels.length; i++) {
      var t = (labels[i].textContent || '').trim().toLowerCase();
      if (t === 'street address' || t.indexOf('street address') !== -1) {
        return labels[i].closest('.hr-form-item') || labels[i].closest('div[id]') || labels[i].parentElement;
      }
    }
    return null;
  }

  function buildButton() {
    var btn = document.createElement('a');
    btn.id = 'cc-comp-button';
    btn.href = '#';
    btn.title = 'Pull AI comps, ARV & repairs for this contact';
    btn.className = 'btn btn-primary btn-sm';
    btn.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;white-space:nowrap;background:#4C7A3C;border-color:#4C7A3C;color:#fff';
    btn.addEventListener('click', openTool);
    var icon = document.createElement('span');
    icon.textContent = '⚡';
    icon.style.cssText = 'font-size:14px;line-height:1';
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(BUTTON_LABEL));
    return btn;
  }

  // ── Inject the button. Prefer the existing Zillow/Google row; otherwise make one. ──
  function ensureButton() {
    if (document.getElementById('cc-comp-button')) return; // already there

    // Only show on a contact detail page (we need a contactId).
    if (!getContactId()) return;

    var row = document.getElementById('property-search-buttons');
    if (!row) {
      var container = findAddressContainer();
      if (!container) return;
      row = document.createElement('div');
      row.id = 'property-search-buttons';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:nowrap';
      container.insertAdjacentElement('beforebegin', row);
    }
    row.appendChild(buildButton());
  }

  // GHL is a SPA → keep the button present across route/DOM changes.
  setInterval(ensureButton, 600);
  ensureButton();
})();
