// Convex Auth issuer config. Convex Auth reads `applicationID: 'convex'` from this file
// and the issuer URL from `process.env.CONVEX_SITE_URL` (set automatically by Convex).
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
