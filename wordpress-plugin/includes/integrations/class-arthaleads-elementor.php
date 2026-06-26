<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Elementor {
    public function handle( $record, $handler ) {
        $map = [];
        foreach ( $record->get( 'fields' ) as $id => $field ) {
            $val     = is_array( $field ) ? ( $field['value'] ?? '' ) : (string) $field;
            $id_key  = strtolower( str_replace( [ '-', ' ', '.' ], '_', $id ) );
            $map[ $id_key ] = $val;

            // Also index by field label/title so we match regardless of field ID
            $title = $field['title'] ?? ( $field['label'] ?? '' );
            if ( $title ) {
                $lbl_key = strtolower( str_replace( [ '-', ' ', '.' ], '_', $title ) );
                $map[ $lbl_key ] = $val;
            }
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

        // Get the Elementor form name from the form settings
        $form_settings = $record->get( 'form_settings' );
        $form_name     = ! empty( $form_settings['form_name'] ) ? $form_settings['form_name'] : '';

        ( new Arthaleads_API( 'elementor_form' ) )->send_lead( [
            'name'      => $name,
            'phone'     => $phone,
            'email'     => $email,
            'message'   => $message,
            'form_name' => $form_name,
        ] );
    }
}
