export type Companion = "alone" | "couple" | "friends" | "family";
export type Energy = "low" | "medium" | "high";
export type TimeOfDay = "morning" | "noon" | "evening" | "night";
export type Budget = "free" | "low" | "medium" | "high";

export interface ParsedQuery {
  location: string | null;
  target_date: string; // YYYY-MM-DD — "yarın", "cumartesi" gibi ifadelerden çözülür
  date_label: string; // kullanıcıya gösterilecek etiket: "bugün", "yarın", "12 Temmuz Cumartesi"
  companion: Companion | null;
  energy: Energy;
  time_of_day: TimeOfDay;
  wants_crowd: boolean | null;
  budget: Budget;
  time_limit: string | null;
  mobility: string | null;
}

export type SuggestionLayer = "ticketed" | "free" | "venue" | "experience";

export interface ExperienceStep {
  time: string;
  title: string;
  description: string;
  place_query?: string | null; // haritada aranabilir yer adı, örn. "Yoğurtçu Parkı Kadıköy"
}

export interface SuggestionItem {
  id?: number;
  layer: SuggestionLayer;
  title: string;
  meta: string; // kısa etiket: fiyat, mesafe, saat vs.
  reason_text: string;
  source_url: string | null;
  // sadece experience katmanı için:
  steps?: ExperienceStep[];
}

export interface WeatherInfo {
  temp_c: number;
  condition: string; // "açık", "yağmurlu"...
  is_rainy: boolean;
  source: "api" | "mock";
}

export interface SuggestResponse {
  query_id: number;
  parsed: ParsedQuery;
  weather: WeatherInfo;
  suggestions: SuggestionItem[];
  mock_mode: {
    llm: boolean;
    places: boolean;
    weather: boolean;
    search: boolean;
  };
}
