import { COUNTRY_DEFINITIONS } from "./countries";
import type {
  BillingProfile,
  CountryCode,
  CountryRegion,
  GeneratedGender,
  ProfilePreferences
} from "./types";

const givenNames: Record<GeneratedGender, string[]> = {
  male: ["Alex", "Ben", "Daniel", "Evan", "Marcus", "Noah"],
  female: ["Avery", "Clara", "Elena", "Maya", "Nora", "Sophie"],
  neutral: ["Casey", "Jordan", "Morgan", "Riley", "Taylor", "Quinn"]
};

const familyNames = ["Bennett", "Carter", "Foster", "Hayes", "Morgan", "Reed", "Turner"];
const streetNames = ["Maple", "Cedar", "Oak", "Pine", "Willow", "Lake", "Hill"];
const streetTypes = ["Street", "Avenue", "Road", "Lane", "Drive"];
const companies = ["Northstar Labs", "Bright Ledger", "Test Harbor", "Sample Works"];

const cityNames: Record<CountryCode, string[]> = {
  US: ["Portland", "Juneau", "Dover", "Concord", "Austin"],
  CA: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  GB: ["London", "Manchester", "Edinburgh", "Cardiff"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  DE: ["Berlin", "Munich", "Hamburg", "Cologne"],
  FR: ["Paris", "Lyon", "Bordeaux", "Nice"],
  JP: ["Tokyo", "Yokohama", "Osaka", "Fukuoka"],
  SG: ["Singapore", "Queenstown", "Serangoon", "Jurong"]
};

function createSeededRandom(seed = 1): () => number {
  let state = Math.trunc(seed) % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function randomDigits(length: number, random: () => number): string {
  return Array.from({ length }, () => Math.floor(random() * 10)).join("");
}

function chooseGender(preference: ProfilePreferences["gender"], random: () => number): GeneratedGender {
  if (preference !== "any") return preference;
  return pick(["male", "female", "neutral"], random);
}

function chooseRegion(preferences: ProfilePreferences, random: () => number): CountryRegion {
  const country = COUNTRY_DEFINITIONS[preferences.countryCode];
  const requestedRegion = preferences.regionCode
    ? country.regions.find((region) => region.code === preferences.regionCode)
    : undefined;

  if (requestedRegion) return requestedRegion;

  if (preferences.countryCode === "US" && preferences.preferTaxExemptState) {
    return pick(
      country.regions.filter((region) => region.taxExempt),
      random
    );
  }

  return pick(country.regions, random);
}

function buildPostalCode(countryCode: CountryCode, random: () => number): string {
  switch (countryCode) {
    case "CA":
      return `${pick(["K", "M", "V", "T"], random)}${randomDigits(1, random)}${pick(
        ["A", "B", "N", "P"],
        random
      )} ${randomDigits(1, random)}${pick(["C", "G", "R", "S"], random)}${randomDigits(1, random)}`;
    case "GB":
      return `${pick(["EC", "SW", "M", "B"], random)}${randomDigits(1, random)} ${randomDigits(
        1,
        random
      )}${pick(["AA", "BD", "JT", "RX"], random)}`;
    case "AU":
      return `${pick(["2", "3", "4", "6"], random)}${randomDigits(3, random)}`;
    case "JP":
      return `${randomDigits(3, random)}-${randomDigits(4, random)}`;
    case "SG":
      return randomDigits(6, random);
    default:
      return randomDigits(5, random);
  }
}

function buildPhone(prefix: string, random: () => number): string {
  return `${prefix} ${randomDigits(3, random)} ${randomDigits(3, random)} ${randomDigits(4, random)}`;
}

function buildEmail(givenName: string, familyName: string, random: () => number): string {
  const localPart = `${givenName}.${familyName}.${randomDigits(3, random)}`.toLowerCase();
  return `${localPart}@example.test`;
}

export function generateProfile(preferences: ProfilePreferences): BillingProfile {
  const country = COUNTRY_DEFINITIONS[preferences.countryCode];
  const random = createSeededRandom(preferences.seed);
  const gender = chooseGender(preferences.gender, random);
  const region = chooseRegion(preferences, random);
  const givenName = pick(givenNames[gender], random);
  const familyName = pick(familyNames, random);
  const streetLine1 = `${100 + Math.floor(random() * 8900)} ${pick(streetNames, random)} ${pick(
    streetTypes,
    random
  )}`;

  return {
    givenName,
    familyName,
    gender,
    streetLine1,
    city: pick(cityNames[preferences.countryCode], random),
    region: region.name,
    regionCode: region.code,
    postalCode: buildPostalCode(preferences.countryCode, random),
    country: country.name,
    countryCode: country.code,
    phone: buildPhone(country.phonePrefix, random),
    email: buildEmail(givenName, familyName, random),
    company: pick(companies, random)
  };
}
