<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Constants {

    public const API_WEBHOOK_URL  = 'https://api.arthaleads.com/webhook/website';
    public const WP_OPTION_NAME   = 'arthaleads_options';
    public const WP_SAVE_ACTION   = 'arthaleads_save_options';

    public const SUPPORTED_INTEGRATIONS = [
        [
            'key'         => 'cf7',
            'name'        => 'Contact Form 7',
            'identifiers' => [ 'contact-form-7/wp-contact-form-7.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'wpforms',
            'name'        => 'WPForms',
            'identifiers' => [ 'wpforms/wpforms.php', 'wpforms-lite/wpforms.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'elementor_form',
            'name'        => 'Elementor (Pro Forms)',
            'identifiers' => [ 'elementor-pro/elementor-pro.php', 'pro-elements/pro-elements.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'gravity_form',
            'name'        => 'Gravity Forms',
            'identifiers' => [ 'gravityforms/gravityforms.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'ninja_form',
            'name'        => 'Ninja Forms',
            'identifiers' => [ 'ninja-forms/ninja-forms.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'forminator_form',
            'name'        => 'Forminator',
            'identifiers' => [ 'forminator/forminator.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'fluent_form',
            'name'        => 'Fluent Forms',
            'identifiers' => [ 'fluentform/fluentform.php' ],
            'type'        => 'plugin',
        ],
        [
            'key'         => 'metform',
            'name'        => 'MetForm',
            'identifiers' => [ 'metform/metform.php' ],
            'type'        => 'plugin',
        ],
    ];
}
