<?php
/**
 * Plugin Name:       Arthaleads Integration
 * Plugin URI:        https://arthaleads.com
 * Description:       Automatically send WordPress contact form leads to Arthaleads CRM. Supports Contact Form 7, WPForms, Elementor, Gravity Forms, Ninja Forms, Forminator, and Fluent Forms.
 * Version:           1.0.0
 * Author:            Arthaleads
 * Author URI:        https://arthaleads.com
 * License:           GPL-2.0+
 * Text Domain:       arthaleads-integration
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'ARTHALEADS_API_URL', 'https://api.arthaleads.com/webhook/website' );
define( 'ARTHALEADS_VERSION', '1.0.0' );

// ─── Settings ────────────────────────────────────────────────────────────────

function arthaleads_get_token() {
    return get_option( 'arthaleads_token', '' );
}

function arthaleads_get_site_name() {
    return get_option( 'arthaleads_site_name', get_bloginfo( 'name' ) );
}

// ─── Admin menu ───────────────────────────────────────────────────────────────

add_action( 'admin_menu', function() {
    add_menu_page(
        'Arthaleads CRM',
        'Arthaleads CRM',
        'manage_options',
        'arthaleads-integration',
        'arthaleads_settings_page',
        'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6B00"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'),
        30
    );
} );

add_action( 'admin_init', function() {
    register_setting( 'arthaleads_settings', 'arthaleads_token', [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'arthaleads_settings', 'arthaleads_site_name', [ 'sanitize_callback' => 'sanitize_text_field' ] );
} );

function arthaleads_settings_page() {
    $token     = arthaleads_get_token();
    $site_name = arthaleads_get_site_name();
    $status    = arthaleads_connection_status();

    // Detect active form plugins
    $plugins = arthaleads_detected_plugins();
    ?>
    <div class="wrap" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px;">
        <div style="display:flex;align-items:center;gap:16px;margin:24px 0 8px;">
            <div style="width:52px;height:52px;background:#FF6B00;border-radius:14px;display:flex;align-items:center;justify-content:center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="white" fill-opacity=".2"/>
                    <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:800;color:#1a1a1a;">Send Leads to Arthaleads CRM</h1>
                <p style="margin:2px 0 0;color:#666;font-size:13px;">Get leads from your WordPress contact forms instantly into Arthaleads CRM</p>
            </div>
        </div>

        <?php if ( $token ) : ?>
        <div style="background:<?php echo $status['connected'] ? '#f0fdf4' : '#fffbeb'; ?>;border:1px solid <?php echo $status['connected'] ? '#86efac' : '#fcd34d'; ?>;border-radius:10px;padding:12px 16px;margin:16px 0;display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;"><?php echo $status['connected'] ? '✅' : '⏳'; ?></span>
            <div>
                <strong style="color:<?php echo $status['connected'] ? '#166534' : '#92400e'; ?>;font-size:13px;">
                    <?php echo $status['connected'] ? 'Connected to Arthaleads CRM' : 'Token saved — waiting for first lead'; ?>
                </strong>
                <?php if ( $status['last_sync'] ) : ?>
                <p style="margin:2px 0 0;color:#666;font-size:12px;">Last lead: <?php echo esc_html( $status['last_sync'] ); ?></p>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>

        <form method="post" action="options.php" style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;margin-top:8px;">
            <?php settings_fields( 'arthaleads_settings' ); ?>

            <div style="margin-bottom:20px;">
                <label style="display:block;font-weight:700;font-size:13px;color:#374151;margin-bottom:6px;">
                    Arthaleads Account Token <span style="color:#ef4444;">*</span>
                </label>
                <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">
                    Copy your token from <strong>Arthaleads CRM → Automations → WordPress / Website</strong>.
                    It looks like <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">AW-XXXXXXXX</code>
                </p>
                <input
                    type="text"
                    name="arthaleads_token"
                    value="<?php echo esc_attr( $token ); ?>"
                    placeholder="AW-XXXXXXXX"
                    style="width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;font-family:monospace;letter-spacing:1px;"
                />
            </div>

            <div style="margin-bottom:24px;">
                <label style="display:block;font-weight:700;font-size:13px;color:#374151;margin-bottom:6px;">
                    Website Name <span style="color:#9ca3af;font-weight:400;">(optional)</span>
                </label>
                <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">
                    Shown as the lead source label in Arthaleads CRM (e.g. "Joyville Hinjewadi Website")
                </p>
                <input
                    type="text"
                    name="arthaleads_site_name"
                    value="<?php echo esc_attr( $site_name ); ?>"
                    placeholder="<?php echo esc_attr( get_bloginfo('name') ); ?>"
                    style="width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;"
                />
            </div>

            <hr style="border:none;border-top:1px solid #f3f4f6;margin-bottom:20px;">

            <div style="margin-bottom:24px;">
                <p style="font-weight:700;font-size:13px;color:#374151;margin:0 0 12px;">Contact Forms Detected</p>
                <div style="display:grid;gap:10px;">
                    <?php foreach ( $plugins as $plugin ) : ?>
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:<?php echo $plugin['active'] ? '#f0fdf4' : '#f9fafb'; ?>;border:1px solid <?php echo $plugin['active'] ? '#86efac' : '#e5e7eb'; ?>;border-radius:10px;">
                        <span style="font-weight:600;font-size:13px;color:#374151;"><?php echo esc_html( $plugin['name'] ); ?></span>
                        <?php if ( $plugin['active'] ) : ?>
                        <span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ Connected</span>
                        <?php else : ?>
                        <span style="background:#f3f4f6;color:#9ca3af;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">Not Installed</span>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php if ( ! array_filter( array_column( $plugins, 'active' ) ) ) : ?>
                <p style="color:#f59e0b;font-size:12px;margin-top:10px;">⚠ No supported form plugin found. Install Contact Form 7, WPForms, Elementor, Gravity Forms, or Ninja Forms.</p>
                <?php endif; ?>
            </div>

            <button type="submit" style="background:#FF6B00;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;width:100%;">
                SAVE
            </button>
        </form>

        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">
            Need help? Visit <a href="https://arthaleads.com" target="_blank" style="color:#FF6B00;">arthaleads.com</a>
        </p>
    </div>
    <?php
}

function arthaleads_detected_plugins() {
    return [
        [ 'name' => 'Contact Form 7',  'active' => defined('WPCF7_VERSION') ],
        [ 'name' => 'WPForms',         'active' => defined('WPFORMS_VERSION') ],
        [ 'name' => 'Elementor',       'active' => defined('ELEMENTOR_VERSION') ],
        [ 'name' => 'Gravity Forms',   'active' => class_exists('GFForms') ],
        [ 'name' => 'Ninja Forms',     'active' => class_exists('Ninja_Forms') ],
        [ 'name' => 'Forminator',      'active' => class_exists('Forminator') ],
        [ 'name' => 'Fluent Forms',    'active' => defined('FLUENTFORM') ],
    ];
}

function arthaleads_connection_status() {
    return [
        'connected' => (bool) get_option('arthaleads_last_sync'),
        'last_sync' => get_option('arthaleads_last_sync', ''),
    ];
}

// ─── Send lead to Arthaleads CRM ─────────────────────────────────────────────

function arthaleads_send_lead( $data ) {
    $token = arthaleads_get_token();
    if ( empty( $token ) ) return;

    $payload = wp_json_encode( array_merge( [
        'token'       => $token,
        'source_name' => arthaleads_get_site_name(),
        'page_url'    => isset( $_SERVER['HTTP_REFERER'] ) ? sanitize_url( $_SERVER['HTTP_REFERER'] ) : get_site_url(),
    ], $data ) );

    $response = wp_remote_post( ARTHALEADS_API_URL, [
        'method'  => 'POST',
        'headers' => [ 'Content-Type' => 'application/json' ],
        'body'    => $payload,
        'timeout' => 10,
    ] );

    if ( ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) === 200 ) {
        update_option( 'arthaleads_last_sync', date('d M Y, g:i A') );
    }
}

// ─── Contact Form 7 ──────────────────────────────────────────────────────────

add_action( 'wpcf7_mail_sent', function( $contact_form ) {
    $submission = WPCF7_Submission::get_instance();
    if ( ! $submission ) return;
    $data = $submission->get_posted_data();

    arthaleads_send_lead( [
        'name'        => trim( ( $data['your-name'] ?? $data['name'] ?? $data['full-name'] ?? '' ) ),
        'phone'       => $data['your-phone'] ?? $data['phone'] ?? $data['tel'] ?? '',
        'email'       => $data['your-email'] ?? $data['email'] ?? '',
        'message'     => $data['your-message'] ?? $data['message'] ?? '',
        'form_plugin' => 'contact-form-7',
    ] );
} );

// ─── WPForms ─────────────────────────────────────────────────────────────────

add_action( 'wpforms_process_complete', function( $fields, $entry, $form_data ) {
    $map = [];
    foreach ( $fields as $field ) {
        $name = strtolower( str_replace( ' ', '_', $field['name'] ?? '' ) );
        $map[ $name ] = $field['value'] ?? '';
    }

    arthaleads_send_lead( [
        'name'        => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
        'phone'       => $map['phone'] ?? $map['your_phone'] ?? $map['mobile'] ?? '',
        'email'       => $map['email'] ?? $map['your_email'] ?? '',
        'message'     => $map['message'] ?? $map['your_message'] ?? '',
        'form_plugin' => 'wpforms',
    ] );
}, 10, 3 );

// ─── Elementor Forms ─────────────────────────────────────────────────────────

add_action( 'elementor_pro/forms/new_record', function( $record, $handler ) {
    $raw = $record->get( 'fields' );
    $map = [];
    foreach ( $raw as $id => $field ) {
        $map[ strtolower( $id ) ] = $field['value'] ?? '';
    }

    arthaleads_send_lead( [
        'name'        => $map['name'] ?? $map['full_name'] ?? '',
        'phone'       => $map['phone'] ?? $map['tel'] ?? '',
        'email'       => $map['email'] ?? '',
        'message'     => $map['message'] ?? '',
        'form_plugin' => 'elementor',
    ] );
}, 10, 2 );

// ─── Gravity Forms ────────────────────────────────────────────────────────────

add_action( 'gform_after_submission', function( $entry, $form ) {
    $map = [];
    foreach ( $form['fields'] as $field ) {
        $label = strtolower( str_replace( ' ', '_', $field->label ?? '' ) );
        $map[ $label ] = rgar( $entry, $field->id ) ?? '';
    }

    arthaleads_send_lead( [
        'name'        => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
        'phone'       => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? '',
        'email'       => $map['email'] ?? $map['your_email'] ?? '',
        'message'     => $map['message'] ?? $map['your_message'] ?? '',
        'form_plugin' => 'gravity-forms',
    ] );
}, 10, 2 );

// ─── Ninja Forms ─────────────────────────────────────────────────────────────

add_action( 'ninja_forms_after_submission', function( $form_data ) {
    $map = [];
    foreach ( $form_data['fields'] as $field ) {
        $key = strtolower( str_replace( ' ', '_', $field['label'] ?? $field['key'] ?? '' ) );
        $map[ $key ] = $field['value'] ?? '';
    }

    arthaleads_send_lead( [
        'name'        => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
        'phone'       => $map['phone'] ?? $map['phone_number'] ?? '',
        'email'       => $map['email'] ?? $map['your_email'] ?? '',
        'message'     => $map['message'] ?? '',
        'form_plugin' => 'ninja-forms',
    ] );
} );

// ─── Forminator ──────────────────────────────────────────────────────────────

add_action( 'forminator_form_after_save_entry', function( $module_id, $response ) {
    if ( empty( $response['entry'] ) ) return;
    $data = (array) $response['entry']->meta_data;
    $get = function( $keys ) use ( $data ) {
        foreach ( (array) $keys as $k ) {
            if ( ! empty( $data[ $k ]['value'] ) ) return $data[ $k ]['value'];
        }
        return '';
    };

    arthaleads_send_lead( [
        'name'        => $get( ['name', 'full-name', 'your-name'] ),
        'phone'       => $get( ['phone', 'tel', 'mobile', 'phone-number'] ),
        'email'       => $get( ['email', 'your-email'] ),
        'message'     => $get( ['message', 'your-message'] ),
        'form_plugin' => 'forminator',
    ] );
}, 10, 2 );

// ─── Fluent Forms ────────────────────────────────────────────────────────────

add_action( 'fluentform/submission_inserted', function( $insertId, $formData, $form ) {
    $map = [];
    foreach ( $formData as $key => $val ) {
        $map[ strtolower( $key ) ] = is_array( $val ) ? implode( ', ', $val ) : $val;
    }

    arthaleads_send_lead( [
        'name'        => $map['name'] ?? $map['full_name'] ?? $map['names'] ?? '',
        'phone'       => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? '',
        'email'       => $map['email'] ?? '',
        'message'     => $map['message'] ?? '',
        'form_plugin' => 'fluent-forms',
    ] );
}, 10, 3 );

