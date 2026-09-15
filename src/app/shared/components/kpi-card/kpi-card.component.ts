import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpiCardComponent implements OnChanges {
  @Input() title = '';
  @Input() value: number | null | undefined = 0;
  @Input() icon = 'analytics';
  @Input() subtitle = '';
  @Input() badge = '';
  @Input() badgeType: 'neutral' | 'success' | 'warning' | 'primary' = 'primary';
  @Input() loading = false;
  @Input() colorTheme: 'rose' | 'pink' | 'fuchsia' | 'emerald' | 'amber' | 'violet' = 'pink';
  @Input() format: 'number' | 'percentage' = 'number';

  displayValue = 0;
  private animationFrameId: number | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.animateCountUp();
    }
  }

  private animateCountUp(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const target = typeof this.value === 'number' && !isNaN(this.value) ? this.value : 0;
    const start = this.displayValue;
    const duration = 900; // ms
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      this.displayValue = Math.round(start + (target - start) * easeOut);
      this.cdr.markForCheck();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(updateCounter);
      } else {
        this.displayValue = target;
        this.animationFrameId = null;
        this.cdr.markForCheck();
      }
    };

    this.animationFrameId = requestAnimationFrame(updateCounter);
  }

  get formattedDisplay(): string {
    const safeVal = typeof this.displayValue === 'number' && !isNaN(this.displayValue) ? this.displayValue : 0;
    const formatted = safeVal.toLocaleString('en-US');
    return this.format === 'percentage' ? `${formatted}%` : formatted;
  }
}
