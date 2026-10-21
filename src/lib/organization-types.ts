export type CompanyFormState = {
  /** Form-level message (database failure, unconfirmed email). */
  error?: string;
  fieldErrors?: { companyName?: string; legalName?: string };
  /** Echo of what the user typed, so the form can show it again after an error. */
  values?: { companyName: string; legalName: string };
};
