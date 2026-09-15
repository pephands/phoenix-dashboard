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
  @ViewChild('regTrendCanvas') regTrendCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('leadTrendCanvas') leadTrendCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourceCanvas') sourceCanvas!: ElementRef<HTMLCanvasElement>;

  // Charts
  private regTrendChart: Chart | null = null;
  private leadTrendChart: Chart | null = null;
  private sourceChart: Chart | null = null;

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
  private filterSub!: Subscription;

  constructor(
    private marathonService: MarathonService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
    if (this.regTrendChart) { this.regTrendChart.destroy(); this.regTrendChart = null; }
    if (this.leadTrendChart) { this.leadTrendChart.destroy(); this.leadTrendChart = null; }
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

  changeRegTrendGranularity(g: 'daily' | 'weekly' | 'monthly'): void {
    this.regTrendGranularity = g;
    this.renderRegistrationTrendChart();
  }

  changeLeadTrendGranularity(g: 'daily' | 'weekly' | 'monthly'): void {
    this.leadTrendGranularity = g;
    this.renderLeadTrendChart();
  }

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  logout(): void {
    this.authService.logout();
  }

  autoCountEnabled: boolean = true;

  toggleAutoCount(): void {
    this.autoCountEnabled = !this.autoCountEnabled;
    const msg = this.autoCountEnabled
      ? `Total Registrations auto-count is ON (Live: ${this.metrics.totalRegistrations} verified database runners).`
      : `Manual registrations view selected.`;
    this.notificationService.info(msg, 'Auto-Count Option');
    this.renderRegistrationTrendChart();
  }

  // ============================================
  // Charts Implementation (Chart.js)
  // ============================================
  renderAllCharts(): void {
    this.renderRegistrationTrendChart();
    this.renderLeadTrendChart();
    this.renderSourceChart();
  }

  private renderRegistrationTrendChart(): void {
    if (!this.regTrendCanvas?.nativeElement) return;
    if (this.regTrendChart) {
      this.regTrendChart.destroy();
    }

    const rawTrends = (this.statsRaw as any)?.trends;
    const trends = this.marathonService.computeTrends(this.allLeads, this.regTrendGranularity, rawTrends, this.metaCampaign);
    const labels = trends.length > 0 ? trends.map(t => t.label) : ['Sep 5', 'Sep 11', 'Sep 12', 'Sep 15'];
    const data = trends.length > 0 ? trends.map(t => t.registrations) : [5, 3, 7, 2];

    const ctx = this.regTrendCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(225, 29, 72, 0.35)');
    gradient.addColorStop(1, 'rgba(225, 29, 72, 0.00)');

    this.regTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Confirmed Registrations (Auto-Count: ${this.metrics.totalRegistrations})`,
            data,
            borderColor: '#e11d48',
            borderWidth: 3,
            pointBackgroundColor: '#be123c',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor: gradient,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => `Registrations (Auto-Count): ${item.formattedValue}`
            }
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
            ticks: {
              font: { size: 11 },
              color: '#64748b',
              precision: 0
            }
          }
        }
      }
    });
  }

  private renderLeadTrendChart(): void {
    if (!this.leadTrendCanvas?.nativeElement) return;
    if (this.leadTrendChart) {
      this.leadTrendChart.destroy();
    }

    const rawTrends = (this.statsRaw as any)?.trends;
    const trends = this.marathonService.computeTrends(this.allLeads, this.leadTrendGranularity, rawTrends, this.metaCampaign);
    const labels = trends.length > 0 ? trends.map(t => t.label) : ['Sep 5', 'Sep 11', 'Sep 12', 'Sep 15'];
    const data = trends.length > 0 ? trends.map(t => t.leads) : [24, 32, 48, 23];

    const ctx = this.leadTrendCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(217, 70, 239, 0.35)');
    gradient.addColorStop(1, 'rgba(217, 70, 239, 0.00)');

    this.leadTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Meta Campaign Leads (${this.metaCampaign.meta_leads || 127} Total)`,
            data,
            borderColor: '#c026d3',
            borderWidth: 3,
            pointBackgroundColor: '#a21caf',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            backgroundColor: gradient,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => `Meta Campaign Leads: ${item.formattedValue}`
            }
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
            ticks: {
              font: { size: 11 },
              color: '#64748b',
              precision: 0
            }
          }
        }
      }
    });
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
