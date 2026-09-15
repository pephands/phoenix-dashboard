export interface MarathonLead {
  id?: number;
  registration_id: string;
  name: string;
  email: string;
  phone: string;
  area?: string;
  date_of_birth?: string;
  age?: number;
  blood_group?: string;
  tshirt_size?: string;
  category: string;
  is_paid: boolean;
  paid_date?: string | null;
  source: string;
  utm_source?: string;
  utm_medium?: string;
  bib_number?: string | null;
  bib_collection_center?: string | null;
  bib_collection_status?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CategoryCountItem {
  category: string;
  count: number;
}

export interface MarathonStatsRawResponse {
  total_count: number;
  paid_count: number;
  unpaid_count: number;
  category_wise?: CategoryCountItem[];
  age_group_wise?: Record<string, number>;
  blood_group_wise?: Record<string, number>;
  tshirt_size_wise?: Record<string, number>;
  source_wise?: Record<string, number>;
  bib_collection_center_wise?: Record<string, number>;
  bib_collection_status_wise?: Record<string, number>;
  total_pages?: number;
  current_page?: number;
  next?: string | null;
  previous?: string | null;
  results?: MarathonLead[];
  trends?: {
    daily?: TrendDataPoint[];
    weekly?: TrendDataPoint[];
    monthly?: TrendDataPoint[];
  };
  meta_campaign?: {
    meta_leads: number;
    meta_interested: number;
    meta_converted: number;
    meta_registered: number;
    auto_update_registrations?: boolean;
    verified_database_registrations?: number;
  };
}

export interface DashboardMetrics {
  totalLeads: number;
  interestedLeads: number;
  convertedLeads: number;
  totalRegistrations: number;
  todayLeads: number;
  todayRegistrations: number;
  conversionRate: number;
  activeLeads: number;
}

export interface FunnelStage {
  label: string;
  stageName: string;
  count: number;
  percentage: number;
  icon: string;
  color: string;
  badge: string;
}

export interface TrendDataPoint {
  label: string;
  leads: number;
  registrations: number;
}

export interface LeadSourceBreakdown {
  source: string;
  leadCount: number;
  interestedCount: number;
  convertedCount: number;
}

export interface MarathonActivity {
  id: string;
  type: 'lead_created' | 'lead_interested' | 'lead_converted' | 'registered';
  title: string;
  description: string;
  timestamp: string;
  timeAgo: string;
  statusBadge: string;
  category?: string;
}
