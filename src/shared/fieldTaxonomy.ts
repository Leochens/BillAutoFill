import type { FieldKind } from "./types";

type KnownFieldKind = Exclude<FieldKind, "unknown">;

export const FIELD_KEYWORDS: Record<KnownFieldKind, readonly string[]> = {
  givenName: ["first name", "given name", "forename", "fname"],
  familyName: ["last name", "family name", "surname", "lname"],
  fullName: ["full name", "name on account", "contact name"],
  streetLine1: ["address", "street", "address line 1", "street address"],
  city: ["city", "town", "locality"],
  region: ["state", "province", "region", "territory"],
  postalCode: ["zip", "zip code", "postal code", "postcode"],
  country: ["country", "country/region"],
  phone: ["phone", "telephone", "mobile"],
  email: ["email", "e-mail"],
  company: ["company", "organization", "business"],
  gender: ["gender", "sex"]
};
