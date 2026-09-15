export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
  detail?: string;
}
