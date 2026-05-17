import type { CountryCode, CountryDefinition } from "./types";

const standardAddressOrder: CountryDefinition["addressOrder"] = [
  "streetLine1",
  "city",
  "region",
  "postalCode",
  "country"
];

export const TAX_EXEMPT_US_STATE_CODES = ["AK", "DE", "MT", "NH", "OR"] as const;

export const COUNTRY_DEFINITIONS: Record<CountryCode, CountryDefinition> = {
  US: {
    code: "US",
    name: "United States",
    regionLabel: "State",
    postalLabel: "ZIP Code",
    postalPattern: "^\\d{5}(-\\d{4})?$",
    phonePrefix: "+1",
    addressOrder: standardAddressOrder,
    regions: [
      { code: "AK", name: "Alaska", taxExempt: true },
      { code: "CA", name: "California" },
      { code: "DE", name: "Delaware", taxExempt: true },
      { code: "MT", name: "Montana", taxExempt: true },
      { code: "NH", name: "New Hampshire", taxExempt: true },
      { code: "NY", name: "New York" },
      { code: "OR", name: "Oregon", taxExempt: true },
      { code: "TX", name: "Texas" },
      { code: "WA", name: "Washington" }
    ]
  },
  CA: {
    code: "CA",
    name: "Canada",
    regionLabel: "Province",
    postalLabel: "Postal Code",
    postalPattern: "^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$",
    phonePrefix: "+1",
    addressOrder: standardAddressOrder,
    regions: [
      { code: "AB", name: "Alberta" },
      { code: "BC", name: "British Columbia" },
      { code: "ON", name: "Ontario" },
      { code: "QC", name: "Quebec" }
    ]
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    regionLabel: "County",
    postalLabel: "Postcode",
    postalPattern: "^[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}$",
    phonePrefix: "+44",
    addressOrder: standardAddressOrder,
    regions: [
      { code: "ENG", name: "England" },
      { code: "SCT", name: "Scotland" },
      { code: "WLS", name: "Wales" },
      { code: "NIR", name: "Northern Ireland" }
    ]
  },
  AU: {
    code: "AU",
    name: "Australia",
    regionLabel: "State",
    postalLabel: "Postcode",
    postalPattern: "^\\d{4}$",
    phonePrefix: "+61",
    addressOrder: standardAddressOrder,
    regions: [
      { code: "NSW", name: "New South Wales" },
      { code: "QLD", name: "Queensland" },
      { code: "VIC", name: "Victoria" },
      { code: "WA", name: "Western Australia" }
    ]
  },
  DE: {
    code: "DE",
    name: "Germany",
    regionLabel: "State",
    postalLabel: "Postleitzahl",
    postalPattern: "^\\d{5}$",
    phonePrefix: "+49",
    addressOrder: standardAddressOrder,
    regions: [
      { code: "BE", name: "Berlin" },
      { code: "BY", name: "Bavaria" },
      { code: "HH", name: "Hamburg" },
      { code: "NW", name: "North Rhine-Westphalia" }
    ]
  },
  FR: {
    code: "FR",
    name: "France",
    regionLabel: "Region",
    postalLabel: "Code postal",
    postalPattern: "^\\d{5}$",
    phonePrefix: "+33",
    addressOrder: standardAddressOrder,
    regions: [
      { code: "ARA", name: "Auvergne-Rhone-Alpes" },
      { code: "IDF", name: "Ile-de-France" },
      { code: "NAQ", name: "Nouvelle-Aquitaine" },
      { code: "PAC", name: "Provence-Alpes-Cote d'Azur" }
    ]
  },
  JP: {
    code: "JP",
    name: "Japan",
    regionLabel: "Prefecture",
    postalLabel: "Postal Code",
    postalPattern: "^\\d{3}-\\d{4}$",
    phonePrefix: "+81",
    addressOrder: ["postalCode", "region", "city", "streetLine1", "country"],
    regions: [
      { code: "13", name: "Tokyo" },
      { code: "14", name: "Kanagawa" },
      { code: "27", name: "Osaka" },
      { code: "40", name: "Fukuoka" }
    ]
  },
  SG: {
    code: "SG",
    name: "Singapore",
    regionLabel: "District",
    postalLabel: "Postal Code",
    postalPattern: "^\\d{6}$",
    phonePrefix: "+65",
    addressOrder: ["streetLine1", "city", "postalCode", "country"],
    regions: [
      { code: "01", name: "Central Area" },
      { code: "03", name: "Queenstown" },
      { code: "19", name: "Serangoon" },
      { code: "22", name: "Jurong" }
    ]
  }
};
