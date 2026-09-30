// A vendor pitching their own services (freelancer, marketing agency, web
// designer) who tapped our ad or messaged our number is not a buyer, and every
// bot reply to them is wasted money. Zero-cost heuristic: no model call.
//
// Deliberately conservative. A false positive silences the bot on a real
// buyer, so a message must be long AND hit at least two different pitch
// categories. Real leads write a line or two about a property, not a pitch.

const CATEGORIES = [
  // Who they are
  /\b(freelanc(er|ing)|marketing (agency|firm|company|consultant|expert)|digital marketing|performance marketing|seo (expert|specialist|services?)|web(site)? (design|develop)(er|ment|ing)?)\b/i,
  // What they sell
  /\b(seo|google ads|facebook ads|meta ads|social media (marketing|management)|wordpress|lead generation|generate (high[- ]quality |qualified )?(site visit )?leads|qualified leads|branding|video (editing|production)|app development|crm software)\b/i,
  // How they sell it
  /\b(our services|my services|we (provide|offer|specialis[ez]e|help)|i (provide|offer|specialis[ez]e|help)|(sharing|attached|check) (my|our) (portfolio|company profile|website)|portfolio|company profile|case stud(y|ies)|packages?\b.*\b(starting|from)|roi[- ]driven|scale your|grow your (business|sales|brand)|boost your (sales|business|leads))\b/i,
  // Closing pitch
  /\b(let'?s connect|happy to discuss your requirements?|if you'?re interested,? (i'?d|we'?d)|schedule a (quick )?(call|meeting|demo)|book a (free )?(demo|consultation)|partner(ship)? with (us|you)|collaborat(e|ion) (with|opportunit))\b/i,
];

const MIN_LENGTH = 110;

function looksLikeSolicitation(text) {
  const t = String(text || "").trim();
  if (t.length < MIN_LENGTH) return false;
  let hits = 0;
  for (const re of CATEGORIES) if (re.test(t)) hits++;
  return hits >= 2;
}

module.exports = { looksLikeSolicitation };
