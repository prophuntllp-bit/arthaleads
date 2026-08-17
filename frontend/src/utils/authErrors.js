// Maps the bare status codes the auth layer throws (see backend
// middlewares/auth.js and services/authService.js assertOrgApproved) to text
// that's safe to show a user. These are deliberately codes rather than prose
// on the wire so the frontend can branch on them — without this mapping a
// blocked user would literally see "PENDING_APPROVAL" in the error box.
const AUTH_ERROR_MESSAGES = {
  PENDING_APPROVAL:
    "Your trial request is still under review. We'll email you as soon as it's activated — usually within one working day.",
  SIGNUP_REJECTED:
    "This account couldn't be activated. If you think that's a mistake, please contact support@arthaleads.com.",
  ORGANISATION_INACTIVE:
    "This organisation has been deactivated. Please contact your administrator.",
  TRIAL_EXPIRED:
    "Your free trial has ended. Please upgrade your plan to continue.",
};

/**
 * Friendly message for an axios error from an auth call.
 * Falls back to the server's own message, then a generic line.
 */
export function authErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const raw = err?.response?.data?.message;
  return AUTH_ERROR_MESSAGES[raw] || raw || fallback;
}

/** True when the error is the "awaiting manual approval" gate. */
export function isPendingApproval(err) {
  return err?.response?.data?.message === "PENDING_APPROVAL";
}

export { AUTH_ERROR_MESSAGES };
