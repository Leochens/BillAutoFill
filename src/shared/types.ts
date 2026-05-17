export type CountryCode = "US" | "CA" | "GB" | "AU" | "DE" | "FR" | "JP" | "SG";

export type GenderPreference = "any" | "male" | "female" | "neutral";

export type GeneratedGender = Exclude<GenderPreference, "any">;

export type AddressField =
  | "streetLine1"
  | "city"
  | "region"
  | "postalCode"
  | "country";

export interface ProfilePreferences {
  countryCode: CountryCode;
  gender: GenderPreference;
  preferTaxExemptState?: boolean;
  regionCode?: string;
  seed?: number;
}

export interface BillingProfile {
  givenName: string;
  familyName: string;
  gender: GeneratedGender;
  streetLine1: string;
  city: string;
  region: string;
  regionCode: string;
  postalCode: string;
  country: string;
  countryCode: CountryCode;
  phone: string;
  email: string;
  company?: string;
}

export interface CountryRegion {
  code: string;
  name: string;
  taxExempt?: boolean;
}

export interface CountryDefinition {
  code: CountryCode;
  name: string;
  regionLabel: string;
  postalLabel: string;
  postalPattern: string;
  phonePrefix: string;
  addressOrder: AddressField[];
  regions: CountryRegion[];
}
