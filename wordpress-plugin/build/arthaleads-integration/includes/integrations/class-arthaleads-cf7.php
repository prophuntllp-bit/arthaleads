<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_CF7 {

    // Canonical (normalized) keys for each field type
    private static $name_norm  = [ 'name', 'full_name', 'fullname', 'your_name', 'first_name',
                                    'fname', 'contact_name', 'client_name', 'customer_name',
                                    'full_name_', 'applicant_name' ];
    private static $phone_norm = [ 'phone', 'your_phone', 'tel', 'mobile', 'phone_number',
                                    'contact_number', 'mobile_number', 'whatsapp', 'contact',
                                    'cell', 'cellphone', 'number', 'mob' ];
    private static $email_norm = [ 'email', 'your_email', 'email_address', 'mail',
                                    'contact_email', 'emailaddress' ];
    private static $msg_norm   = [ 'message', 'your_message', 'enquiry', 'query',
                                    'description', 'comments', 'comment', 'note', 'notes',
                                    'requirements', 'requirement', 'details' ];

    // CF7-specific internal field prefixes to strip
    private static $skip_prefix = [ '_wpcf7', 'g-recaptcha', '_captcha', 'recaptcha' ];

    public function handle( $contact_form ) {
        $submission = WPCF7_Submission::get_instance();
        if ( ! $submission ) return;

        $raw = $submission->get_posted_data();

        // Build a map:  normalized_key => [ original_key, value ]
        $norm_map = [];
        foreach ( $raw as $orig_key => $value ) {
            // Skip CF7 internal fields
            $skip = false;
            foreach ( self::$skip_prefix as $pfx ) {
                if ( strpos( $orig_key, $pfx ) === 0 ) { $skip = true; break; }
            }
            if ( $skip ) continue;

            $val = self::scalar( $value );
            if ( $val === '' ) continue;

            $norm = self::normalize( $orig_key );
            $norm_map[ $norm ] = [ 'orig' => $orig_key, 'val' => $val ];
        }

        $name    = self::find( $norm_map, self::$name_norm );
        $phone   = self::find( $norm_map, self::$phone_norm );
        $email   = self::find( $norm_map, self::$email_norm );
        $message = self::find( $norm_map, self::$msg_norm );

        // Mark matched keys
        $matched_norms = array_merge( self::$name_norm, self::$phone_norm,
                                       self::$email_norm, self::$msg_norm );

        $remaining = [];
        foreach ( $norm_map as $norm => $item ) {
            if ( in_array( $norm, $matched_norms, true ) ) continue;
            $remaining[ $item['orig'] ] = $item['val'];
        }

        // Value-pattern fallback for anything still unmatched
        foreach ( $remaining as $key => $val ) {
            if ( empty( $email ) && strpos( $val, '@' ) !== false ) {
                $email = $val; unset( $remaining[ $key ] );
            } elseif ( empty( $phone ) && preg_match( '/^\+?[\d\s\-\(\)]{7,15}$/', trim( $val ) ) ) {
                $phone = $val; unset( $remaining[ $key ] );
            } elseif ( empty( $name ) && strlen( $val ) < 80 && ! is_numeric( trim( $val ) ) ) {
                $name = $val; unset( $remaining[ $key ] );
            }
        }

        // All remaining custom fields (plot size, budget, property type, etc.) → message
        $message = self::append_extras( $message, $remaining );

        ( new Arthaleads_API( 'cf7' ) )->send_lead( [
            'name'      => $name,
            'phone'     => $phone,
            'email'     => $email,
            'message'   => $message,
            'form_name' => $contact_form->title(),
        ] );
    }

    // ── Shared helpers (used by all integrations) ──────────────────────────────

    /**
     * Normalize a field key: lowercase, collapse special chars to underscore,
     * strip CF7 auto-numeric suffixes like -1, -2 from the END only.
     * e.g. "Full Name" → "full_name",  "email-address" → "email_address",
     *      "select-1"  → "select",     "text-648"      → "text"
     */
    public static function normalize( $key ) {
        $k = strtolower( trim( (string) $key ) );
        $k = preg_replace( '/[\s\-\.\/]+/', '_', $k );   // space/hyphen/dot/slash → _
        $k = preg_replace( '/_+/', '_', $k );             // collapse multiple __
        $k = preg_replace( '/_\d+$/', '', $k );           // strip trailing _1, _2 …
        $k = trim( $k, '_' );
        return $k;
    }

    /** Find first matching value from a list of normalized keys. */
    public static function find( $norm_map, $keys ) {
        foreach ( $keys as $k ) {
            if ( isset( $norm_map[ $k ] ) ) return $norm_map[ $k ]['val'];
        }
        return '';
    }

    /** Coerce any value (string, array) to a trimmed string. */
    public static function scalar( $value ) {
        if ( is_array( $value ) ) {
            $value = implode( ', ', array_filter( array_map( 'strval', $value ) ) );
        }
        return trim( (string) $value );
    }

    /**
     * Build a normalized map from a flat key→value array.
     * Returns [ normalized_key => [ orig => ..., val => ... ] ]
     */
    public static function build_norm_map( $flat ) {
        $map = [];
        foreach ( $flat as $k => $v ) {
            $val = self::scalar( $v );
            if ( $val === '' ) continue;
            $norm = self::normalize( $k );
            // Keep first occurrence (original key wins)
            if ( ! isset( $map[ $norm ] ) ) {
                $map[ $norm ] = [ 'orig' => $k, 'val' => $val ];
            }
        }
        return $map;
    }

    /**
     * Extract name/phone/email/message from a norm_map.
     * Returns array: [ name, phone, email, message, remaining ]
     * where remaining is orig_key → val for all unmatched fields.
     */
    public static function extract_fields( $norm_map ) {
        $name    = self::find( $norm_map, self::$name_norm );
        $phone   = self::find( $norm_map, self::$phone_norm );
        $email   = self::find( $norm_map, self::$email_norm );
        $message = self::find( $norm_map, self::$msg_norm );

        $all_matched = array_merge( self::$name_norm, self::$phone_norm,
                                     self::$email_norm, self::$msg_norm );

        $remaining = [];
        foreach ( $norm_map as $norm => $item ) {
            if ( in_array( $norm, $all_matched, true ) ) continue;
            $remaining[ $item['orig'] ] = $item['val'];
        }

        // Value-pattern fallback
        foreach ( $remaining as $key => $val ) {
            if ( empty( $email ) && strpos( $val, '@' ) !== false ) {
                $email = $val; unset( $remaining[ $key ] );
            } elseif ( empty( $phone ) && preg_match( '/^\+?[\d\s\-\(\)]{7,15}$/', trim( $val ) ) ) {
                $phone = $val; unset( $remaining[ $key ] );
            } elseif ( empty( $name ) && strlen( $val ) < 80 && ! is_numeric( trim( $val ) ) ) {
                $name = $val; unset( $remaining[ $key ] );
            }
        }

        // De-duplicate: remove any remaining field whose value is already captured
        // in name/phone/email (prevents raw Elementor field IDs like "9b10818"
        // from re-appearing in the Requirements column when the label was matched).
        $captured = array_filter( [ $name, $phone, $email ] );
        foreach ( $remaining as $key => $val ) {
            if ( in_array( $val, $captured, true ) ) {
                unset( $remaining[ $key ] );
            }
        }

        return [ $name, $phone, $email, $message, $remaining ];
    }

    /**
     * Append remaining custom fields to message as human-readable lines.
     * "what_plot_size_are_you_looking_for" → "What Plot Size Are You Looking For"
     */
    public static function append_extras( $message, $remaining ) {
        $extras = [];
        foreach ( $remaining as $key => $value ) {
            $val = self::scalar( $value );
            if ( $val === '' ) continue;
            // Use the original key, make it readable
            $label    = ucwords( str_replace( [ '-', '_', '.', '/' ], ' ', $key ) );
            $extras[] = $label . ': ' . $val;
        }
        if ( empty( $extras ) ) return $message;
        $block = implode( "\n", $extras );
        return $message !== '' ? $message . "\n\n" . $block : $block;
    }

    /** BC shim: other integrations still call pick() */
    public static function pick( $fields, $keys ) {
        $norm_map = self::build_norm_map( $fields );
        $norm_keys = array_map( [ __CLASS__, 'normalize' ], $keys );
        return self::find( $norm_map, $norm_keys );
    }
}
