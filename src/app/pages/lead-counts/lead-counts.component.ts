import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MarathonService } from '../../core/services/marathon.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-lead-counts',
  templateUrl: './lead-counts.component.html',
  styleUrls: ['./lead-counts.component.scss']
})
export class LeadCountsComponent implements OnInit {
  loading = false;
  saving = false;
  error = false;
  errorMessage = '';
  mobileNavOpen = false;
  lastSavedAt: Date | null = null;

  // Role details
  userName = 'Tamizhselvan';
  userRole = 'Telecaller';
  canManage = true;

  // Form Fields
  campaignName = 'Meta / Instagram & Facebook Awareness Campaign';
  metaLeadsCount = 127;
  metaInterestedCount = 45;
  metaConvertedCount = 28;
  metaRegisteredCount = 17;
  autoUpdateRegistrations = true;
  verifiedDatabaseRegistrations = 17;
  targetLeads = 1000;
  notes = '';

  constructor(
    private authService: AuthService,
    private marathonService: MarathonService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getUserName();
    this.userRole = this.authService.getUserRole();
    this.canManage = this.authService.canManageLeadCounts();

    if (!this.canManage) {
      this.notificationService.warning('Access restricted: Only users with the Telecaller role can update lead counts.', 'Unauthorized');
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadCampaignData();
  }

  loadCampaignData(): void {
    this.loading = true;
    this.error = false;
    this.errorMessage = '';

    this.marathonService.getMetaCampaign().subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.campaign) {
          const c = res.campaign;
          this.campaignName = c.campaign_name || this.campaignName;
          this.metaLeadsCount = c.meta_leads_count ?? 127;
          this.metaInterestedCount = c.meta_interested_count ?? 45;
          this.metaConvertedCount = c.meta_converted_count ?? 28;
          this.metaRegisteredCount = c.meta_registered_count ?? 17;
          this.autoUpdateRegistrations = c.auto_update_registrations ?? true;
          this.verifiedDatabaseRegistrations = c.verified_database_registrations ?? 17;
          this.targetLeads = c.target_leads ?? 1000;
          this.notes = c.notes || '';
          if (c.updated_at) {
            this.lastSavedAt = new Date(c.updated_at);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error = true;
        this.errorMessage = err?.message || 'Unable to load Meta Campaign metrics from backend.';
        this.notificationService.error(this.errorMessage, 'Connection Error');
        this.cdr.detectChanges();
      }
    });
  }

  saveCampaignData(): void {
    if (this.metaLeadsCount < 0 || this.metaInterestedCount < 0 || this.metaConvertedCount < 0) {
      this.notificationService.warning('Lead counts cannot be negative numbers.', 'Invalid Input');
      return;
    }

    this.saving = true;

    const payload = {
      campaign_name: this.campaignName,
      meta_leads_count: this.metaLeadsCount,
      meta_interested_count: this.metaInterestedCount,
      meta_converted_count: this.metaConvertedCount,
      meta_registered_count: this.autoUpdateRegistrations ? this.verifiedDatabaseRegistrations : this.metaRegisteredCount,
      auto_update_registrations: this.autoUpdateRegistrations,
      target_leads: this.targetLeads,
      notes: this.notes,
      is_active: true
    };

    this.marathonService.updateMetaCampaign(payload).subscribe({
      next: (res) => {
        this.saving = false;
        this.lastSavedAt = new Date();
        if (res && res.campaign) {
          const c = res.campaign;
          this.metaRegisteredCount = c.meta_registered_count;
          this.verifiedDatabaseRegistrations = c.verified_database_registrations;
        }
        this.notificationService.success(
          'Lead counts and registration auto-count successfully saved & synced with dashboard!',
          'Metrics Synchronized'
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.detail || err?.message || 'Failed to save lead metrics to backend.';
        this.notificationService.error(msg, 'Save Error');
        this.cdr.detectChanges();
      }
    });
  }

  // Quick count adjusters (+/-)
  adjustCount(type: 'leads' | 'interested' | 'converted' | 'registered', delta: number): void {
    if (type === 'leads') {
      this.metaLeadsCount = Math.max(0, this.metaLeadsCount + delta);
    } else if (type === 'interested') {
      this.metaInterestedCount = Math.max(0, this.metaInterestedCount + delta);
    } else if (type === 'converted') {
      this.metaConvertedCount = Math.max(0, this.metaConvertedCount + delta);
    } else if (type === 'registered' && !this.autoUpdateRegistrations) {
      this.metaRegisteredCount = Math.max(0, this.metaRegisteredCount + delta);
    }
  }

  toggleAutoCount(): void {
    this.autoUpdateRegistrations = !this.autoUpdateRegistrations;
    if (this.autoUpdateRegistrations) {
      this.metaRegisteredCount = this.verifiedDatabaseRegistrations;
      this.notificationService.info(
        `Auto-Count enabled: Total Registrations locked to ${this.verifiedDatabaseRegistrations} confirmed database runners.`,
        'Auto-Count Active'
      );
    } else {
      this.notificationService.info('Manual override enabled: You can now specify a custom registration count.', 'Manual Mode');
    }
  }

  resetToDefaults(): void {
    this.metaLeadsCount = 127;
    this.metaInterestedCount = 45;
    this.metaConvertedCount = 28;
    this.autoUpdateRegistrations = true;
    this.metaRegisteredCount = this.verifiedDatabaseRegistrations || 17;
    this.targetLeads = 1000;
    this.notificationService.info('Counts reset to verified benchmark values (127 Leads, 45 Interested, 28 Converted, 17 Registered). Remember to click Save.', 'Defaults Loaded');
  }

  // Calculated Real-Time Funnel Metrics
  get activeRegisteredCount(): number {
    return this.autoUpdateRegistrations ? this.verifiedDatabaseRegistrations : this.metaRegisteredCount;
  }

  get interestedPercentage(): number {
    if (this.metaLeadsCount <= 0) return 0;
    return Math.min(100, Math.round((this.metaInterestedCount / this.metaLeadsCount) * 1000) / 10);
  }

  get convertedPercentage(): number {
    if (this.metaLeadsCount <= 0) return 0;
    return Math.min(100, Math.round((this.metaConvertedCount / this.metaLeadsCount) * 1000) / 10);
  }

  get registeredPercentage(): number {
    if (this.metaLeadsCount <= 0) return 0;
    return Math.min(100, Math.round((this.activeRegisteredCount / this.metaLeadsCount) * 1000) / 10);
  }

  get targetPercentage(): number {
    if (this.targetLeads <= 0) return 0;
    return Math.min(100, Math.round((this.metaLeadsCount / this.targetLeads) * 100));
  }

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  logout(): void {
    this.authService.logout();
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
