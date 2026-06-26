<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Options {

    public static function get_values() {
        $opts = get_option( Arthaleads_Constants::WP_OPTION_NAME );
        return $opts ? $opts : [];
    }

    public static function get( $key ) {
        $opts = self::get_values();
        return isset( $opts[ $key ] ) ? $opts[ $key ] : null;
    }

    public static function set_values( $fields ) {
        $allowed   = array_column( Arthaleads_Constants::SUPPORTED_INTEGRATIONS, 'key' );
        $allowed[] = 'arthaleads_token';
        $allowed[] = 'site_name';
        $filtered  = array_intersect_key( $fields, array_flip( $allowed ) );
        update_option( Arthaleads_Constants::WP_OPTION_NAME, $filtered );
    }

    public static function get_available_integrations() {
        $result = array_map( function( $integration ) {
            $key                   = $integration['key'];
            $integration['enabled'] = Arthaleads_Options::get( $key );
            $integration['status']  = Arthaleads_Status::get_status( $integration );
            // Disable if plugin not active
            if ( $integration['status'] < Arthaleads_Status::ACTIVATED ) {
                $integration['enabled'] = false;
            }
            return $integration;
        }, Arthaleads_Constants::SUPPORTED_INTEGRATIONS );

        // Sort: connected first, then activated, then installed, then not installed
        usort( $result, function( $a, $b ) {
            return $b['status'] - $a['status'];
        } );

        return $result;
    }

    public static function save_handler() {
        check_ajax_referer( 'arthaleads_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );

        $fields = isset( $_POST['fields'] )
            ? array_map( 'sanitize_text_field', wp_unslash( (array) $_POST['fields'] ) )
            : [];

        $existing_token = self::get( 'arthaleads_token' );

        // First time saving: auto-enable all installed+active integrations
        if ( empty( $existing_token ) && ! empty( $fields['arthaleads_token'] ) ) {
            foreach ( Arthaleads_Constants::SUPPORTED_INTEGRATIONS as $integration ) {
                $key                  = $integration['key'];
                $integration['enabled'] = null;
                $status               = Arthaleads_Status::get_status( $integration );
                if ( $status >= Arthaleads_Status::ACTIVATED ) {
                    $fields[ $key ] = 'true';
                }
            }
        }

        self::set_values( $fields );

        // Register / sync with Arthaleads backend so CRM shows connected site & forms
        $token = isset( $fields['arthaleads_token'] ) ? $fields['arthaleads_token'] : '';
        if ( $token ) {
            $enabled_forms = [];
            foreach ( Arthaleads_Constants::SUPPORTED_INTEGRATIONS as $intg ) {
                if ( isset( $fields[ $intg['key'] ] ) && $fields[ $intg['key'] ] === 'true' ) {
                    $enabled_forms[] = $intg['name'];
                }
            }
            wp_remote_post( 'https://api.arthaleads.com/webhook/website/register', [
                'headers'     => [ 'Content-Type' => 'application/json' ],
                'body'        => wp_json_encode( [
                    'token'     => $token,
                    'site_name' => isset( $fields['site_name'] ) ? $fields['site_name'] : get_bloginfo( 'name' ),
                    'site_url'  => get_site_url(),
                    'forms'     => $enabled_forms,
                ] ),
                'timeout'     => 10,
                'blocking'    => false,
            ] );
        }

        wp_send_json_success( [
            'integrations' => self::get_available_integrations(),
            'token'        => self::get( 'arthaleads_token' ),
            'site_name'    => self::get( 'site_name' ),
        ] );
    }
}
