<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Core {
    private $loader;

    public function __construct() {
        $this->loader = new Arthaleads_Loader();
        $this->load_integrations();
        $this->define_admin_hooks();
    }

    private function load_integrations() {
        $path = plugin_dir_path( __FILE__ ) . 'integrations/';
        require_once $path . 'class-arthaleads-cf7.php';
        require_once $path . 'class-arthaleads-wpforms.php';
        require_once $path . 'class-arthaleads-elementor.php';
        require_once $path . 'class-arthaleads-gravity.php';
        require_once $path . 'class-arthaleads-ninja.php';
        require_once $path . 'class-arthaleads-forminator.php';
        require_once $path . 'class-arthaleads-fluent.php';
        require_once $path . 'class-arthaleads-metform.php';

        // Register each integration hook
        $cf7        = new Arthaleads_CF7();
        $wpforms    = new Arthaleads_WPForms();
        $elementor  = new Arthaleads_Elementor();
        $gravity    = new Arthaleads_Gravity();
        $ninja      = new Arthaleads_Ninja();
        $forminator = new Arthaleads_Forminator();
        $fluent     = new Arthaleads_Fluent();
        $metform    = new Arthaleads_Metform();

        $this->loader->add_action( 'wpcf7_mail_sent',                    $cf7,        'handle', 10, 1 );
        $this->loader->add_action( 'wpforms_process_complete',            $wpforms,    'handle', 10, 3 );
        $this->loader->add_action( 'elementor_pro/forms/new_record',      $elementor,  'handle', 10, 2 );
        $this->loader->add_action( 'gform_after_submission',              $gravity,    'handle', 10, 2 );
        $this->loader->add_action( 'ninja_forms_after_submission',        $ninja,      'handle', 10, 1 );
        $this->loader->add_action( 'forminator_form_after_save_entry',    $forminator, 'handle', 10, 2 );
        $this->loader->add_action( 'fluentform/submission_inserted',      $fluent,     'handle', 10, 3 );
        $this->loader->add_action( 'metform/after_store_form_data',       $metform,    'handle',                10, 4 );
        $this->loader->add_action( 'metform/process/after_response',      $metform,    'handle_after_response', 10, 2 );
        $this->loader->add_action( 'save_post_metform-entry',             $metform,    'handle_post_save',      20, 3 );
        $this->loader->add_action( 'wp_insert_post',                      $metform,    'handle_post_save',      20, 3 );
    }

    private function define_admin_hooks() {
        require_once plugin_dir_path( __FILE__ ) . '../admin/class-arthaleads-admin.php';
        $admin = new Arthaleads_Admin();
        $this->loader->add_action( 'admin_menu',                    $admin, 'add_menu' );
        $this->loader->add_action( 'admin_enqueue_scripts',        $admin, 'enqueue_assets' );
        $this->loader->add_action( 'wp_ajax_' . Arthaleads_Constants::WP_SAVE_ACTION, new Arthaleads_Options(), 'save_handler' );
        $this->loader->add_action( 'wp_ajax_arthaleads_test_lead', $admin, 'send_test_lead' );
    }

    public function run() {
        $this->loader->run();
    }
}
