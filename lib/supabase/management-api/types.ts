/**
 * Types pour l'API Management de Supabase
 * Basé sur la documentation officielle : https://api.supabase.com/v1
 */

// Types de base
export type ProjectRef = string;
export type BranchId = string;
export type FunctionSlug = string;
export type ApiKeyId = string;
export type SecretName = string;

// Enums
export type ProjectStatus = "ACTIVE_HEALTHY" | "INACTIVE" | "PAUSED";
export type BranchStatus = "CREATING_PROJECT" | "ACTIVE_HEALTHY" | "INACTIVE";
export type FunctionStatus = "ACTIVE" | "INACTIVE";
export type ApiKeyType = "anon" | "service_role" | "legacy";
export type PoolMode = "transaction" | "session" | "statement";
export type ReleaseChannel = "internal" | "beta" | "stable";
export type PostgresEngine = "postgres" | "neon";

// Types de réponse pour les projets
export interface Project {
  id: string;
  ref: ProjectRef;
  organization_id: string;
  organization_slug: string;
  name: string;
  region: string;
  created_at: string;
  status: ProjectStatus;
  database?: {
    host: string;
    version: string;
    postgres_engine: PostgresEngine;
    release_channel: ReleaseChannel;
  };
}

export interface ProjectDatabase {
  infra_compute_size: string;
  region: string;
  status: ProjectStatus;
  cloud_provider: string;
  identifier: string;
  type: "PRIMARY" | "READ_REPLICA";
  disk_volume_size_gb: number;
  disk_type: string;
  disk_throughput_mbps: number;
  disk_last_modified_at: string;
}

export interface ProjectWithDatabases extends Omit<Project, "database"> {
  databases: ProjectDatabase[];
}

// Types pour les branches
export interface DatabaseBranch {
  id: string;
  name: string;
  project_ref: ProjectRef;
  parent_project_ref: ProjectRef;
  is_default: boolean;
  git_branch?: string;
  pr_number?: number;
  latest_check_run_id?: number;
  persistent: boolean;
  status: BranchStatus;
  created_at: string;
  updated_at: string;
  review_requested_at?: string;
  with_data: boolean;
  notify_url?: string;
  deletion_scheduled_at?: string;
  preview_project_status?: ProjectStatus;
}

export interface BranchConfig {
  ref: ProjectRef;
  postgres_version: string;
  postgres_engine: PostgresEngine;
  release_channel: ReleaseChannel;
  status: ProjectStatus;
  db_host: string;
  db_port: number;
  db_user: string;
  db_pass: string;
  jwt_secret: string;
}

// Types pour les fonctions Edge
export interface EdgeFunction {
  id: string;
  slug: FunctionSlug;
  name: string;
  status: FunctionStatus;
  version: number;
  created_at: number;
  updated_at: number;
  verify_jwt: boolean;
  import_map: boolean;
  entrypoint_path: string;
  import_map_path?: string;
  ezbr_sha256?: string;
}

export interface DeployFunctionMetadata {
  name?: string;
  verify_jwt?: boolean;
  import_map?: boolean;
  entrypoint_path?: string;
  import_map_path?: string;
}

// Types pour les secrets
export interface Secret {
  name: SecretName;
  value: string;
  updated_at: string;
}

// Types pour les clés API
export interface ApiKey {
  api_key?: string; // Seulement si reveal=true
  id: ApiKeyId;
  type: ApiKeyType;
  prefix: string;
  name: string;
  description?: string;
  hash: string;
  secret_jwt_template?: Record<string, unknown>;
  inserted_at: string;
  updated_at: string;
}

export interface CreateApiKeyRequest {
  type: ApiKeyType;
  name: string;
  description?: string;
  secret_jwt_template?: Record<string, unknown>;
}

// Types pour la configuration Auth
export interface AuthConfig {
  site_url?: string;
  disable_signup?: boolean;
  jwt_exp?: number;
  smtp_admin_email?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_max_frequency?: number;
  smtp_sender_name?: string;
  mailer_allow_unverified_email_sign_ins?: boolean;
  mailer_autoconfirm?: boolean;
  // ... autres champs selon la documentation
  [key: string]: unknown;
}

