export interface HealthResponse {
  status: 'ok';
  service: 'medora-api';
}

export interface ApiErrorResponse {
  error: { message: string };
}

export type Role =
  'PATIENT' | 'DOCTOR' | 'PHARMACY_ADMIN' | 'PHARMACY_STAFF' | 'PLATFORM_ADMIN';
export interface PublicUser {
  id: string;
  displayName: string;
  email: string;
  role: Role;
}
export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  // Returned only to the explicit native transport; browsers use an HttpOnly cookie.
  refreshToken?: string;
}
