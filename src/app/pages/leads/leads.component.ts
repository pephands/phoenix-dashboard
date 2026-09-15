import { Component, OnInit, OnDestroy } from '@angular/core';
import { MarathonService } from '../../core/services/marathon.service';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MarathonLead } from '../../core/models/marathon.models';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-leads',
  templateUrl: './leads.component.html',
  styleUrls: ['./leads.component.scss']
})
export class LeadsComponent implements OnInit, OnDestroy {
  leads: MarathonLead[] = [];
  filteredLeads: MarathonLead[] = [];
  loading = true;
  mobileNavOpen = false;

  // Selected lead for detail drawer
  selectedLead: MarathonLead | null = null;
  drawerOpen = false;

  // Filters & Search
  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  selectedCategory = 'all';
  selectedStatus = 'all'; // 'all', 'registered', 'interested'
  selectedSource = 'all';

  categories: string[] = [];
  sources: string[] = [];

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalCount = 0;
  canManageLeadCounts = false;

  constructor(
    private marathonService: MarathonService,
    public authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.canManageLeadCounts = this.authService.canManageLeadCounts();
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.applyClientFilters();
    });

    this.loadLeads();
  }

  ngOnDestroy(): void {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  loadLeads(): void {
    this.loading = true;
    this.marathonService.getStats({ preset: 'all' }, 1, 200).subscribe({
      next: (res) => {
        this.leads = res.results || [];
        this.extractUniqueFilters();
        this.applyClientFilters();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error('Failed to load marathon leads list', 'Error');
      }
    });
  }

  private extractUniqueFilters(): void {
    const catSet = new Set<string>();
    const srcSet = new Set<string>();

    this.leads.forEach(l => {
      if (l.category) catSet.add(l.category);
      if (l.source) srcSet.add(l.source);
    });

    this.categories = Array.from(catSet).sort();
    this.sources = Array.from(srcSet).sort();
  }

  applyClientFilters(): void {
    let list = [...this.leads];

    // Search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(term)) ||
        (l.email && l.email.toLowerCase().includes(term)) ||
        (l.phone && l.phone.includes(term)) ||
        (l.registration_id && l.registration_id.toLowerCase().includes(term))
      );
    }

    // Category filter
    if (this.selectedCategory !== 'all') {
      list = list.filter(l => l.category === this.selectedCategory);
    }

    // Status filter
    if (this.selectedStatus === 'registered') {
      list = list.filter(l => l.is_paid === true);
    } else if (this.selectedStatus === 'interested') {
      list = list.filter(l => l.is_paid === false);
    }

    // Source filter
    if (this.selectedSource !== 'all') {
      list = list.filter(l => l.source === this.selectedSource);
    }

    this.totalCount = list.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);

    const start = (this.currentPage - 1) * this.pageSize;
    this.filteredLeads = list.slice(start, start + this.pageSize);
  }

  onCategoryChange(cat: string): void {
    this.selectedCategory = cat;
    this.currentPage = 1;
    this.applyClientFilters();
  }

  onStatusChange(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.applyClientFilters();
  }

  onSourceChange(src: string): void {
    this.selectedSource = src;
    this.currentPage = 1;
    this.applyClientFilters();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyClientFilters();
    }
  }

  openLeadDrawer(lead: MarathonLead): void {
    this.selectedLead = lead;
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedLead = null;
  }

  toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  logout(): void {
    this.authService.logout();
  }
}
