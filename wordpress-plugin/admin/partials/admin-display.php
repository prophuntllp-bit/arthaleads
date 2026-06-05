<?php
if ( ! defined( 'WPINC' ) ) die;

function arthaleads_render_admin_page() {
    $opts         = Arthaleads_Options::get_values();
    $token        = isset( $opts['arthaleads_token'] ) ? $opts['arthaleads_token'] : '';
    $site_name    = isset( $opts['site_name'] ) ? $opts['site_name'] : '';
    $integrations = Arthaleads_Options::get_available_integrations();
    $ajax_url     = admin_url( 'admin-ajax.php' );
    $nonce        = wp_create_nonce( 'arthaleads_nonce' );
    $action       = Arthaleads_Constants::WP_SAVE_ACTION;
    $blog_name    = get_bloginfo( 'name' );
    $is_connected = strlen( trim( $token ) ) > 3;

    $icons  = [ 'cf7'=>'📋','wpforms'=>'📝','elementor_form'=>'⚡','gravity_form'=>'🌀','ninja_form'=>'🥷','forminator_form'=>'🔵','fluent_form'=>'💧','metform'=>'📐' ];
    $colors = [ 'cf7'=>'#0073aa','wpforms'=>'#e27730','elementor_form'=>'#92003b','gravity_form'=>'#333','ninja_form'=>'#15a15e','forminator_form'=>'#8200e9','fluent_form'=>'#1a73e8','metform'=>'#ff4f58' ];

    $Status = Arthaleads_Status::to_array();
?>
<style>
*{box-sizing:border-box}
#al-wrap{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:660px;margin:24px auto;color:#1f2937}
.al-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px 32px;margin-bottom:16px}
.al-head{display:flex;align-items:center;gap:14px}
.al-logo{width:50px;height:50px;background:#FF6B00;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.al-title{font-size:20px;font-weight:800;color:#111827;margin:0 0 2px}
.al-sub{font-size:12px;color:#6b7280;margin:0}
.al-pill{font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-left:auto;white-space:nowrap}
.al-pill-ok{background:#dcfce7;color:#166534}
.al-pill-no{background:#fef3c7;color:#92400e}
.al-lbl{display:block;font-weight:700;font-size:13px;color:#374151;margin-bottom:5px;margin-top:16px}
.al-hint{color:#6b7280;font-size:12px;margin:0 0 6px;line-height:1.5}
.al-inp{width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border .2s;background:#fff;color:#111}
.al-inp:focus{border-color:#FF6B00;box-shadow:0 0 0 3px rgba(255,107,0,.1)}
.al-mono{font-family:monospace;font-size:15px;letter-spacing:.5px}
.al-hr{border:none;border-top:1px solid #f3f4f6;margin:20px 0}
.al-sec{font-weight:700;font-size:13px;color:#374151;margin:0 0 4px}
.al-sec-hint{font-size:12px;color:#6b7280;margin:0 0 14px}
.al-hint-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:12px;color:#7c2d12;line-height:1.6}
.al-hint-box a{color:#FF6B00;font-weight:700;text-decoration:none}
.al-row{display:flex;align-items:center;padding:10px 13px;border-radius:10px;margin-bottom:6px;border:1px solid #e5e7eb;background:#f9fafb;gap:10px}
.al-row-on{background:#f0fdf4;border-color:#86efac}
.al-row-av{background:#fff;border-color:#d1d5db}
.al-row-off{opacity:.55}
.al-ico{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.al-name{font-size:13px;font-weight:600;color:#374151;flex:1}
.al-badge{font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}
.al-b-green{background:#dcfce7;color:#166534}
.al-b-blue{background:#dbeafe;color:#1e40af}
.al-b-gray{background:#f3f4f6;color:#9ca3af}
.al-tog{position:relative;display:inline-block;width:38px;height:21px;flex-shrink:0}
.al-tog input{opacity:0;width:0;height:0;position:absolute}
.al-sl{position:absolute;cursor:pointer;inset:0;background:#d1d5db;border-radius:21px;transition:.25s}
.al-sl:before{content:'';position:absolute;width:15px;height:15px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.al-tog input:checked+.al-sl{background:#FF6B00}
.al-tog input:checked+.al-sl:before{transform:translateX(17px)}
.al-tog input:disabled+.al-sl{opacity:.35;cursor:not-allowed}
.al-btn{display:block;width:100%;padding:12px;background:#FF6B00;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s;margin-top:16px}
.al-btn:hover:not([disabled]){background:#e05a00}
.al-btn[disabled]{background:#d1d5db;color:#9ca3af;cursor:not-allowed}
.al-btn-test{display:block;width:100%;padding:9px;background:transparent;color:#FF6B00;border:1.5px solid #FF6B00;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:8px}
.al-btn-test:hover:not([disabled]){background:#fff7ed}
.al-btn-test[disabled]{opacity:.5;cursor:not-allowed}
.al-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:11px 22px;border-radius:30px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.15);display:none;align-items:center;gap:8px;white-space:nowrap}
.al-toast-ok{background:#fff;border:1.5px solid #86efac;color:#166534}
.al-toast-err{background:#fff;border:1.5px solid #fca5a5;color:#991b1b}
.al-footer{text-align:center;color:#9ca3af;font-size:12px;margin-top:10px}
.al-footer a{color:#FF6B00;text-decoration:none}
</style>

<div id="al-wrap">

    <!-- Header -->
    <div class="al-card">
        <div class="al-head">
            <div class="al-logo" style="background:none;padding:0;overflow:hidden">
                <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . '../assets/logo.png' ); ?>" alt="Arthaleads" width="50" height="50" style="display:block;border-radius:12px;object-fit:cover">
            </div>
            <div style="flex:1">
                <h1 class="al-title">Arthaleads</h1>
                <p class="al-sub">Capture WordPress form leads into your CRM — automatically, in real time</p>
            </div>
            <span id="al-status-pill" class="al-pill <?php echo $is_connected ? 'al-pill-ok' : 'al-pill-no'; ?>">
                <?php echo $is_connected ? '✓ Connected' : '⏳ Not Connected'; ?>
            </span>
        </div>
    </div>

    <!-- Settings -->
    <div class="al-card">
        <div class="al-hint-box">
            <strong>Where do I get my token?</strong><br>
            Log in to <a href="https://crm.arthaleads.com/automations" target="_blank">crm.arthaleads.com → Automations → WordPress / Website</a> and copy your token. Don't have an account? <a href="https://arthaleads.com" target="_blank">Sign up free at arthaleads.com</a>
        </div>

        <label class="al-lbl" style="margin-top:0">Arthaleads Account Token <span style="color:#ef4444">*</span></label>
        <input id="al-token" class="al-inp al-mono" type="text"
            value="<?php echo esc_attr( $token ); ?>"
            placeholder="AW-XXXXXXXX" />

        <label class="al-lbl">Website Name <span style="color:#9ca3af;font-weight:400">(optional)</span></label>
        <p class="al-hint">Shown as lead source in Arthaleads CRM</p>
        <input id="al-sitename" class="al-inp" type="text"
            value="<?php echo esc_attr( $site_name ); ?>"
            placeholder="<?php echo esc_attr( $blog_name ); ?>" />

        <hr class="al-hr">

        <p class="al-sec">Contact Forms</p>
        <p class="al-sec-hint">Toggle the forms you want to capture leads from. Only installed &amp; active plugins can be enabled.</p>

        <div id="al-integrations">
        <?php foreach ( $integrations as $intg ) :
            $key     = $intg['key'];
            $name    = $intg['name'];
            $status  = (int) $intg['status'];
            $enabled = $intg['enabled'] === true || $intg['enabled'] === 'true';
            $can_toggle = $is_connected && $status >= $Status['Activated'];

            // Row class
            if ( $enabled && $status === $Status['Connected'] ) $row_cls = 'al-row-on';
            elseif ( $status >= $Status['Activated'] )          $row_cls = 'al-row-av';
            else                                                  $row_cls = 'al-row-off';

            // Badge
            if ( $enabled && $status === $Status['Connected'] )  { $badge_txt = 'Connected';      $badge_cls = 'al-b-green'; }
            elseif ( $enabled )                                   { $badge_txt = 'Save to Connect'; $badge_cls = 'al-b-blue'; }
            elseif ( $status >= $Status['Activated'] )           { $badge_txt = 'Available';       $badge_cls = 'al-b-blue'; }
            elseif ( $status === $Status['Installed'] )          { $badge_txt = 'Inactive';        $badge_cls = 'al-b-gray'; }
            else                                                  { $badge_txt = 'Not Installed';   $badge_cls = 'al-b-gray'; }

            $icon  = isset( $icons[$key] )  ? $icons[$key]  : '📄';
            $color = isset( $colors[$key] ) ? $colors[$key] : '#6b7280';
        ?>
        <div class="al-row <?php echo esc_attr( $row_cls ); ?>" id="al-row-<?php echo esc_attr( $key ); ?>">
            <div class="al-ico" style="background:<?php echo esc_attr( $color ); ?>22"><?php echo esc_html( $icon ); ?></div>
            <span class="al-name"><?php echo esc_html( $name ); ?></span>
            <span class="al-badge <?php echo esc_attr( $badge_cls ); ?>" id="al-badge-<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $badge_txt ); ?></span>
            <label class="al-tog">
                <input type="checkbox"
                    class="al-toggle-input"
                    data-key="<?php echo esc_attr( $key ); ?>"
                    <?php checked( $enabled ); ?>
                    <?php disabled( ! $can_toggle ); ?>
                />
                <span class="al-sl"></span>
            </label>
        </div>
        <?php endforeach; ?>
        </div>

        <button id="al-save-btn" class="al-btn" disabled>SAVE SETTINGS</button>
        <?php if ( $is_connected ) : ?>
        <button id="al-test-btn" class="al-btn-test">🧪 Send Test Lead</button>
        <?php endif; ?>
    </div>

    <p class="al-footer">
        <a href="https://arthaleads.com" target="_blank">arthaleads.com</a>
        &nbsp;·&nbsp;
        <a href="mailto:support@arthaleads.com">support@arthaleads.com</a>
        &nbsp;·&nbsp;
        <a href="https://www.arthaleads.com" target="_blank">Open CRM</a>
    </p>
</div>

<!-- Toast -->
<div id="al-toast" class="al-toast"></div>

<script>
(function() {
    var AJAX         = <?php echo wp_json_encode( $ajax_url ); ?>;
    var NONCE        = <?php echo wp_json_encode( $nonce ); ?>;
    var ACTION       = <?php echo wp_json_encode( $action ); ?>;
    var STATUS       = <?php echo wp_json_encode( $Status ); ?>;
    var INTEGRATIONS = <?php echo wp_json_encode( $integrations ); ?>;

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

    function rebuildRows(integrations) {
        var icons  = {cf7:'📋',wpforms:'📝',elementor_form:'⚡',gravity_form:'🌀',ninja_form:'🥷',forminator_form:'🔵',fluent_form:'💧',metform:'📐'};
        var colors = {cf7:'#0073aa',wpforms:'#e27730',elementor_form:'#92003b',gravity_form:'#333',ninja_form:'#15a15e',forminator_form:'#8200e9',fluent_form:'#1a73e8',metform:'#ff4f58'};
        var connected = tokenEl.value.trim().length > 3;
        var html = '';
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
            html += '<div class="al-row '+rowCls+'" id="al-row-'+key+'">';
            html += '<div class="al-ico" style="background:'+color+'22">'+icon+'</div>';
            html += '<span class="al-name">'+intg.name+'</span>';
            html += '<span class="al-badge '+badgeCls+'" id="al-badge-'+key+'">'+badgeTxt+'</span>';
            html += '<label class="al-tog"><input type="checkbox" class="al-toggle-input" data-key="'+key+'"'+(enabled?' checked':'')+(canTog?'':' disabled')+'/><span class="al-sl"></span></label>';
            html += '</div>';
        });
        document.getElementById('al-integrations').innerHTML = html;
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
</script>
<?php
}
