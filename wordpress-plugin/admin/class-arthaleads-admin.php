<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Admin {

    public function add_menu() {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="black" fill-rule="evenodd" d="M50 3C36 3 26 14 19 36L5 90H22L33 58C37 65 45 70 52 70C59 70 64 66 67 58L78 90H95L81 36C74 14 64 3 50 3ZM50 18C56 18 62 28 65 43H35C38 28 44 18 50 18Z"/></svg>';
        add_menu_page(
            'Arthaleads',
            'Arthaleads',
            'manage_options',
            'arthaleads-integration',
            [ $this, 'render_page' ],
            'data:image/svg+xml;base64,' . base64_encode( $svg ),
            30
        );
    }

    public function enqueue_assets( $hook ) {
        if ( $hook !== 'toplevel_page_arthaleads-integration' ) return;
        wp_enqueue_style(
            'arthaleads-inter-font',
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
            [],
            ARTHALEADS_VERSION
        );
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
