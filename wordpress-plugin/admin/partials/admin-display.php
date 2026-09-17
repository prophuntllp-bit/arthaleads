<?php
if ( ! defined( 'WPINC' ) ) die;

function arthaleads_render_admin_page() {
    $opts         = Arthaleads_Options::get_values();
    $token        = isset( $opts['arthaleads_token'] ) ? $opts['arthaleads_token'] : '';
    $site_name    = isset( $opts['site_name'] ) ? $opts['site_name'] : '';
    $integrations = Arthaleads_Options::get_available_integrations();
    $blog_name    = get_bloginfo( 'name' );
    $is_connected = strlen( trim( $token ) ) > 3;

    $icons  = [ 'cf7'=>'📋','wpforms'=>'📝','elementor_form'=>'⚡','gravity_form'=>'🌀','ninja_form'=>'🥷','forminator_form'=>'🔵','fluent_form'=>'💧','metform'=>'📐' ];
    $colors = [ 'cf7'=>'#0073aa','wpforms'=>'#e27730','elementor_form'=>'#92003b','gravity_form'=>'#333','ninja_form'=>'#15a15e','forminator_form'=>'#8200e9','fluent_form'=>'#1a73e8','metform'=>'#ff4f58' ];

    $Status = Arthaleads_Status::to_array();
?>

<div id="al-wrap">

    <!-- Header -->
    <div class="al-card">
        <div class="al-head">
            <div class="al-logo">
                <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . '../assets/logo-sidebar.svg' ); ?>" alt="Arthaleads" width="32" height="32" style="display:block">
            </div>
            <div style="flex:1">
                <h1 class="al-title">Arthaleads</h1>
                <p class="al-sub">Capture WordPress form leads into your CRM — automatically, in real time</p>
            </div>
            <span id="al-status-pill" class="al-pill <?php echo esc_attr( $is_connected ? 'al-pill-ok' : 'al-pill-no' ); ?>">
                <?php echo esc_html( $is_connected ? '✓ Connected' : '⏳ Not Connected' ); ?>
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
<?php
}