// Types pour la configuration Postgres
export interface PostgresConfig {
  effective_cache_size?: string;
  max_connections?: number;
  shared_buffers?: string;
  work_mem?: string;
  maintenance_work_mem?: string;
  checkpoint_timeout?: number;
  wal_buffers?: string;
  default_statistics_target?: number;
  random_page_cost?: number;
  effective_io_concurrency?: number;
  max_worker_processes?: number;
  max_parallel_workers_per_gather?: number;
  max_parallel_workers?: number;
  max_parallel_maintenance_workers?: number;
  [key: string]: unknown;
}

// Types pour la configuration Pooler
export interface PoolerConfig {
  default_pool_size?: number;
  pool_mode?: PoolMode;
  max_client_conn?: number;
  reserve_pool_size?: number;
  reserve_pool_timeout?: number;
  ignore_startup_parameters?: string;
  server_idle_timeout?: number;
  server_lifetime?: number;
  server_connect_timeout?: number;
  server_check_delay?: number;
  server_check_query?: string;
  server_reset_query?: string;
  server_login_retry?: number;
  query_wait_timeout?: number;
  query_timeout?: number;
  client_idle_timeout?: number;
  autodb_idle_timeout?: number;
  dns_max_ttl?: number;
  dns_nxdomain_ttl?: number;
  dns_zone_check_period?: number;
  max_packet_size?: number;
  pkt_buf?: number;
  listen_backlog?: number;
  sbuf_loopcnt?: number;
  suspend_timeout?: number;
  tcp_defer_accept?: number;
  tcp_socket_buffer?: number;
  tcp_keepalive?: boolean;
  tcp_keepcnt?: number;
  tcp_keepidle?: number;
  tcp_keepintvl?: number;
  so_reuseport?: boolean;
  application_name_add_host?: number;
  [key: string]: unknown;
}

// Types pour les backups
export interface Backup {
  is_physical_backup: boolean;
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS";
  inserted_at: string;
}

export interface BackupsResponse {
  region: string;
  walg_enabled: boolean;
  pitr_enabled: boolean;
  backups: Backup[];
  physical_backup_data?: {
    earliest_physical_backup_date_unix: number;
    latest_physical_backup_date_unix: number;
  };
}

// Types pour les migrations
export interface Migration {
  version: string;
  name: string;
}

export interface MigrationDetail extends Migration {
  statements: string[];
  rollback?: string[];
  created_by?: string;
  idempotency_key?: string;
}

// Types pour les advisors
export interface Advisor {
  name: string;
  title: string;
  level: "ERROR" | "WARNING" | "INFO";
  facing: "EXTERNAL" | "INTERNAL";
  categories: string[];
  description: string;
  detail?: string;
  remediation?: string;
  metadata?: Record<string, unknown>;
  cache_key?: string;
}

// Types pour les logs
export interface LogsResponse {
  result: unknown[];
  error?: string;
}

// Types pour les requêtes
export interface CreateBranchRequest {
  branch_name: string;
  git_branch?: string;
  is_default?: boolean;
  persistent?: boolean;
  region?: string;
  desired_instance_size?: string;
  release_channel?: ReleaseChannel;
  postgres_engine?: PostgresEngine;
  secrets?: Record<string, string>;
  with_data?: boolean;
  notify_url?: string;
}

export interface UpdateBranchRequest {
  branch_name?: string;
  git_branch?: string;
  reset_on_push?: boolean;
  persistent?: boolean;
  status?: BranchStatus;
  request_review?: boolean;
  notify_url?: string;
}

export interface MergeBranchRequest {
  migration_version?: string;
}

export interface ResetBranchRequest {
  migration_version?: string;
}

export interface PushBranchRequest {
  migration_version?: string;
}

// Types pour les erreurs
export interface ManagementApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Types pour les réponses paginées
export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
}

export interface ProjectsPaginatedResponse {
  projects: ProjectWithDatabases[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
  };
}

