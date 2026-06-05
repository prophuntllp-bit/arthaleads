<?php
/**
 * Runs when the plugin is deleted (not deactivated) from the WordPress admin.
 * Removes all options stored by Arthaleads Integration.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

delete_option( 'arthaleads_options' );
