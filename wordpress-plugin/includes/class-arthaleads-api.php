<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_API {

    private $integration_key;

    public function __construct( $integration_key ) {
        $this->integration_key = $integration_key;
    }

    private function is_enabled() {
        $val = Arthaleads_Options::get( $this->integration_key );
        return 'true' === $val;
    }

    public function send_lead( $data ) {
        if ( ! $this->is_enabled() ) return;

        $token = Arthaleads_Options::get( 'arthaleads_token' );
        if ( empty( $token ) ) return;

        // Deduplication: if the same phone was submitted in the last 60 seconds,
        // a second form hook fired for the same submission — skip silently.
        $phone = isset( $data['phone'] ) ? sanitize_text_field( $data['phone'] ) : '';
        if ( $phone ) {
            $dedup_key = 'al_dd_' . md5( $phone . $token );
            if ( get_transient( $dedup_key ) ) return;
            set_transient( $dedup_key, 1, 60 );
        }

        // Get current page URL from multiple sources
        $page_url = '';
        if ( ! empty( $_SERVER['HTTP_REFERER'] ) ) {
            $page_url = esc_url_raw( $_SERVER['HTTP_REFERER'] );
        } elseif ( ! empty( $_SERVER['REQUEST_URI'] ) ) {
            $page_url = get_site_url() . esc_url_raw( $_SERVER['REQUEST_URI'] );
        } else {
            $page_url = get_site_url();
        }

        $payload = wp_json_encode( array_merge( [
            'token'       => $token,
            'source_name' => Arthaleads_Options::get( 'site_name' ) ?: get_bloginfo( 'name' ),
            'form_plugin' => $this->integration_key,
            'page_url'    => $page_url,
        ], $data ) );

        wp_remote_post( Arthaleads_Constants::API_WEBHOOK_URL, [
            'method'   => 'POST',
            'headers'  => [ 'Content-Type' => 'application/json' ],
            'body'     => $payload,
            'timeout'  => 10,
            'blocking' => false,
        ] );
    }
}
