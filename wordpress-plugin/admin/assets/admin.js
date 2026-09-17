(function() {
    var AJAX         = ArthaleadsAdmin.ajaxUrl;
    var NONCE        = ArthaleadsAdmin.nonce;
    var ACTION       = ArthaleadsAdmin.action;
    var STATUS       = ArthaleadsAdmin.status;
    var INTEGRATIONS = ArthaleadsAdmin.integrations;

    var tokenEl    = document.getElementById('al-token');
    var siteEl     = document.getElementById('al-sitename');
    var saveBtn    = document.getElementById('al-save-btn');
    var testBtn    = document.getElementById('al-test-btn');
    var statusPill = document.getElementById('al-status-pill');
    var toastEl    = document.getElementById('al-toast');
    var dirty      = false;

    function updateToggleStates() {
        var connected = tokenEl.value.trim().length > 3;
        document.querySelectorAll('.al-toggle-input').forEach(function(el) {
            var key  = el.dataset.key;
            var intg = INTEGRATIONS.filter(function(i) { return i.key === key; })[0];
            var status = intg ? intg.status : 0;
            var canTog = connected && status >= STATUS.Activated;
            el.disabled = !canTog;
            var row = document.getElementById('al-row-' + key);
            if (row) {
                if (canTog) {
                    row.classList.remove('al-row-off');
                    if (!row.classList.contains('al-row-on')) row.classList.add('al-row-av');
                } else {
                    row.classList.remove('al-row-av');
                    if (!row.classList.contains('al-row-on')) row.classList.add('al-row-off');
                }
            }
        });
    }

    function setDirty() {
        dirty = true;
        saveBtn.disabled = false;
        updateStatusPill();
        updateToggleStates();
    }

    function updateStatusPill() {
        var connected = tokenEl.value.trim().length > 3;
        statusPill.textContent = connected ? '✓ Connected' : '⏳ Not Connected';
        statusPill.className   = 'al-pill ' + (connected ? 'al-pill-ok' : 'al-pill-no');
    }

    function showToast(ok, msg) {
        toastEl.textContent = (ok ? '✅ ' : '❌ ') + msg;
        toastEl.className   = 'al-toast ' + (ok ? 'al-toast-ok' : 'al-toast-err');
        toastEl.style.display = 'flex';
        setTimeout(function() { toastEl.style.display = 'none'; }, 3500);
    }

    function esc(str) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(String(str)));
        return d.innerHTML;
    }

    function rebuildRows(integrations) {
        var icons  = {cf7:'📋',wpforms:'📝',elementor_form:'⚡',gravity_form:'🌀',ninja_form:'🥷',forminator_form:'🔵',fluent_form:'💧',metform:'📐'};
        var colors = {cf7:'#0073aa',wpforms:'#e27730',elementor_form:'#92003b',gravity_form:'#333',ninja_form:'#15a15e',forminator_form:'#8200e9',fluent_form:'#1a73e8',metform:'#ff4f58'};
        var connected = tokenEl.value.trim().length > 3;
        var container = document.getElementById('al-integrations');
        container.innerHTML = '';
        integrations.forEach(function(intg) {
            var key     = intg.key;
            var status  = intg.status;
            var enabled = intg.enabled === true || intg.enabled === 'true';
            var canTog  = connected && status >= STATUS.Activated;
            var rowCls  = (enabled && status === STATUS.Connected) ? 'al-row-on' : (status >= STATUS.Activated ? 'al-row-av' : 'al-row-off');
            var badgeTxt, badgeCls;
            if (enabled && status === STATUS.Connected)  { badgeTxt='Connected';      badgeCls='al-b-green'; }
            else if (enabled)                             { badgeTxt='Save to Connect'; badgeCls='al-b-blue'; }
            else if (status >= STATUS.Activated)          { badgeTxt='Available';       badgeCls='al-b-blue'; }
            else if (status === STATUS.Installed)         { badgeTxt='Inactive';        badgeCls='al-b-gray'; }
            else                                          { badgeTxt='Not Installed';   badgeCls='al-b-gray'; }
            var icon  = icons[key]  || '📄';
            var color = colors[key] || '#6b7280';

            var row = document.createElement('div');
            row.className = 'al-row ' + rowCls;
            row.id = 'al-row-' + esc(key);

            var ico = document.createElement('div');
            ico.className = 'al-ico';
            ico.style.background = esc(color) + '22';
            ico.textContent = icon;

            var nameEl = document.createElement('span');
            nameEl.className = 'al-name';
            nameEl.textContent = intg.name;

            var badge = document.createElement('span');
            badge.className = 'al-badge ' + badgeCls;
            badge.id = 'al-badge-' + esc(key);
            badge.textContent = badgeTxt;

            var label = document.createElement('label');
            label.className = 'al-tog';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'al-toggle-input';
            cb.dataset.key = key;
            cb.checked = enabled;
            cb.disabled = !canTog;
            var sl = document.createElement('span');
            sl.className = 'al-sl';
            label.appendChild(cb);
            label.appendChild(sl);

            row.appendChild(ico);
            row.appendChild(nameEl);
            row.appendChild(badge);
            row.appendChild(label);
            container.appendChild(row);
        });
        bindToggleEvents();
    }

    function getToggles() {
        var result = {};
        document.querySelectorAll('.al-toggle-input').forEach(function(el) {
            result[el.dataset.key] = el.checked ? 'true' : 'false';
        });
        return result;
    }

    function bindToggleEvents() {
        document.querySelectorAll('.al-toggle-input').forEach(function(el) {
            el.addEventListener('change', setDirty);
        });
    }

    // Token / site name changes
    tokenEl.addEventListener('input', setDirty);
    siteEl.addEventListener('input', setDirty);
    bindToggleEvents();

    // Enable toggles immediately based on current token value (handles already-saved tokens)
    updateToggleStates();

    // Save
    saveBtn.addEventListener('click', function() {
        var token = tokenEl.value.trim();
        if (!token) { showToast(false, 'Please enter your Arthaleads token'); return; }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        var toggles = getToggles();
        var params = new URLSearchParams({ action: ACTION, nonce: NONCE });
        params.append('fields[arthaleads_token]', token);
        params.append('fields[site_name]', siteEl.value.trim());
        Object.keys(toggles).forEach(function(k) { params.append('fields['+k+']', toggles[k]); });
        fetch(AJAX, { method: 'POST', body: params })
            .then(function(r) { return r.json(); })
            .then(function(json) {
                if (json.success) {
                    rebuildRows(json.data.integrations);
                    dirty = false;
                    saveBtn.textContent = 'SAVE SETTINGS';
                    showToast(true, 'Settings saved!');
                    updateStatusPill();
                    // Show test button if not already there
                    if (!testBtn && token.length > 3) {
                        var btn = document.createElement('button');
                        btn.id = 'al-test-btn';
                        btn.className = 'al-btn-test';
                        btn.textContent = '🧪 Send Test Lead';
                        saveBtn.parentNode.insertBefore(btn, saveBtn.nextSibling);
                        bindTestBtn(btn);
                    }
                } else {
                    saveBtn.textContent = 'SAVE SETTINGS';
                    saveBtn.disabled = false;
                    showToast(false, 'Save failed. Try again.');
                }
            })
            .catch(function() {
                saveBtn.textContent = 'SAVE SETTINGS';
                saveBtn.disabled = false;
                showToast(false, 'Network error. Try again.');
            });
    });

    function bindTestBtn(btn) {
        btn = btn || testBtn;
        if (!btn) return;
        btn.addEventListener('click', function() {
            btn.disabled = true;
            btn.textContent = 'Sending…';
            var params = new URLSearchParams({ action: 'arthaleads_test_lead', nonce: NONCE });
            fetch(AJAX, { method: 'POST', body: params })
                .then(function(r) { return r.json(); })
                .then(function(json) {
                    if (json.success) {
                        showToast(true, 'Test lead sent — check your CRM!');
                        btn.textContent = '✅ Test lead sent!';
                    } else {
                        var msg = (json.data && json.data.message) ? json.data.message : 'Failed';
                        showToast(false, msg);
                        btn.textContent = '❌ ' + msg;
                    }
                })
                .catch(function() {
                    showToast(false, 'Network error');
                    btn.textContent = '❌ Network error';
                })
                .finally(function() {
                    btn.disabled = false;
                    setTimeout(function() { btn.textContent = '🧪 Send Test Lead'; }, 4000);
                });
        });
    }
    bindTestBtn();
})();
