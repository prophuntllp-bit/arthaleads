<?php
if ( ! defined( 'WPINC' ) ) die;

/**
 * Asks site admins for a WordPress.org review, but only once the plugin has
 * proved useful (enough leads forwarded, and long enough since install), only
 * to users who can manage options, only on a few relevant admin screens, and
 * never again once they answer or ask us to stop.
 */
class Arthaleads_Review_Notice {

    const OPTION      = 'arthaleads_review';
    const REVIEW_URL  = 'https://wordpress.org/support/plugin/arthaleads/reviews/?filter=5#new-post';
    const SUPPORT_URL = 'https://wordpress.org/support/plugin/arthaleads/';
    const MIN_LEADS   = 5;
    const MIN_DAYS    = 7;
    const SNOOZE_DAYS = 14;
    const AJAX_ACTION = 'arthaleads_review_action';

    public static function get_state() {
        $saved = get_option( self::OPTION, [] );
        return wp_parse_args( is_array( $saved ) ? $saved : [], [
            'installed'    => 0,
            'leads'        => 0,
            'status'       => '',
            'snooze_until' => 0,
        ] );
    }

    private static function save_state( $state ) {
        update_option( self::OPTION, $state, false );
    }

    // Called each time a form submission is forwarded to the CRM.
    public static function record_lead() {
        $state = self::get_state();
        $state['leads']++;
        if ( ! $state['installed'] ) $state['installed'] = time();
        self::save_state( $state );
    }

    public function register() {
        add_action( 'admin_init',            [ $this, 'ensure_install_time' ] );
        add_action( 'admin_notices',         [ $this, 'render' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
        add_action( 'wp_ajax_' . self::AJAX_ACTION, [ $this, 'handle_choice' ] );
        add_filter( 'plugin_row_meta',       [ $this, 'row_meta' ], 10, 2 );
        add_filter( 'admin_footer_text',     [ $this, 'footer_text' ] );
    }

    // Existing sites get their clock started on the first admin load after the
    // update, so nobody is asked on day one.
    public function ensure_install_time() {
        $state = self::get_state();
        if ( ! $state['installed'] ) {
            $state['installed'] = time();
            self::save_state( $state );
        }
    }

    private function on_allowed_screen() {
        if ( ! function_exists( 'get_current_screen' ) ) return false;
        $screen = get_current_screen();
        return $screen && in_array( $screen->id, [ 'dashboard', 'plugins', 'toplevel_page_arthaleads-integration' ], true );
    }

    private function should_show() {
        if ( ! current_user_can( 'manage_options' ) ) return false;
        if ( ! $this->on_allowed_screen() ) return false;
        $state = self::get_state();
        if ( $state['status'] !== '' ) return false;
        if ( $state['snooze_until'] > time() ) return false;
        if ( $state['leads'] < self::MIN_LEADS ) return false;
        if ( ! $state['installed'] || ( time() - $state['installed'] ) < self::MIN_DAYS * DAY_IN_SECONDS ) return false;
        return true;
    }

    public function enqueue() {
        if ( ! $this->should_show() ) return;
        wp_enqueue_script(
            'arthaleads-review',
            plugin_dir_url( __FILE__ ) . '../admin/assets/review-notice.js',
            [],
            ARTHALEADS_VERSION,
            true
        );
        wp_localize_script( 'arthaleads-review', 'ArthaleadsReview', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'arthaleads_review' ),
            'action'  => self::AJAX_ACTION,
        ] );
    }

    public function render() {
        if ( ! $this->should_show() ) return;
        $state = self::get_state();
        $logo  = plugin_dir_url( __FILE__ ) . '../admin/assets/notice-icon.png';
        ?>
        <div class="notice notice-info is-dismissible arthaleads-review" style="display:flex;align-items:center;gap:16px;padding:14px 16px;">
            <img src="<?php echo esc_url( $logo ); ?>" alt="" width="56" height="56" style="border-radius:10px;flex:none;" />
            <div>
                <p style="margin:0 0 4px;font-size:14px;">
                    <strong><?php esc_html_e( 'Enjoying Arthaleads?', 'arthaleads' ); ?></strong>
                    <?php
                    /* translators: %s: number of leads forwarded */
                    echo esc_html( sprintf( __( 'Your forms have sent %s leads to your CRM. If it has been useful, a quick review on WordPress.org helps other teams find it.', 'arthaleads' ), number_format_i18n( $state['leads'] ) ) );
                    ?>
                </p>
                <p style="margin:8px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
                    <a class="button button-primary" href="<?php echo esc_url( self::REVIEW_URL ); ?>" target="_blank" rel="noopener noreferrer" data-al-choice="done"><?php esc_html_e( 'Leave a review', 'arthaleads' ); ?></a>
                    <a class="button" href="#" data-al-choice="later"><?php esc_html_e( 'Maybe later', 'arthaleads' ); ?></a>
                    <a class="button" href="#" data-al-choice="done"><?php esc_html_e( 'I already did', 'arthaleads' ); ?></a>
                    <a class="button-link" href="<?php echo esc_url( self::SUPPORT_URL ); ?>" target="_blank" rel="noopener noreferrer" data-al-choice="later"><?php esc_html_e( 'I need help', 'arthaleads' ); ?></a>
                    <a class="button-link" href="#" data-al-choice="never"><?php esc_html_e( "Don't ask again", 'arthaleads' ); ?></a>
                </p>
            </div>
        </div>
        <?php
    }

    public function handle_choice() {
        check_ajax_referer( 'arthaleads_review', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( null, 403 );

        $choice = isset( $_POST['choice'] ) ? sanitize_key( wp_unslash( $_POST['choice'] ) ) : '';
        $state  = self::get_state();

        if ( 'later' === $choice ) {
            $state['snooze_until'] = time() + self::SNOOZE_DAYS * DAY_IN_SECONDS;
        } elseif ( 'done' === $choice || 'never' === $choice ) {
            $state['status'] = $choice;
        } else {
            wp_send_json_error( null, 400 );
        }
        self::save_state( $state );
        wp_send_json_success();
    }

    public function row_meta( $links, $file ) {
        if ( plugin_basename( ARTHALEADS_PLUGIN_FILE ) === $file ) {
            $links[] = '<a href="' . esc_url( self::REVIEW_URL ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Rate this plugin', 'arthaleads' ) . ' &#9733;&#9733;&#9733;&#9733;&#9733;</a>';
        }
        return $links;
    }

    public function footer_text( $text ) {
        if ( ! $this->on_allowed_screen() ) return $text;
        $screen = get_current_screen();
        if ( ! $screen || 'toplevel_page_arthaleads-integration' !== $screen->id ) return $text;
        return sprintf(
            /* translators: %s: link to the WordPress.org review page */
            esc_html__( 'Enjoying Arthaleads? Please %s on WordPress.org. Thank you!', 'arthaleads' ),
            '<a href="' . esc_url( self::REVIEW_URL ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'leave a review', 'arthaleads' ) . '</a>'
        );
    }
}
