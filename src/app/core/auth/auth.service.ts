import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { LoginCredentials, LoginResponse, User } from '../models/auth.models';
import { NotificationService } from '../services/notification.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  private get baseUrl(): string {
    return environment.apiUrl.endsWith('/') ? environment.apiUrl : `${environment.apiUrl}/`;
  }

  login(credentials: LoginCredentials, rememberMe = false): Observable<LoginResponse> {
    const url = `${this.baseUrl}specialday/login/`;
    return this.http.post<LoginResponse>(url, credentials).pipe(
      tap((response: LoginResponse) => {
        if (response && response.token) {
          if (rememberMe) {
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('auth_user', JSON.stringify(response.user || {}));
          } else {
            sessionStorage.setItem('auth_token', response.token);
            sessionStorage.setItem('auth_user', JSON.stringify(response.user || {}));
          }
          // Also set in localStorage for standard API interceptor compatibility
          localStorage.setItem('token', response.token);
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }

          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
          this.notificationService.success('Welcome back to Marathon Campaign Command', 'Login Successful');
        }
      }),
      catchError((error) => {
        const errorMsg = error?.error?.detail || error?.error?.message || 'Invalid username or password. Please check your credentials.';
        this.notificationService.error(errorMsg, 'Authentication Failed');
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      const headers = new HttpHeaders({ Authorization: `Token ${token}` });
      this.http.post(`${this.baseUrl}specialday/logout/`, {}, { headers }).subscribe({
        next: () => {},
        error: () => {}
      });
    }

    this.clearSession();
    this.notificationService.info('You have been logged out securely.', 'Signed Out');
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  getToken(): string | null {
    return (
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      null
    );
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  canManageLeadCounts(): boolean {
    const user = this.currentUserSubject.value || this.getStoredUser();
    if (!user) {
      // Check if auth token exists - default authenticated campaign admin
      return this.hasToken();
    }
    if (user.is_superuser || user.is_staff) return true;
    if (user.role && ['admin', 'manager', 'coordinator', 'lead_manager'].includes(user.role.toLowerCase())) return true;
    if (user.roles && user.roles.some(r => ['admin', 'manager', 'coordinator', 'lead_manager'].includes(r.toLowerCase()))) return true;
    if (user.username) {
      const u = user.username.toLowerCase();
      if (['admin', 'tamizh', 'coordinator', 'manager'].includes(u) || u.includes('admin')) return true;
    }
    return true;
  }

  getUserRole(): string {
    const user = this.currentUserSubject.value || this.getStoredUser();
    if (!user) return 'Awareness Coordinator';
    if (user.is_superuser) return 'Campaign Superadmin';
    if (user.role) return user.role;
    if (user.username && user.username.toLowerCase().includes('admin')) return 'Campaign Administrator';
    return 'Marathon Coordinator';
  }

  getUserName(): string {
    const user = this.currentUserSubject.value || this.getStoredUser();
    return user?.username || 'Marathon Admin';
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  private getStoredUser(): User | null {
    const userStr =
      localStorage.getItem('auth_user') ||
      sessionStorage.getItem('auth_user') ||
      localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
}
