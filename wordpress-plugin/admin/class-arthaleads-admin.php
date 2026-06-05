<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Admin {

    public function add_menu() {
        add_menu_page(
            'Arthaleads',
            'Arthaleads',
            'manage_options',
            'arthaleads-integration',
            [ $this, 'render_page' ],
            plugin_dir_url( __FILE__ ) . 'assets/logo.png',
            30
        );
    }

    public function enqueue_assets( $hook ) {
        if ( $hook !== 'toplevel_page_arthaleads-integration' ) return;
        // No external scripts needed — admin UI uses plain vanilla JS
    }

    public function render_page() {
        require_once plugin_dir_path( __FILE__ ) . 'partials/admin-display.php';
        arthaleads_render_admin_page();
    }

    public function send_test_lead() {
        check_ajax_referer( 'arthaleads_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );

        $token = Arthaleads_Options::get( 'arthaleads_token' );
        if ( empty( $token ) ) {
            wp_send_json_error( [ 'message' => 'No token saved. Please save your settings first.' ] );
            return;
        }

        $response = wp_remote_post( Arthaleads_Constants::API_WEBHOOK_URL, [
            'headers'  => [ 'Content-Type' => 'application/json' ],
            'body'     => wp_json_encode( [
                'token'       => $token,
                'name'        => 'Test Lead',
                'phone'       => '9999999999',
                'email'       => 'test@arthaleads.com',
                'message'     => 'Test lead from Arthaleads WordPress plugin.',
                'source_name' => Arthaleads_Options::get( 'site_name' ) ?: get_bloginfo( 'name' ),
                'form_plugin' => 'manual_test',
                'page_url'    => get_site_url(),
            ] ),
            'timeout'  => 15,
            'blocking' => true,
        ] );

        if ( is_wp_error( $response ) ) {
            wp_send_json_error( [ 'message' => 'Connection failed: ' . $response->get_error_message() ] );
            return;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! empty( $body['success'] ) ) {
            wp_send_json_success( [ 'message' => 'Test lead sent!' ] );
        } else {
            wp_send_json_error( [ 'message' => 'API error: ' . ( $body['message'] ?? 'Unknown' ) ] );
        }
    }
}
