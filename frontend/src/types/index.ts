export type FormStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'archived';
export type ParticipantRole = 'lead_auditor' | 'engagement_partner' | 'review_partner' | 'team_member' | 'specialist' | 'observer';
export type UserRole = 'admin' | 'global_reviewer' | 'country_manager' | 'auditor' | 'viewer';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'APPROVE' | 'REJECT' | 'SUBMIT';

export interface FormAP {
  form_ap_id: string;
  issuer_id: string;
  fiscal_year: number;
  status: FormStatus;
  location_country: string;
  submission_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  query_latency_ms?: number;
}

export interface Participant {
  participant_id: string;
  form_ap_id: string;
  firm_name: string;
  firm_id: string;
  role: ParticipantRole;
  country: string;
  added_by: string;
  added_at: string;
  query_latency_ms?: number;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  country_access: string[];
  last_login: string | null;
  created_at: string;
  query_latency_ms?: number;
}

export interface AuditLog {
  audit_id: number;
  user_email: string;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  old_value: any;
  new_value: any;
  timestamp: string;
  query_latency_ms?: number;
}

export interface Session {
  session_id: string;
  user_id: string;
  login_time: string;
  last_activity: string;
  ip_address: string | null;
  user_agent: string | null;
  query_latency_ms?: number;
}

export interface EvalResult {
  item_number: number;
  category: string;
  description: string;
  passed: boolean;
  measured_value: any;
  target_value: any;
  latency_ms: number | null;
}

export interface EvalReport {
  total_items: number;
  passed: number;
  failed: number;
  pass_rate: number;
  categories: Record<string, EvalResult[]>;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  query_latency_ms?: number;
}
