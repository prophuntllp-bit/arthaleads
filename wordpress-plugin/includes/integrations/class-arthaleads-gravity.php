<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Gravity {
    public function handle( $entry, $form ) {
        $map = [];
        foreach ( $form['fields'] as $field ) {
            $label = strtolower( str_replace( ' ', '_', $field->label ?? '' ) );
            $map[ $label ] = rgar( $entry, $field->id ) ?? '';
        }

        ( new Arthaleads_API( 'gravity_form' ) )->send_lead( [
            'name'    => $map['name'] ?? $map['full_name'] ?? $map['your_name'] ?? '',
            'phone'   => $map['phone'] ?? $map['phone_number'] ?? $map['mobile'] ?? '',
            'email'   => $map['email'] ?? $map['your_email'] ?? '',
            'message' => $map['message'] ?? $map['your_message'] ?? '',
        ] );
    }
}
