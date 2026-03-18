import axios from 'axios';
import type { FormAP, Participant, User, AuditLog, Session, EvalResult, EvalReport, PaginatedResponse } from '../types';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

export const healthApi = {
  check: () => axios.get('/health'),
};

export const formApApi = {
  list: (params?: Record<string, any>) => api.get<PaginatedResponse<FormAP>>('/form-aps', { params }),
  get: (id: string) => api.get<FormAP>(`/form-aps/${id}`),
  create: (data: Record<string, any>) => api.post<FormAP>('/form-aps', data),
  update: (id: string, data: Record<string, any>) => api.put<FormAP>(`/form-aps/${id}`, data),
  delete: (id: string) => api.delete(`/form-aps/${id}`),
};

export const participantApi = {
  list: (params?: Record<string, any>) => api.get<PaginatedResponse<Participant>>('/participants', { params }),
  get: (id: string) => api.get<Participant>(`/participants/${id}`),
  create: (data: Record<string, any>) => api.post<Participant>('/participants', data),
  delete: (id: string) => api.delete(`/participants/${id}`),
};

export const userApi = {
  list: (params?: Record<string, any>) => api.get<PaginatedResponse<User>>('/users', { params }),
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: Record<string, any>) => api.post<User>('/users', data),
};

export const sessionApi = {
  list: (params?: Record<string, any>) => api.get<any>('/sessions', { params }),
  create: (data: Record<string, any>) => api.post<Session>('/sessions', data),
  delete: (id: string) => api.delete(`/sessions/${id}`),
};

export const auditApi = {
  list: (params?: Record<string, any>) => api.get<PaginatedResponse<AuditLog>>('/audit', { params }),
};

export const evalApi = {
  readPerformance: (users?: number) => api.get<EvalResult[]>('/eval/read-performance', { params: users ? { users } : undefined }),
  writePerformance: (users?: number) => api.get<EvalResult[]>('/eval/write-performance', { params: users ? { users } : undefined }),
  poolStats: () => api.get<EvalResult[]>('/eval/pool-stats'),
  rlsCheck: () => api.get<EvalResult[]>('/eval/rls-check'),
  integrityCheck: () => api.get<EvalResult[]>('/eval/integrity-check'),
  indexCheck: () => api.get<EvalResult[]>('/eval/index-check'),
  concurrencyTest: (users: number = 50) => api.post<EvalResult[]>(`/eval/concurrency-test?users=${users}`),
  fullReport: () => api.get<EvalReport>('/eval/full-report'),
  queryActivity: (reset = false) => api.get<any>(`/eval/query-activity`, { params: reset ? { reset: true } : undefined }),
};

export default api;
