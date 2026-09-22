<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_CF7 {
    // Any key that normalizes to one of these is already carried as its own
    // name/phone/email/message field — never duplicated into custom_fields.
    private static $standard_keys = [
        'your_name', 'name', 'full_name',
        'your_phone', 'phone', 'tel', 'mobile',
        'your_email', 'email',
        'your_message', 'message',
    ];

    public function handle( $contact_form ) {
        $submission = WPCF7_Submission::get_instance();
        if ( ! $submission ) return;
        $data = $submission->get_posted_data();

        // Everything that isn't a recognized name/phone/email/message field —
        // e.g. budget, BHK, purpose, timeline — forwarded so the CRM can map
        // it onto the lead's real fields instead of it being dropped silently.
        // CF7 also always includes its own honeypot/consent scaffolding
        // fields (e.g. "_wpcf7", "g-recaptcha-response") — skip anything
        // starting with an underscore or containing "recaptcha".
        $custom_fields = [];
        foreach ( $data as $key => $val ) {
            if ( is_array( $val ) ) $val = implode( ', ', array_filter( array_map( 'strval', $val ) ) );
            $val = sanitize_text_field( trim( (string) $val ) );
            if ( $val === '' ) continue;
            if ( strpos( $key, '_' ) === 0 || stripos( $key, 'recaptcha' ) !== false ) continue;
            $norm = strtolower( str_replace( '-', '_', $key ) );
            if ( in_array( $norm, self::$standard_keys, true ) ) continue;
            $label = ucwords( str_replace( [ '-', '_' ], ' ', $key ) );
            $custom_fields[] = [ 'fieldKey' => $norm, 'label' => $label, 'value' => $val ];
        }

        ( new Arthaleads_API( 'cf7' ) )->send_lead( [
            'name'          => sanitize_text_field( trim( $data['your-name'] ?? $data['name'] ?? $data['full-name'] ?? $data['full_name'] ?? '' ) ),
            'phone'         => sanitize_text_field( $data['your-phone'] ?? $data['phone'] ?? $data['tel'] ?? $data['mobile'] ?? '' ),
            'email'         => sanitize_text_field( $data['your-email'] ?? $data['email'] ?? '' ),
            'message'       => sanitize_text_field( $data['your-message'] ?? $data['message'] ?? '' ),
            'custom_fields' => $custom_fields,
        ] );
    }
}
