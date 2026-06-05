<?php
/**
 * Plugin Name:       Arthaleads
 * Plugin URI:        https://arthaleads.com
 * Description:       Send WordPress form leads directly into Arthaleads CRM — zero code, one token. Supports Contact Form 7, WPForms, Elementor Pro Forms, Gravity Forms, Ninja Forms, Forminator, Fluent Forms, and MetForm.
 * Version:           1.0.1
 * Author:            Arthaleads
 * Author URI:        https://arthaleads.com
 * License:           GPL-2.0+
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       arthaleads-integration
 * Domain Path:       /languages
 * Requires at least: 5.8
 * Requires PHP:      7.4
 */

if ( ! defined( 'WPINC' ) ) die;

define( 'ARTHALEADS_VERSION',   '1.0.1' );
define( 'ARTHALEADS_PLUGIN_ID', 'arthaleads-integration' );

require_once plugin_dir_path( __FILE__ ) . 'includes/class-arthaleads-constants.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-arthaleads-status.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-arthaleads-options.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-arthaleads-api.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-arthaleads-loader.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-arthaleads-core.php';

function run_arthaleads() {
    $plugin = new Arthaleads_Core();
    $plugin->run();
}
run_arthaleads();
