<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Fluent {
    public function handle( $insertId, $formData, $form ) {
        $map = [];
        foreach ( $formData as $key => $val ) {
            $map[ strtolower( $key ) ] = is_array( $val ) ? implode( ', ', $val ) : $val;
        }

        ( new Arthaleads_API( 'fluent_form' ) )->send_lead( [
            'name'    => $map['name'] ?? $map['full_name'] ?? $map['names'] ?? $map['full-name'] ?? '',
            'phone'   => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? $map['tel'] ?? '',
            'email'   => $map['email'] ?? $map['email_address'] ?? '',
            'message' => $map['message'] ?? $map['your_message'] ?? '',
        ] );
    }
}
