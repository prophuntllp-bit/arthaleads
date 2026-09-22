<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Gravity {
    // Any key that normalizes to one of these is already carried as its own
    // name/phone/email/message field — never duplicated into custom_fields.
    private static $standard_keys = [
        'name', 'full_name', 'your_name',
        'phone', 'phone_number', 'mobile',
        'email', 'your_email',
        'message', 'your_message',
    ];

    public function handle( $entry, $form ) {
        $map = [];
        foreach ( $form['fields'] as $field ) {
            $label = strtolower( str_replace( ' ', '_', $field->label ?? '' ) );
            $map[ $label ] = sanitize_text_field( (string) ( rgar( $entry, $field->id ) ?? '' ) );
        }

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        $custom_fields = [];
        foreach ( $form['fields'] as $field ) {
            $val = sanitize_text_field( trim( (string) ( rgar( $entry, $field->id ) ?? '' ) ) );
            if ( $val === '' ) continue;
            $raw_label = $field->label ?? '';
            $key = strtolower( str_replace( ' ', '_', $raw_label ) );
            if ( $key === '' || in_array( $key, self::$standard_keys, true ) ) continue;
            $custom_fields[] = [ 'fieldKey' => $key, 'label' => $raw_label ?: $key, 'value' => $val ];
        }

        ( new Arthaleads_API( 'gravity_form' ) )->send_lead( [
            'name'          => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
            'phone'         => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? '',
            'email'         => $map['email'] ?? $map['your_email'] ?? '',
            'message'       => $map['message'] ?? $map['your_message'] ?? '',
            'custom_fields' => $custom_fields,
        ] );
    }
}
