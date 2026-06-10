<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_WPForms {
    public function handle( $fields, $entry, $form_data ) {
        $map = [];
        foreach ( $fields as $field ) {
            $key = strtolower( str_replace( ' ', '_', $field['name'] ?? '' ) );
            $map[ $key ] = $field['value'] ?? '';
        }

        ( new Arthaleads_API( 'wpforms' ) )->send_lead( [
            'name'    => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
            'phone'   => $map['phone'] ?? $map['your_phone'] ?? $map['mobile'] ?? $map['phone_number'] ?? '',
            'email'   => $map['email'] ?? $map['your_email'] ?? '',
            'message' => $map['message'] ?? $map['your_message'] ?? '',
        ] );
    }
}
