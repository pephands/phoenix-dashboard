export type DateFilterPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'custom';

export interface DashboardFilterState {
  preset: DateFilterPreset;
  startDate?: string;
  endDate?: string;
  category?: string;
  source?: string;
  search?: string;
}
