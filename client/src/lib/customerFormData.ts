export type CustomerFormValues = { customerNumber: string; firstName: string; lastName: string; company: string; spouseFirstName: string; spouseLastName: string; maritalStatus: string; birthDate: string; spouseBirthDate: string; street: string; zipCode: string; city: string; country: string; email: string; phone: string; salutation: string; notes: string };

const optional = (value: string) => value || undefined;

export function buildCustomerPayload(values: CustomerFormValues) {
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  return { name: [lastName, firstName].filter(Boolean).join(" "), customerNumber: optional(values.customerNumber), firstName: optional(firstName), lastName: optional(lastName), company: optional(values.company), spouseFirstName: optional(values.spouseFirstName), spouseLastName: optional(values.spouseLastName), maritalStatus: optional(values.maritalStatus), birthDate: optional(values.birthDate), spouseBirthDate: optional(values.spouseBirthDate), street: optional(values.street), zipCode: optional(values.zipCode), city: optional(values.city), country: optional(values.country), email: optional(values.email), phone: optional(values.phone), salutation: optional(values.salutation), notes: optional(values.notes) };
}
