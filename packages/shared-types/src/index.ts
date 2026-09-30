export interface HealthResponse {
  status: 'ok';
  service: 'medora-api';
}

export interface ApiErrorResponse {
  error: { message: string };
}
