<?php
if ( ! defined( 'WPINC' ) ) die;

class Arthaleads_Metform {

    private function dedup( $key ) {
        $k = 'al_mf_' . md5( $key );
        if ( get_transient( $k ) ) return false;
        set_transient( $k, 1, 60 );
        return true;
    }

    // Hook 1: metform/after_store_form_data (4 args — older MetForm)
    public function handle( $form_id, $form_data, $form_settings, $attributes ) {
        if ( ! is_array( $form_data ) || empty( $form_data ) ) return;
        if ( ! $this->dedup( 'h1_' . $form_id . '_' . microtime( true ) ) ) return;
        $form_name = $form_id ? get_the_title( (int) $form_id ) : '';
        $this->process( $form_data, $form_name );
    }

    // Hook 2: metform/process/after_response (2 args — newer MetForm)
    public function handle_after_response( $form_id, $form_data ) {
        $data = is_array( $form_data ) ? $form_data : [];
        if ( empty( $data ) ) return;
        if ( ! $this->dedup( 'h2_' . $form_id . '_' . microtime( true ) ) ) return;
        $form_name = $form_id ? get_the_title( (int) $form_id ) : '';
        $this->process( $data, $form_name );
    }

    // Hook 3: fires when MetForm saves an entry post
    // Uses shutdown so meta is definitely written by the time we read it
    public function handle_post_save( $post_id, $post, $update ) {
        if ( $update ) return;
        $type = is_object( $post ) ? $post->post_type : get_post_type( $post_id );
        if ( strpos( (string) $type, 'metform' ) === false ) return;
        if ( ! $this->dedup( 'h3_' . $post_id ) ) return;

        // Read meta at shutdown — MetForm writes it after the post is created
        add_action( 'shutdown', function() use ( $post_id ) {
            $raw = get_post_meta( $post_id, 'metform_entries__form_data', true );
            if ( empty( $raw ) ) $raw = get_post_meta( $post_id, 'metform_form_value', true );
            if ( empty( $raw ) ) $raw = get_post_meta( $post_id, 'mf_form_value', true );

            if ( empty( $raw ) ) return;

            $form_data = is_array( $raw ) ? $raw : json_decode( $raw, true );
            if ( ! is_array( $form_data ) ) return;

            // Get the form title from the linked MetForm form post
            $form_id   = get_post_meta( $post_id, 'metform_entries__form_id', true );
            $form_name = $form_id ? get_the_title( (int) $form_id ) : '';

            $this->process( $form_data, $form_name );
        } );
    }

    private function process( $form_data, $form_name = '' ) {
        $map = [];
        foreach ( $form_data as $key => $value ) {
            $clean = strtolower( trim( preg_replace( '/[\-\s\.\[\]]+/', '_', (string) $key ) ) );

            // MetForm may store each field as ['value'=>'...','label'=>'...','type'=>'...']
            if ( is_array( $value ) && array_key_exists( 'value', $value ) ) {
                $val = sanitize_text_field( (string) $value['value'] );
                // Also index by label
                if ( ! empty( $value['label'] ) ) {
                    $lbl = strtolower( trim( preg_replace( '/[\-\s\.\[\]]+/', '_', $value['label'] ) ) );
                    if ( $lbl ) $map[ $lbl ] = $val;
                }
            } elseif ( is_array( $value ) ) {
                // Flatten arrays (e.g. checkboxes)
                $val = implode( ', ', array_filter( array_map( 'strval', $value ) ) );
            } else {
                $val = sanitize_text_field( (string) $value );
            }

            $map[ $clean ] = $val;

            // Strip common prefixes: mf_full_name → full_name
            $stripped = preg_replace( '/^(mf__|mf_|field_)/', '', $clean );
            if ( $stripped !== $clean && $val !== '' ) $map[ $stripped ] = $val;
        }

        // --- Name ---
        $name = $map['name']           ?? $map['full_name']     ?? $map['fullname']      ??
                $map['your_name']      ?? $map['contact_name']  ?? $map['first_name']    ??
                $map['mf_full_name']   ?? $map['mf_name']       ?? $map['mf_text']       ?? '';

        // --- Phone ---
        $phone = $map['phone']         ?? $map['mobile']        ?? $map['phone_number']  ??
                 $map['tel']           ?? $map['mf_phone']      ?? $map['mf_mobile']     ??
                 $map['contact']       ?? $map['number']        ?? $map['mobile_number'] ?? '';

        // --- Email ---
        $email = $map['email']         ?? $map['email_address'] ?? $map['mf_email']      ??
                 $map['your_email']    ?? $map['mail']          ?? '';

        // --- Message ---
        $message = $map['message']     ?? $map['your_message']  ?? $map['mf_message']    ??
                   $map['description'] ?? $map['mf_textarea']   ?? $map['enquiry']       ??
                   $map['looking_for'] ?? '';

        // Smart fallback: detect by value pattern if all empty
        if ( empty( $name ) && empty( $phone ) && empty( $email ) ) {
            foreach ( $map as $v ) {
                if ( empty( $email ) && strpos( $v, '@' ) !== false )                     { $email = $v; continue; }
                if ( empty( $phone ) && preg_match( '/^\+?[\d\s\-]{7,15}$/', trim( $v ) ) ) { $phone = $v; continue; }
                if ( empty( $name )  && strlen( $v ) > 1 && strlen( $v ) < 80 )          { $name  = $v; }
            }
        }

        ( new Arthaleads_API( 'metform' ) )->send_lead( [
            'name'      => $name  ?: 'MetForm Lead',
            'phone'     => $phone ?: '',
            'email'     => $email ?: '',
            'message'   => $message ?: '',
            'form_name' => $form_name ?: '',
        ] );
    }
}
