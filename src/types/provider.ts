export interface Provider {
  provider_id: string;
  full_name: string;
  specialties: string;
  search_category: string[];
  provider_type: "practitioner" | "facility" | "medical equipment";
  practice_name: string;
  address1: string;
  address2: string | null;
  city: string;
  office_state: string;
  zip_code: string;
  phone: string;
  is_accepting_new_patients: boolean;
  is_preferred: boolean;
  gender: string;
  languages_spoken: { code: string; label: string }[];
  directory_eligible_locations_count: number;
  distance: number;
  // Added by our API route after geocoding
  lat?: number;
  lng?: number;
}

export interface SearchParams {
  zip_code: string;
  page: number;
  page_size: number;
  radius: number;
  provider_types: string[];
  sort: string;
  q?: string;
}

export interface ProvidersResponse {
  results: Provider[];
  total: number;
  page: number;
  page_size: number;
}
