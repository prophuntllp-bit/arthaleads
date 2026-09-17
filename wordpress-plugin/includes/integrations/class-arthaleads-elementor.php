<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Elementor {
    // Any id/label that normalizes to one of these is already carried as its
    // own name/phone/email/message field — never duplicated into custom_fields.
    private static $standard_keys = [
        'name', 'full_name', 'your_name', 'full-name', 'customer_name',
        'phone', 'mobile', 'phone_number', 'tel', 'contact', 'mobile_number',
        'email', 'email_address', 'your_email', 'mail',
        'message', 'your_message', 'description', 'query', 'enquiry',
    ];

    public function handle( $record, $handler ) {
        $map = [];
        $raw_fields = [];
        foreach ( $record->get( 'fields' ) as $id => $field ) {
            $val    = is_array( $field ) ? ( $field['value'] ?? '' ) : (string) $field;
            $id_key = strtolower( str_replace( [ '-', ' ', '.' ], '_', $id ) );
            $map[ $id_key ] = $val;

            // Also index by field label/title so we match regardless of field ID
            $title   = $field['title'] ?? ( $field['label'] ?? '' );
            $lbl_key = $title ? strtolower( str_replace( [ '-', ' ', '.' ], '_', $title ) ) : '';
            if ( $lbl_key ) $map[ $lbl_key ] = $val;

            $raw_fields[] = [ 'id_key' => $id_key, 'lbl_key' => $lbl_key, 'label' => $title ?: $id, 'value' => $val ];
        }

        $name    = $map['name']    ?? $map['full_name']    ?? $map['your_name']    ?? $map['full-name']     ?? $map['customer_name'] ?? '';
        $phone   = $map['phone']   ?? $map['mobile']       ?? $map['phone_number'] ?? $map['tel']           ?? $map['contact']       ?? $map['mobile_number'] ?? '';
        $email   = $map['email']   ?? $map['email_address']?? $map['your_email']   ?? $map['mail']          ?? '';
        $message = $map['message'] ?? $map['your_message'] ?? $map['description']  ?? $map['query']         ?? $map['enquiry']       ?? '';

        // Last resort: use first non-empty values in order
        if ( empty( $name ) && empty( $phone ) && empty( $email ) ) {
            $vals = array_values( array_filter( $map, function( $v ) { return is_string( $v ) && trim( $v ) !== ''; } ) );
            $name = $vals[0] ?? 'Website Lead';
        }

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        $custom_fields = [];
        foreach ( $raw_fields as $f ) {
            if ( $f['value'] === '' || $f['value'] === null ) continue;
            if ( in_array( $f['id_key'], self::$standard_keys, true ) ) continue;
            if ( $f['lbl_key'] && in_array( $f['lbl_key'], self::$standard_keys, true ) ) continue;
            $custom_fields[] = [ 'fieldKey' => $f['id_key'], 'label' => $f['label'], 'value' => (string) $f['value'] ];
        }

        // Get the Elementor form name from the form settings
        $form_settings = $record->get( 'form_settings' );
        $form_name     = ! empty( $form_settings['form_name'] ) ? $form_settings['form_name'] : '';

        ( new Arthaleads_API( 'elementor_form' ) )->send_lead( [
            'name'          => $name,
            'phone'         => $phone,
            'email'         => $email,
            'message'       => $message,
            'form_name'     => $form_name,
            'custom_fields' => $custom_fields,
        ] );
    }
}
