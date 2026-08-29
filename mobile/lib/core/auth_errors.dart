import 'package:dio/dio.dart';

/// Maps the bare status codes the auth layer throws (see backend
/// middlewares/auth.js and services/authService.js assertOrgApproved) to text
/// that's safe to show a user. These are deliberately codes rather than prose
/// on the wire so the client can branch on them — without this mapping a
/// blocked user would literally see "PENDING_APPROVAL" in the error box.
/// Mirrors frontend/src/utils/authErrors.js exactly.
const Map<String, String> kAuthErrorMessages = {
  'PENDING_APPROVAL':
      "Your trial request is still under review. We'll email you as soon as it's activated — usually within one working day.",
  'SIGNUP_REJECTED':
      "This account couldn't be activated. If you think that's a mistake, please contact support@arthaleads.com.",
  'ORGANISATION_INACTIVE':
      'This organisation has been deactivated. Please contact your administrator.',
  'TRIAL_EXPIRED':
      'Your free trial has ended. Please upgrade your plan to continue.',
  'NO_GOOGLE_ACCOUNT':
      "There's no Arthaleads account for that Google address yet. Sign up on the web first, then sign in here.",
};

/// Friendly message for a Dio error from an auth call.
/// Falls back to the server's own message, then [fallback].
String authErrorMessage(Object e, [String fallback = 'Something went wrong. Please try again.']) {
  if (e is DioException) {
    final raw = e.response?.data is Map ? e.response?.data['message'] as String? : null;
    if (raw != null) return kAuthErrorMessages[raw] ?? raw;
  }
  return fallback;
}
