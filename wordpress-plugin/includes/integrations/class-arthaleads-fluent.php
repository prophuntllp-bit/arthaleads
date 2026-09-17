<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Fluent {
    // Any key that normalizes to one of these is already carried as its own
    // name/phone/email/message field — never duplicated into custom_fields.
    private static $standard_keys = [
        'name', 'full_name', 'names', 'full-name',
        'phone', 'phone_number', 'mobile', 'tel',
        'email', 'email_address',
        'message', 'your_message',
    ];

    public function handle( $insertId, $formData, $form ) {
        $map = [];
        foreach ( $formData as $key => $val ) {
            $map[ strtolower( $key ) ] = is_array( $val ) ? implode( ', ', $val ) : $val;
        }

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        // Fluent Forms also always includes its own scaffolding fields (e.g.
        // "__fluent_form_embded_post_id", "_wp_http_referer") — skip anything
        // starting with an underscore.
        $custom_fields = [];
        foreach ( $formData as $key => $val ) {
            if ( is_array( $val ) ) $val = implode( ', ', array_filter( array_map( 'strval', $val ) ) );
            $val = trim( (string) $val );
            if ( $val === '' ) continue;
            if ( strpos( (string) $key, '_' ) === 0 ) continue;
            $norm = strtolower( (string) $key );
            if ( in_array( $norm, self::$standard_keys, true ) ) continue;
            $label = ucwords( str_replace( [ '-', '_' ], ' ', (string) $key ) );
            $custom_fields[] = [ 'fieldKey' => $norm, 'label' => $label, 'value' => $val ];
        }

        ( new Arthaleads_API( 'fluent_form' ) )->send_lead( [
            'name'          => $map['name'] ?? $map['full_name'] ?? $map['names'] ?? $map['full-name'] ?? '',
            'phone'         => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? $map['tel'] ?? '',
            'email'         => $map['email'] ?? $map['email_address'] ?? '',
            'message'       => $map['message'] ?? $map['your_message'] ?? '',
            'custom_fields' => $custom_fields,
        ] );
    }
}
