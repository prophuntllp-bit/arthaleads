import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Google's mark, at the size both auth screens use it.
///
/// Lived as a private constant in login_screen.dart until signup needed it
/// too. Copying the paths would have been the quick option and would have
/// meant two Google logos drifting apart the first time one was touched --
/// and the signup screen's placeholder in the meantime was a plain grey "G",
/// which next to a real one looks like a phishing page.
///
/// Exact paths from frontend/src/pages/Login.jsx's inline SVG, so web and
/// mobile show the same mark.
const _googleLogoSvg = '''
<svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.2 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13 17.7 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
  <path fill="#FBBC05" d="M10.5 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/>
  <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
</svg>
''';

class GoogleLogo extends StatelessWidget {
  final double size;
  const GoogleLogo({super.key, this.size = 18});

  @override
  Widget build(BuildContext context) =>
      SvgPicture.string(_googleLogoSvg, width: size, height: size);
}
