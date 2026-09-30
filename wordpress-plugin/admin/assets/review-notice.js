( function () {
    var box = document.querySelector( '.arthaleads-review' );
    if ( ! box || typeof ArthaleadsReview === 'undefined' ) return;

    function send( choice ) {
        var body = new URLSearchParams();
        body.append( 'action', ArthaleadsReview.action );
        body.append( 'nonce', ArthaleadsReview.nonce );
        body.append( 'choice', choice );
        fetch( ArthaleadsReview.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: body, keepalive: true } );
    }

    box.addEventListener( 'click', function ( e ) {
        var dismiss = e.target.closest( '.notice-dismiss' );
        if ( dismiss ) { send( 'later' ); return; }

        var el = e.target.closest( '[data-al-choice]' );
        if ( ! el ) return;
        if ( el.getAttribute( 'href' ) === '#' ) e.preventDefault();
        send( el.getAttribute( 'data-al-choice' ) );
        box.style.display = 'none';
    } );
} )();
