<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Admin {

    // One-colour SVG embedded as a data URI, the form WordPress recolours to
    // match the admin colour scheme and the active/hover states. A linked
    // image is drawn as-is, which left this icon pale and out of step with
    // the other menu icons.
    private function menu_icon() {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="black" fill-rule="evenodd" d="M44.5 9 42.5 10.2 39.5 13.8 10.2 75.8 9.5 78.5 9.5 83 10.8 86.2 13.5 89.2 17.8 91.2 26 91.5 30.5 90.8 39.8 86.8 45 83 58.5 71.2 64.2 68.5 72.8 87 74.8 89.2 78.2 90.8 86.8 90.8 88.5 90 90 88 90 84.8 81.5 67.2 75.8 62.5 69.5 60.2 60.5 60 54 61.5 45.8 65.2 30.8 74.8 27.5 75.8 48.5 32.2 60 56.5 66.5 56.2 71.2 57.2 78.8 61.2 73.8 48 57.8 13 55.2 10.2 51 8.2 47 8.2Z"/></svg>';
        return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
    }

    public function add_menu() {
        add_menu_page(
            'Arthaleads',
            'Arthaleads',
            'manage_options',
            'arthaleads-integration',
            [ $this, 'render_page' ],
            $this->menu_icon(),
            30
        );
    }

    public function enqueue_assets( $hook ) {
        if ( $hook !== 'toplevel_page_arthaleads-integration' ) return;
        // No external font resources — admin UI uses system fonts defined inline.

        wp_enqueue_style(
            'arthaleads-admin',
            plugin_dir_url( __FILE__ ) . 'assets/admin.css',
            [],
            ARTHALEADS_VERSION
        );

        wp_enqueue_script(
            'arthaleads-admin',
            plugin_dir_url( __FILE__ ) . 'assets/admin.js',
            [],
            ARTHALEADS_VERSION,
            true
        );

        wp_localize_script( 'arthaleads-admin', 'ArthaleadsAdmin', [
            'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
            'nonce'        => wp_create_nonce( 'arthaleads_nonce' ),
            'action'       => Arthaleads_Constants::WP_SAVE_ACTION,
            'status'       => Arthaleads_Status::to_array(),
            'integrations' => Arthaleads_Options::get_available_integrations(),
        ] );
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
