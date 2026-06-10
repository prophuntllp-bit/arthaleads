<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_CF7 {
    public function handle( $contact_form ) {
        $submission = WPCF7_Submission::get_instance();
        if ( ! $submission ) return;
        $data = $submission->get_posted_data();

        ( new Arthaleads_API( 'cf7' ) )->send_lead( [
            'name'    => trim( $data['your-name'] ?? $data['name'] ?? $data['full-name'] ?? $data['full_name'] ?? '' ),
            'phone'   => $data['your-phone'] ?? $data['phone'] ?? $data['tel'] ?? $data['mobile'] ?? '',
            'email'   => $data['your-email'] ?? $data['email'] ?? '',
            'message' => $data['your-message'] ?? $data['message'] ?? '',
        ] );
    }
}
