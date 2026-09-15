import { Component, OnInit } from '@angular/core';
import { NotificationService, ToastMessage } from '../../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent implements OnInit {
  toasts$: Observable<ToastMessage[]>;

  constructor(private notificationService: NotificationService) {
    this.toasts$ = this.notificationService.toasts$;
  }

  ngOnInit(): void {}

  close(id: string): void {
    this.notificationService.remove(id);
  }
}
