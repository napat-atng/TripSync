export interface DestinationSuggestion {
  name: string;
  description: string;
  estimated_cost_per_person: number;
  highlights: [string, string, string];
  best_for: string;
}

export interface SuggestionsResult {
  suggestions: DestinationSuggestion[];
  generated_at: string;
  trip_id: string;
}
