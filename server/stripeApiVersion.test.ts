import { describe, expect, it } from "vitest";

import { STRIPE_API_VERSION } from "./stripeApiVersion";



describe("STRIPE_API_VERSION", () => {
  
  it("pins all Stripe clients to the currently supported SDK API release", () => {
    
    expect(STRIPE_API_VERSION).toBe("2026-07-29.dahlia");
    
  });
  
});





