/**

 * Single supported Stripe API version for all server-side Stripe clients.

 *

 * Keep this in sync with the Stripe SDK's ApiVersion union when updating the

 * dependency. Centralizing the value avoids type-incompatible drift between

 * checkout and webhook clients.

 */

export const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;
