<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_WPForms {
    // Any key that normalizes to one of these is already carried as its own
    // name/phone/email/message field — never duplicated into custom_fields.
    private static $standard_keys = [
        'name', 'full_name', 'your_name',
        'phone', 'your_phone', 'mobile', 'phone_number',
        'email', 'your_email',
        'message', 'your_message',
    ];

    public function handle( $fields, $entry, $form_data ) {
        $map = [];
        foreach ( $fields as $field ) {
            $key = strtolower( str_replace( ' ', '_', $field['name'] ?? '' ) );
            $map[ $key ] = $field['value'] ?? '';
        }

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        $custom_fields = [];
        foreach ( $fields as $field ) {
            $val = trim( (string) ( $field['value'] ?? '' ) );
            if ( $val === '' ) continue;
            $name = $field['name'] ?? '';
            $key  = strtolower( str_replace( ' ', '_', $name ) );
            if ( $key === '' || in_array( $key, self::$standard_keys, true ) ) continue;
            $custom_fields[] = [ 'fieldKey' => $key, 'label' => $name ?: $key, 'value' => $val ];
        }

        ( new Arthaleads_API( 'wpforms' ) )->send_lead( [
            'name'          => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
            'phone'         => $map['phone'] ?? $map['your_phone'] ?? $map['mobile'] ?? $map['phone_number'] ?? '',
            'email'         => $map['email'] ?? $map['your_email'] ?? '',
            'message'       => $map['message'] ?? $map['your_message'] ?? '',
            'custom_fields' => $custom_fields,
        ] );
    }
}
