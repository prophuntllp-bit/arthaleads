<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Status {
    const NOT_EXIST  = 0;
    const INSTALLED  = 1;
    const ACTIVATED  = 2;
    const CONNECTED  = 3;

    public static function to_array() {
        return [
            'NotExist'  => self::NOT_EXIST,
            'Installed' => self::INSTALLED,
            'Activated' => self::ACTIVATED,
            'Connected' => self::CONNECTED,
        ];
    }

    private static function is_plugin_active( $slugs ) {
        include_once ABSPATH . 'wp-admin/includes/plugin.php';
        foreach ( $slugs as $slug ) {
            if ( is_plugin_active( $slug ) ) return true;
        }
        return false;
    }

    private static function is_plugin_installed( $slugs ) {
        $installed = get_plugins();
        foreach ( $slugs as $slug ) {
            if ( array_key_exists( $slug, $installed ) ) return true;
        }
        return false;
    }

    public static function get_status( $integration ) {
        $enabled     = ! empty( $integration['enabled'] ) && $integration['enabled'] === 'true';
        $identifiers = $integration['identifiers'];

        if ( ! self::is_plugin_installed( $identifiers ) ) return self::NOT_EXIST;
        if ( ! self::is_plugin_active( $identifiers ) )    return self::INSTALLED;
        if ( ! $enabled )                                   return self::ACTIVATED;
        return self::CONNECTED;
    }
}
