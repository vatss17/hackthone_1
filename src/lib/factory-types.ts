export type FactoryField =
  | "factoryName"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "postalCode";

export type FactoryFormValues = Record<FactoryField, string>;

export type FactoryFormState = {
  /** Form-level message (database failure, not permitted). */
  error?: string;
  fieldErrors?: Partial<Record<FactoryField, string>>;
  /** Echo of what the user typed, so the form can show it again after an error. */
  values?: FactoryFormValues;
};

/** A factory as shown in the application. */
export type Factory = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: string;
  archivedAt: string | null;
};
