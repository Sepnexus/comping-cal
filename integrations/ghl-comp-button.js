/* =============================================================================
 * Closer Control — "Get ARV / Comp" button for the GoHighLevel contact page.
 *
 * Paste into your GHL agency Custom JS, WRAPPED IN <script>…</script> (the same as
 * your Zillow / Google buttons). Adds a "Get ARV" button on the contact record that
 * opens the Comping tool for the open contact — passing locationId + contactId + the
 * contact's name/address (read straight from the page) + the shared launch password.
 *
 * ── CONFIGURE THESE TWO LINES ────────────────────────────────────────────────
 *   TOOL_URL        — where the Comping tool is hosted (no trailing slash)
 *   LAUNCH_PASSWORD — the value from Admin → Settings → Launch password
 * ============================================================================ */
(function () {
  var TOOL_URL = 'https://comps.srv844822.hstgr.cloud';
  var LAUNCH_PASSWORD = 'REPLACE_WITH_LAUNCH_PASSWORD';
  var OPEN_MODE = 'tab'; // 'tab' = new tab · 'modal' = in-page iframe overlay
  var BUTTON_LABEL = 'Get ARV';

  console.log('[cc-comp] button script loaded');

  // ── IDs from the URL: /location/<locationId>/contacts/detail/<contactId> ──
  function getLocationId() { var m = location.pathname.match(/\/location\/([^\/]+)/); return m ? m[1] : null; }
  function getContactId() { var m = location.pathname.match(/\/contacts\/detail\/([^\/?#]+)/); return m ? m[1] : null; }

  // ── Read a contact field from EITHER layout: edit-mode <input> or read-only text ──
  function fieldValue(node) {
    if (!node) return '';
    if ('value' in node) return node.value || '';
    return (node.textContent || '').trim();
  }
  function findByLabel(labelText) {
    var want = labelText.toLowerCase();
    var spans = document.querySelectorAll('span.hr-form-item-label__text, label');
    for (var i = 0; i < spans.length; i++) {
      var t = (spans[i].textContent || '').trim().toLowerCase();
      if (t === want || t.indexOf(want) !== -1) {
        var wrap = spans[i].closest('.hr-form-item') || spans[i].closest('div[id]') || spans[i].parentElement;
        if (!wrap) continue;
        var el = wrap.querySelector('p.hr-input__text-content--active') || wrap.querySelector('input');
        if (el) return el;
      }
    }
    return null;
  }
  function field(inputName, label) {
    return fieldValue(document.querySelector('input[name="' + inputName + '"]') || findByLabel(label));
  }
  function getAddress() {
    var street = field('contact.address1', 'Street Address');
    var city = field('contact.city', 'City');
    var state = field('contact.state', 'State');
    var zip = field('contact.postal_code', 'Zip Code') || fieldValue(findByLabel('Postal Code'));
    var tail = [state, zip].filter(Boolean).join(' ');
    return [street, city, tail].filter(Boolean).join(', ');
  }
  function getName() {
    var first = field('contact.first_name', 'First Name');
    var last = field('contact.last_name', 'Last Name');
    return [first, last].filter(Boolean).join(' ').trim();
  }

  function buildLaunchUrl() {
    var loc = getLocationId(), contact = getContactId();
    if (!loc || !contact) return null;
    var url =
      TOOL_URL +
      '/?locationId=' + encodeURIComponent(loc) +
      '&contactId=' + encodeURIComponent(contact) +
      '&token=' + encodeURIComponent(LAUNCH_PASSWORD);
    var addr = getAddress(); if (addr) url += '&address=' + encodeURIComponent(addr);
    var name = getName(); if (name) url += '&name=' + encodeURIComponent(name);
    return url;
  }

  // ── Open the tool (new tab, or an in-page modal iframe) ──
  function openModal(url) {
    var ex = document.getElementById('cc-comp-modal'); if (ex) ex.remove();
    var o = document.createElement('div'); o.id = 'cc-comp-modal';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,11,6,.55);display:flex;align-items:center;justify-content:center;padding:24px';
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    var w = document.createElement('div');
    w.style.cssText = 'position:relative;width:100%;max-width:1200px;height:90vh;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)';
    var c = document.createElement('button'); c.innerHTML = '&#10006;';
    c.style.cssText = 'position:absolute;top:10px;right:12px;z-index:2;width:34px;height:34px;border-radius:9px;border:none;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;font-size:14px';
    c.addEventListener('click', function () { o.remove(); });
    var f = document.createElement('iframe'); f.src = url; f.style.cssText = 'width:100%;height:100%;border:0'; f.allow = 'clipboard-write';
    w.appendChild(c); w.appendChild(f); o.appendChild(w); document.body.appendChild(o);
  }
  function openTool(e) {
    if (e) e.preventDefault();
    var url = buildLaunchUrl();
    if (!url) { alert('Open a contact record first, then click ' + BUTTON_LABEL + '.'); return; }
    if (OPEN_MODE === 'modal') openModal(url); else window.open(url, '_blank');
  }

  // ── Inject the button. Prefer the existing Zillow/Google row; else make one. ──
  function addressContainer() {
    var input = document.querySelector('input[name="contact.address1"]') || document.querySelector('input[name*=".address1"]');
    if (input) return input.closest('.hr-form-item') || input.closest('div[id]') || input.parentElement;
    var lbl = findByLabel('Street Address');
    return lbl ? (lbl.closest('.hr-form-item') || lbl.closest('div[id]') || lbl.parentElement) : null;
  }
  function buildButton() {
    var b = document.createElement('a'); b.id = 'cc-comp-button'; b.href = '#';
    b.title = 'Pull AI comps, ARV & repairs for this contact'; b.className = 'btn btn-primary btn-sm';
    b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;white-space:nowrap;background:#4C7A3C;border-color:#4C7A3C;color:#fff';
    b.addEventListener('click', openTool);
    var i = document.createElement('span'); i.textContent = '⚡'; i.style.cssText = 'font-size:14px;line-height:1';
    b.appendChild(i); b.appendChild(document.createTextNode(BUTTON_LABEL));
    return b;
  }
  function ensureButton() {
    if (document.getElementById('cc-comp-button')) return;
    if (!getContactId()) return;
    var row = document.getElementById('property-search-buttons');
    if (!row) {
      var container = addressContainer(); if (!container) return;
      row = document.createElement('div'); row.id = 'property-search-buttons';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:nowrap';
      container.insertAdjacentElement('beforebegin', row);
    }
    row.appendChild(buildButton());
  }

  // GHL is a SPA → keep the button present across route/DOM changes.
  setInterval(ensureButton, 600);
  ensureButton();
})();
