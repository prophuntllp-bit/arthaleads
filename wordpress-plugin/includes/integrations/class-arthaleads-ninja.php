<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Ninja {
    public function handle( $form_data ) {
        $map = [];
        foreach ( $form_data['fields'] as $field ) {
            $key = strtolower( str_replace( ' ', '_', $field['label'] ?? $field['key'] ?? '' ) );
            $map[ $key ] = $field['value'] ?? '';
        }

        ( new Arthaleads_API( 'ninja_form' ) )->send_lead( [
            'name'    => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
            'phone'   => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? '',
            'email'   => $map['email'] ?? $map['your_email'] ?? '',
            'message' => $map['message'] ?? '',
        ] );
    }
}
