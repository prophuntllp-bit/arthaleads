import { Helmet } from "react-helmet-async";

const BASE_URL = "https://www.arthaleads.com";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export default function SEOHead({
  title,
  description,
  canonical,
  image = DEFAULT_IMAGE,
  noIndex = false,
}) {
  const fullTitle = title
    ? `${title} | Arthaleads`
    : "Arthaleads – Real Estate CRM for Pune";

  const canonicalUrl = canonical
    ? `${BASE_URL}${canonical}`
    : BASE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Arthaleads" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
