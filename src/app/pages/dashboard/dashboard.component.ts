import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { MarathonService } from '../../core/services/marathon.service';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  DashboardMetrics,
  FunnelStage,
  LeadSourceBreakdown,
  MarathonActivity,
  MarathonLead,
  MarathonStatsRawResponse
} from '../../core/models/marathon.models';
import { DashboardFilterState, DateFilterPreset } from '../../core/models/filter.models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // Chart canvas refs
  @ViewChild('sourceCanvas') sourceCanvas!: ElementRef<HTMLCanvasElement>;

  // Charts
  private sourceChart: Chart | null = null;

  // Sync / Schedule display
  lastUpdatedDisplay = 'Sep 17, 2026, 6:00 PM';

  // State
  loading = true;
  refreshing = false;
  error = false;
  errorMessage = '';

  // Data
  statsRaw: MarathonStatsRawResponse | null = null;
  metrics: DashboardMetrics = {
    totalLeads: 0,
    interestedLeads: 0,
    convertedLeads: 0,
    totalRegistrations: 0,
    todayLeads: 0,
    todayRegistrations: 0,
    conversionRate: 0,
    activeLeads: 0
  };

  funnelStages: FunnelStage[] = [];
  sourceBreakdown: LeadSourceBreakdown[] = [];
  recentActivities: MarathonActivity[] = [];
  allLeads: MarathonLead[] = [];

  // Meta Campaign Dedicated Metrics
  metaCampaign = {
    meta_leads: 0,
    meta_interested: 0,
    meta_converted: 0,
    meta_registered: 0
  };

  // Filter State
  currentPreset: DateFilterPreset = 'all';
  customStartDate = '';
  customEndDate = '';
  regTrendGranularity: 'daily' | 'weekly' | 'monthly' = 'daily';
  leadTrendGranularity: 'daily' | 'weekly' | 'monthly' = 'daily';

  // Navigation / UI
  mobileNavOpen = false;
  canManageLeadCounts = false;
  userName = 'Marathon Admin';
  userRole = 'Telecaller';
  private filterSub!: Subscription;

  constructor(
    private marathonService: MarathonService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getUserName();
    this.userRole = this.authService.getUserRole();
    this.canManageLeadCounts = this.authService.canManageLeadCounts();
    this.filterSub = this.marathonService.filters$.subscribe(filters => {
      this.currentPreset = filters.preset;
      this.customStartDate = filters.startDate || '';
      this.customEndDate = filters.endDate || '';
      this.loadDashboardData();
    });
  }

  ngAfterViewInit(): void {
    // Initial chart rendering handled in loadDashboardData after data arrives
  }

  ngOnDestroy(): void {
    if (this.filterSub) {
      this.filterSub.unsubscribe();
    }
    this.destroyCharts();
  }

  private destroyCharts(): void {
    if (this.sourceChart) { this.sourceChart.destroy(); this.sourceChart = null; }
  }

  loadDashboardData(): void {
    if (!this.statsRaw) {
      this.loading = true;
    } else {
      this.refreshing = true;
    }
    this.error = false;
    this.errorMessage = '';

    const currentFilters = this.marathonService.currentFilters;

    forkJoin({
      stats: this.marathonService.getStats(currentFilters, 1, 100),
      today: this.marathonService.getTodayStats()
    }).subscribe({
      next: ({ stats, today }) => {
        this.statsRaw = stats;
        this.allLeads = stats.results || [];
        this.metrics = this.marathonService.computeDashboardMetrics(stats, today);
        this.funnelStages = this.marathonService.computeFunnelStages(this.metrics);
        this.sourceBreakdown = this.marathonService.computeSourceBreakdown(stats);
        this.recentActivities = this.marathonService.computeRecentActivity(this.allLeads);
        this.lastUpdatedDisplay = this.marathonService.getLastUpdatedDisplay(this.allLeads);

        if ((stats as any)?.meta_campaign) {
          this.metaCampaign = (stats as any).meta_campaign;
        }

        this.loading = false;
        this.refreshing = false;
        this.cdr.detectChanges();

        // Render charts once DOM elements are ready
        setTimeout(() => {
          this.renderAllCharts();
        }, 80);
      },
      error: (err) => {
        this.loading = false;
        this.refreshing = false;
        this.error = true;
        this.errorMessage = err?.message || 'Unable to connect to Marathon backend. Please verify your connection.';
        this.notificationService.error(this.errorMessage, 'Data Fetch Error');
        this.cdr.detectChanges();
      }
    });
  }

  // Filter Actions
  setPreset(preset: DateFilterPreset): void {
    if (preset === 'custom') {
      this.currentPreset = 'custom';
      return;
    }
    this.marathonService.updateFilters({
      preset,
      startDate: undefined,
      endDate: undefined
    });
  }

  applyCustomRange(): void {
    if (!this.customStartDate || !this.customEndDate) {
      this.notificationService.warning('Please select both start and end dates', 'Invalid Date Range');
      return;
    }
    this.marathonService.updateFilters({
      preset: 'custom',
      startDate: this.customStartDate,
      endDate: this.customEndDate
    });
  }

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  logout(): void {
    this.authService.logout();
  }

  // ============================================
  // Charts Implementation (Chart.js)
  // ============================================
  renderAllCharts(): void {
    this.renderSourceChart();
  }

  private renderSourceChart(): void {
    if (!this.sourceCanvas?.nativeElement) return;
    if (this.sourceChart) {
      this.sourceChart.destroy();
    }

    const sources = this.sourceBreakdown;
    const labels = sources.length > 0 ? sources.map(s => s.source) : ['Website', 'Meta', 'Instagram', 'Referral'];
    const leadCounts = sources.length > 0 ? sources.map(s => s.leadCount) : [0, 0, 0, 0];
    const registeredCounts = sources.length > 0 ? sources.map(s => s.convertedCount) : [0, 0, 0, 0];

    const ctx = this.sourceCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.sourceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Leads',
            data: leadCounts,
            backgroundColor: '#fb7185',
            borderRadius: 6
          },
          {
            label: 'Registered',
            data: registeredCounts,
            backgroundColor: '#be123c',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: { size: 11, weight: 'bold' },
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#64748b' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(244, 114, 182, 0.12)' },
            ticks: { font: { size: 11 }, color: '#64748b', precision: 0 }
          }
        }
      }
    });
  }
}
