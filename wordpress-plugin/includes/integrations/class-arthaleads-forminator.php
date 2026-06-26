<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Forminator {
    public function handle( $module_id, $response ) {
        if ( empty( $response['entry'] ) ) return;
        $data = (array) $response['entry']->meta_data;

        $get = function( $keys ) use ( $data ) {
            foreach ( (array) $keys as $k ) {
                if ( ! empty( $data[ $k ]['value'] ) ) return $data[ $k ]['value'];
            }
            return '';
        };

        ( new Arthaleads_API( 'forminator_form' ) )->send_lead( [
            'name'    => $get( [ 'name', 'full-name', 'full_name', 'your-name' ] ),
            'phone'   => $get( [ 'phone', 'tel', 'mobile', 'phone-number', 'phone_number' ] ),
            'email'   => $get( [ 'email', 'your-email', 'email-1' ] ),
            'message' => $get( [ 'message', 'your-message', 'textarea-1' ] ),
        ] );
    }
}
