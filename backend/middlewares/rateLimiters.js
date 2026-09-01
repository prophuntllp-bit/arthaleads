// middlewares/rateLimiters.js
//
// The credential limiter lives here rather than in server.js because it must
// be attached to individual routes, not to a whole namespace.
//
// It used to wrap all of /api/auth. That namespace holds 21 routes and most of
// them are ordinary authenticated traffic — /auth/me on every session restore,
// /auth/agents behind every assignee dropdown, /auth/users on the Team page.
// Simply using the CRM spent the allowance, so by the time someone typed a
// password they were already at the cap and got "Too many login attempts"
// after two or three genuine tries. It is keyed by IP, so an office shared one
// budget between everyone.
//
// Now it guards only the endpoints where a secret is submitted or a message is
// sent — the ones worth rate limiting — and the rest fall under the general
// limiter, which keys on user id when authenticated.

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH) || 50,
  message: { success: false, message: "Too many login attempts, please wait." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only skip for localhost — never bypass based on anything a caller sends.
    const ip = req.ip || "";
    return ip === "::1" || ip === "127.0.0.1";
  },
});

// The signup tab polls this every few seconds while it waits for the emailed
// link to be opened, so it cannot sit behind authLimiter -- a single signup
// would spend that whole allowance in under a minute, and this is keyed by IP,
// so one office would share the budget. That is the exact shape of the bug
// that produced "Too many login attempts" after two or three genuine tries.
//
// One signup polls at most ~150 times (every 4s, giving up at 10 minutes).
// 600 leaves room for several people signing up from one address, while still
// capping a client stuck in a hot loop. The endpoint is a single indexed read
// that returns {verified:false}.
const signupPollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SIGNUP_POLL) || 600,
  message: { success: false, message: "Too many status checks, please refresh and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = req.ip || "";
    return ip === "::1" || ip === "127.0.0.1";
  },
});

module.exports = { authLimiter, signupPollLimiter };
