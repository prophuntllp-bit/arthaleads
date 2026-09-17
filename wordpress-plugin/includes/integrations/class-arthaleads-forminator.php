<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Forminator {
    // Any key that normalizes to one of these is already carried as its own
    // name/phone/email/message field — never duplicated into custom_fields.
    // Forminator's own field ids ("name-1", "email-1"...) are also excluded
    // by their base name below (the "-1" suffix is stripped before matching).
    private static $standard_keys = [
        'name', 'full_name', 'your_name',
        'phone', 'tel', 'mobile', 'phone_number',
        'email', 'your_email',
        'message', 'your_message', 'textarea',
    ];

    public function handle( $module_id, $response ) {
        if ( empty( $response['entry'] ) ) return;
        $data = (array) $response['entry']->meta_data;

        $get = function( $keys ) use ( $data ) {
            foreach ( (array) $keys as $k ) {
                if ( ! empty( $data[ $k ]['value'] ) ) return $data[ $k ]['value'];
            }
            return '';
        };

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        $custom_fields = [];
        foreach ( $data as $field_id => $meta ) {
            $val = is_array( $meta ) ? ( $meta['value'] ?? '' ) : $meta;
            if ( is_array( $val ) ) $val = implode( ', ', array_filter( array_map( 'strval', $val ) ) );
            $val = trim( (string) $val );
            if ( $val === '' ) continue;
            // Strip Forminator's numeric field-instance suffix: "name-1" → "name"
            $base = strtolower( preg_replace( '/-\d+$/', '', (string) $field_id ) );
            if ( in_array( $base, self::$standard_keys, true ) ) continue;
            $label = is_array( $meta ) && ! empty( $meta['label'] ) ? $meta['label'] : ucwords( str_replace( [ '-', '_' ], ' ', $base ) );
            $custom_fields[] = [ 'fieldKey' => $base, 'label' => $label, 'value' => $val ];
        }

        ( new Arthaleads_API( 'forminator_form' ) )->send_lead( [
            'name'          => $get( [ 'name', 'full-name', 'full_name', 'your-name' ] ),
            'phone'         => $get( [ 'phone', 'tel', 'mobile', 'phone-number', 'phone_number' ] ),
            'email'         => $get( [ 'email', 'your-email', 'email-1' ] ),
            'message'       => $get( [ 'message', 'your-message', 'textarea-1' ] ),
            'custom_fields' => $custom_fields,
        ] );
    }
}
