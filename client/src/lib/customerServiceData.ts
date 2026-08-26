export type CustomerServiceValues = { customerId: number; description: string; revenueAccountId: string; hourlyRate: string; isDefault: boolean };

export function buildCustomerServicePayload(values: CustomerServiceValues) {
  return { customerId: values.customerId, description: values.description.trim(), revenueAccountId: parseInt(values.revenueAccountId), hourlyRate: values.hourlyRate ? parseFloat(values.hourlyRate) : undefined, isDefault: values.isDefault };
}
