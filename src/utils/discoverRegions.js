export const REGION_PRESETS = {
  all: {
    name: "Global",
    countries: "",
  },
  hollywood: {
    name: "Hollywood",
    countries: "US|GB|CA|AU|IE|NZ",
  },
  bollywood: {
    name: "Bollywood",
    countries: "IN",
  },
  asian: {
    name: "Asian Content",
    countries: "KR|JP|CN|TW|HK|TH",
  },
};

export const SUBFILTER_PRESETS = {
  hollywood: [
    { id: "all", name: "All Western", countries: "US|GB|CA|AU|IE|NZ" },
    { id: "us", name: "United States", countries: "US" },
    { id: "gb", name: "United Kingdom", countries: "GB" },
    { id: "ca", name: "Canada", countries: "CA" },
    { id: "au", name: "Australia", countries: "AU" },
  ],
  bollywood: [
    { id: "all", name: "All Indian", countries: "IN" },
    { id: "hi", name: "Hindi / Bollywood", countries: "IN", language: "hi" },
    { id: "ta", name: "Tamil / Kollywood", countries: "IN", language: "ta" },
    { id: "te", name: "Telugu / Tollywood", countries: "IN", language: "te" },
    { id: "ml", name: "Malayalam", countries: "IN", language: "ml" },
  ],
  asian: [
    { id: "all", name: "All Asian", countries: "KR|JP|CN|TW|HK|TH" },
    { id: "kr", name: "K-Content", countries: "KR" },
    { id: "jp", name: "J-Content", countries: "JP" },
    { id: "cn", name: "C-Content", countries: "CN" },
    { id: "tw_hk", name: "HK & Taiwan", countries: "TW|HK" },
    { id: "th", name: "Thai Content", countries: "TH" },
  ],
};

export function getRegionQueryParams(region, subfilter) {
  if (!region || region === "all") {
    return { countryParam: "", languageParam: "" };
  }

  // Resolve subfilter first
  const presets = SUBFILTER_PRESETS[region] || [];
  const activeSub = presets.find((sf) => sf.id === subfilter) || presets[0];

  if (activeSub) {
    const countries = activeSub.countries || "";
    const language = activeSub.language || "";
    const countryParam = countries ? `&with_origin_country=${countries}` : "";
    const languageParam = language ? `&with_original_language=${language}` : "";
    return { countryParam, languageParam };
  }

  // Fallback to region defaults
  const regPreset = REGION_PRESETS[region];
  const countries = regPreset?.countries || "";
  const countryParam = countries ? `&with_origin_country=${countries}` : "";
  return { countryParam, languageParam: "" };
}
