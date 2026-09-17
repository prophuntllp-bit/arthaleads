<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Ninja {
    // Any key that normalizes to one of these is already carried as its own
    // name/phone/email/message field — never duplicated into custom_fields.
    private static $standard_keys = [
        'name', 'full_name', 'your_name',
        'phone', 'phone_number', 'mobile',
        'email', 'your_email',
        'message',
    ];

    public function handle( $form_data ) {
        $map = [];
        foreach ( $form_data['fields'] as $field ) {
            $key = strtolower( str_replace( ' ', '_', $field['label'] ?? $field['key'] ?? '' ) );
            $map[ $key ] = $field['value'] ?? '';
        }

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        $custom_fields = [];
        foreach ( $form_data['fields'] as $field ) {
            $val = $field['value'] ?? '';
            if ( is_array( $val ) ) $val = implode( ', ', array_filter( array_map( 'strval', $val ) ) );
            $val = trim( (string) $val );
            if ( $val === '' ) continue;
            $raw_label = $field['label'] ?? $field['key'] ?? '';
            $key = strtolower( str_replace( ' ', '_', $raw_label ) );
            if ( $key === '' || in_array( $key, self::$standard_keys, true ) ) continue;
            $custom_fields[] = [ 'fieldKey' => $key, 'label' => $raw_label ?: $key, 'value' => $val ];
        }

        ( new Arthaleads_API( 'ninja_form' ) )->send_lead( [
            'name'          => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
            'phone'         => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? '',
            'email'         => $map['email'] ?? $map['your_email'] ?? '',
            'message'       => $map['message'] ?? '',
            'custom_fields' => $custom_fields,
        ] );
    }
}
