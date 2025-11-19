/**
 * Client pour l'API Management de Supabase
 * Documentation : https://api.supabase.com/v1
 * 
 * Utilisation :
 * ```ts
 * const client = new SupabaseManagementClient(process.env.SUPABASE_MANAGEMENT_API_TOKEN!);
 * const projects = await client.projects.list();
 * ```
 */

import type {
  Project,
  ProjectRef,
  BranchId,
  FunctionSlug,
  ApiKeyId,
  SecretName,
  DatabaseBranch,
  BranchConfig,
  EdgeFunction,
  Secret,
  ApiKey,
  CreateApiKeyRequest,
  AuthConfig,
  PostgresConfig,
  PoolerConfig,
  BackupsResponse,
  Migration,
  MigrationDetail,
  Advisor,
  LogsResponse,
  CreateBranchRequest,
  UpdateBranchRequest,
  MergeBranchRequest,
  ResetBranchRequest,
  PushBranchRequest,
  ProjectsPaginatedResponse,
  ManagementApiError,
} from "./types";

const MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";

export class SupabaseManagementClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl: string = MANAGEMENT_API_BASE_URL) {
    if (!accessToken) {
      throw new Error("Access token is required for Management API");
    }
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(
        error.message || `Request failed with status ${response.status}`
      );
    }

    // Certaines réponses sont vides (204 No Content)
    if (response.status === 204 || response.status === 201) {
      return {} as T;
    }

    return response.json();
  }

  // ==================== PROJETS ====================

  /**
   * Liste tous les projets
   */
  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/projects");
  }

  /**
   * Récupère un projet spécifique
   */
  async getProject(ref: ProjectRef): Promise<Project> {
    return this.request<Project>(`/projects/${ref}`);
  }

  /**
   * Liste les projets d'une organisation avec pagination
   */
  async listOrganizationProjects(
    organizationSlug: string,
    options?: {
      offset?: number;
      limit?: number;
      search?: string;
      sort?: "name" | "created_at" | "updated_at";
      statuses?: string;
    }
  ): Promise<ProjectsPaginatedResponse> {
    const params = new URLSearchParams();
    if (options?.offset !== undefined) params.append("offset", String(options.offset));
    if (options?.limit !== undefined) params.append("limit", String(options.limit));
    if (options?.search) params.append("search", options.search);
    if (options?.sort) params.append("sort", options.sort);
    if (options?.statuses) params.append("statuses", options.statuses);

    const query = params.toString();
    return this.request<ProjectsPaginatedResponse>(
      `/organizations/${organizationSlug}/projects${query ? `?${query}` : ""}`
    );
  }

  /**
   * Crée un nouveau projet
   */
  async createProject(data: {
    name: string;
    organization_slug: string;
    db_pass: string;
    region?: string;
    desired_instance_size?: string;
    release_channel?: string;
    postgres_engine?: string;
  }): Promise<Project> {
    return this.request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Supprime un projet
   */
  async deleteProject(ref: ProjectRef): Promise<{ id: number; ref: string; name: string }> {
    return this.request(`/projects/${ref}`, { method: "DELETE" });
  }

  /**
   * Met en pause un projet
   */
  async pauseProject(ref: ProjectRef): Promise<void> {
    return this.request(`/projects/${ref}/pause`, { method: "POST" });
  }

  /**
   * Restaure un projet
   */
  async restoreProject(ref: ProjectRef): Promise<void> {
    return this.request(`/projects/${ref}/restore`, { method: "POST" });
  }

  /**
   * Annule la restauration d'un projet
   */
  async cancelProjectRestore(ref: ProjectRef): Promise<void> {
    return this.request(`/projects/${ref}/restore/cancel`, { method: "POST" });
  }

  /**
   * Récupère le statut de santé d'un projet
   */
  async getProjectHealth(
    ref: ProjectRef,
    services: string[],
    timeoutMs?: number
  ): Promise<Array<{ name: string; healthy: boolean; status: string }>> {
    const params = new URLSearchParams();
    services.forEach((s) => params.append("services", s));
    if (timeoutMs) params.append("timeout_ms", String(timeoutMs));

    return this.request(`/projects/${ref}/health?${params.toString()}`);
  }

  // ==================== BRANCHES ====================

  /**
   * Liste toutes les branches d'un projet
   */
  async listBranches(ref: ProjectRef): Promise<DatabaseBranch[]> {
    return this.request<DatabaseBranch[]>(`/projects/${ref}/branches`);
  }

  /**
   * Récupère une branche spécifique
   */
  async getBranch(ref: ProjectRef, name: string): Promise<DatabaseBranch> {
    return this.request<DatabaseBranch>(`/projects/${ref}/branches/${name}`);
  }

  /**
   * Récupère la configuration d'une branche
   */
  async getBranchConfig(branchIdOrRef: BranchId | ProjectRef): Promise<BranchConfig> {
    return this.request<BranchConfig>(`/branches/${branchIdOrRef}`);
  }

  /**
   * Crée une nouvelle branche
   */
  async createBranch(ref: ProjectRef, data: CreateBranchRequest): Promise<DatabaseBranch> {
    return this.request<DatabaseBranch>(`/projects/${ref}/branches`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Met à jour une branche
   */
  async updateBranch(
    branchIdOrRef: BranchId | ProjectRef,
    data: UpdateBranchRequest
  ): Promise<DatabaseBranch> {
    return this.request<DatabaseBranch>(`/branches/${branchIdOrRef}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * Supprime une branche
   */
  async deleteBranch(
    branchIdOrRef: BranchId | ProjectRef,
    force?: boolean
  ): Promise<{ message: string }> {
    const params = force !== undefined ? `?force=${force}` : "";
    return this.request(`/branches/${branchIdOrRef}${params}`, {
      method: "DELETE",
    });
  }

  /**
   * Merge une branche
   */
  async mergeBranch(
    branchIdOrRef: BranchId | ProjectRef,
    data?: MergeBranchRequest
  ): Promise<{ workflow_run_id: string; message: string }> {
    return this.request(`/branches/${branchIdOrRef}/merge`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  /**
   * Reset une branche
   */
  async resetBranch(
    branchIdOrRef: BranchId | ProjectRef,
    data?: ResetBranchRequest
  ): Promise<{ workflow_run_id: string; message: string }> {
    return this.request(`/branches/${branchIdOrRef}/reset`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  /**
   * Push une branche
   */
  async pushBranch(
    branchIdOrRef: BranchId | ProjectRef,
    data?: PushBranchRequest
  ): Promise<{ workflow_run_id: string; message: string }> {
    return this.request(`/branches/${branchIdOrRef}/push`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  /**
   * Restaure une branche supprimée
   */
  async restoreBranch(
    branchIdOrRef: BranchId | ProjectRef
  ): Promise<{ message: string }> {
    return this.request(`/branches/${branchIdOrRef}/restore`, {
      method: "POST",
    });
  }

  // ==================== FONCTIONS EDGE ====================

  /**
   * Liste toutes les fonctions Edge d'un projet
   */
  async listFunctions(ref: ProjectRef): Promise<EdgeFunction[]> {
    return this.request<EdgeFunction[]>(`/projects/${ref}/functions`);
  }

  /**
   * Récupère une fonction Edge spécifique
   */
  async getFunction(ref: ProjectRef, functionSlug: FunctionSlug): Promise<EdgeFunction> {
    return this.request<EdgeFunction>(`/projects/${ref}/functions/${functionSlug}`);
  }

  /**
   * Récupère le corps d'une fonction Edge
   */
  async getFunctionBody(ref: ProjectRef, functionSlug: FunctionSlug): Promise<Blob> {
    const url = `${this.baseUrl}/projects/${ref}/functions/${functionSlug}/body`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch function body: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Déploie une fonction Edge
   */
  async deployFunction(
    ref: ProjectRef,
    file: File | Blob,
    metadata: {
      slug?: string;
      name?: string;
      verify_jwt?: boolean;
      import_map?: boolean;
      entrypoint_path?: string;
      import_map_path?: string;
    },
    bundleOnly?: boolean
  ): Promise<EdgeFunction> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify(metadata));

    const params = new URLSearchParams();
    if (metadata.slug) params.append("slug", metadata.slug);
    if (bundleOnly !== undefined) params.append("bundleOnly", String(bundleOnly));

    const url = `${this.baseUrl}/projects/${ref}/functions/deploy${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.message || `Deploy failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Supprime une fonction Edge
   */
  async deleteFunction(ref: ProjectRef, functionSlug: FunctionSlug): Promise<void> {
    return this.request(`/projects/${ref}/functions/${functionSlug}`, {
      method: "DELETE",
    });
  }

  // ==================== SECRETS ====================

  /**
   * Liste tous les secrets d'un projet
   */
  async listSecrets(ref: ProjectRef): Promise<Secret[]> {
    return this.request<Secret[]>(`/projects/${ref}/secrets`);
  }

  /**
   * Crée plusieurs secrets
   */
  async createSecrets(ref: ProjectRef, secrets: Array<{ name: string; value: string }>): Promise<void> {
    return this.request(`/projects/${ref}/secrets`, {
      method: "POST",
      body: JSON.stringify(secrets),
    });
  }

  /**
   * Supprime plusieurs secrets
   */
  async deleteSecrets(ref: ProjectRef, secretNames: SecretName[]): Promise<void> {
    return this.request(`/projects/${ref}/secrets`, {
      method: "DELETE",
      body: JSON.stringify(secretNames),
    });
  }

  // ==================== CLÉS API ====================

  /**
   * Liste toutes les clés API d'un projet
   */
  async listApiKeys(ref: ProjectRef, reveal?: boolean): Promise<ApiKey[]> {
    const params = reveal !== undefined ? `?reveal=${reveal}` : "";
    return this.request<ApiKey[]>(`/projects/${ref}/api-keys${params}`);
  }

  /**
   * Récupère une clé API spécifique
   */
  async getApiKey(ref: ProjectRef, id: ApiKeyId, reveal?: boolean): Promise<ApiKey> {
    const params = reveal !== undefined ? `?reveal=${reveal}` : "";
    return this.request<ApiKey>(`/projects/${ref}/api-keys/${id}${params}`);
  }

  /**
   * Crée une nouvelle clé API
   */
  async createApiKey(
    ref: ProjectRef,
    data: CreateApiKeyRequest,
    reveal?: boolean
  ): Promise<ApiKey> {
    const params = reveal !== undefined ? `?reveal=${reveal}` : "";
    return this.request<ApiKey>(`/projects/${ref}/api-keys${params}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Met à jour une clé API
   */
  async updateApiKey(
    ref: ProjectRef,
    id: ApiKeyId,
    data: Partial<CreateApiKeyRequest>,
    reveal?: boolean
  ): Promise<ApiKey> {
    const params = reveal !== undefined ? `?reveal=${reveal}` : "";
    return this.request<ApiKey>(`/projects/${ref}/api-keys/${id}${params}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * Supprime une clé API
   */
  async deleteApiKey(
    ref: ProjectRef,
    id: ApiKeyId,
    options?: {
      reveal?: boolean;
      was_compromised?: boolean;
      reason?: string;
    }
  ): Promise<ApiKey> {
    const params = new URLSearchParams();
    if (options?.reveal !== undefined) params.append("reveal", String(options.reveal));
    if (options?.was_compromised !== undefined) params.append("was_compromised", String(options.was_compromised));
    if (options?.reason) params.append("reason", options.reason);

    const query = params.toString();
    return this.request<ApiKey>(
      `/projects/${ref}/api-keys/${id}${query ? `?${query}` : ""}`,
      { method: "DELETE" }
    );
  }

  // ==================== CONFIGURATION AUTH ====================

  /**
   * Récupère la configuration Auth d'un projet
   */
  async getAuthConfig(ref: ProjectRef): Promise<AuthConfig> {
    return this.request<AuthConfig>(`/projects/${ref}/config/auth`);
  }

  /**
   * Met à jour la configuration Auth d'un projet
   */
  async updateAuthConfig(ref: ProjectRef, config: Partial<AuthConfig>): Promise<AuthConfig> {
    return this.request<AuthConfig>(`/projects/${ref}/config/auth`, {
      method: "PATCH",
      body: JSON.stringify(config),
    });
  }

  // ==================== CONFIGURATION POSTGRES ====================

  /**
   * Récupère la configuration Postgres d'un projet
   */
  async getPostgresConfig(ref: ProjectRef): Promise<PostgresConfig> {
    return this.request<PostgresConfig>(`/projects/${ref}/config/database/postgres`);
  }

  /**
   * Met à jour la configuration Postgres d'un projet
   */
  async updatePostgresConfig(
    ref: ProjectRef,
    config: Partial<PostgresConfig>
  ): Promise<PostgresConfig> {
    return this.request<PostgresConfig>(`/projects/${ref}/config/database/postgres`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  // ==================== CONFIGURATION POOLER ====================

  /**
   * Récupère la configuration Pooler d'un projet
   */
  async getPoolerConfig(ref: ProjectRef): Promise<PoolerConfig[]> {
    return this.request<PoolerConfig[]>(`/projects/${ref}/config/database/pooler`);
  }

  /**
   * Met à jour la configuration Pooler d'un projet
   */
  async updatePoolerConfig(
    ref: ProjectRef,
    config: Partial<PoolerConfig>
  ): Promise<PoolerConfig> {
    return this.request<PoolerConfig>(`/projects/${ref}/config/database/pooler`, {
      method: "PATCH",
      body: JSON.stringify(config),
    });
  }

  // ==================== BACKUPS ====================

  /**
   * Liste tous les backups d'un projet
   */
  async listBackups(ref: ProjectRef): Promise<BackupsResponse> {
    return this.request<BackupsResponse>(`/projects/${ref}/database/backups`);
  }

  /**
   * Restaure un backup PITR
   */
  async restorePitrBackup(
    ref: ProjectRef,
    recoveryTimeTargetUnix: number
  ): Promise<void> {
    return this.request(`/projects/${ref}/database/backups/restore-pitr`, {
      method: "POST",
      body: JSON.stringify({ recovery_time_target_unix: recoveryTimeTargetUnix }),
    });
  }

  // ==================== MIGRATIONS ====================

  /**
   * Liste toutes les migrations appliquées
   */
  async listMigrations(ref: ProjectRef): Promise<Migration[]> {
    return this.request<Migration[]>(`/projects/${ref}/database/migrations`);
  }

  /**
   * Récupère une migration spécifique
   */
  async getMigration(ref: ProjectRef, version: string): Promise<MigrationDetail> {
    return this.request<MigrationDetail>(
      `/projects/${ref}/database/migrations/${version}`
    );
  }

  /**
   * Applique une migration
   */
  async applyMigration(
    ref: ProjectRef,
    query: string,
    name?: string,
    rollback?: string
  ): Promise<void> {
    return this.request(`/projects/${ref}/database/migrations`, {
      method: "POST",
      body: JSON.stringify({ query, name, rollback }),
    });
  }

  // ==================== ADVISORS ====================

  /**
   * Récupère les advisors de performance (déprécié)
   */
  async getPerformanceAdvisors(ref: ProjectRef): Promise<{ lints: Advisor[] }> {
    return this.request<{ lints: Advisor[] }>(
      `/projects/${ref}/advisors/performance`
    );
  }

  /**
   * Récupère les advisors de sécurité (déprécié)
   */
  async getSecurityAdvisors(
    ref: ProjectRef,
    lintType?: string
  ): Promise<{ lints: Advisor[] }> {
    const params = lintType ? `?lint_type=${lintType}` : "";
    return this.request<{ lints: Advisor[] }>(
      `/projects/${ref}/advisors/security${params}`
    );
  }

  // ==================== LOGS ====================

  /**
   * Récupère les logs d'un projet
   */
  async getLogs(
    ref: ProjectRef,
    options?: {
      sql?: string;
      iso_timestamp_start?: string;
      iso_timestamp_end?: string;
    }
  ): Promise<LogsResponse> {
    const params = new URLSearchParams();
    if (options?.sql) params.append("sql", options.sql);
    if (options?.iso_timestamp_start) params.append("iso_timestamp_start", options.iso_timestamp_start);
    if (options?.iso_timestamp_end) params.append("iso_timestamp_end", options.iso_timestamp_end);

    const query = params.toString();
    return this.request<LogsResponse>(
      `/projects/${ref}/analytics/endpoints/logs.all${query ? `?${query}` : ""}`
    );
  }

  // ==================== TYPES TYPESCRIPT ====================

  /**
   * Génère les types TypeScript pour un projet
   */
  async generateTypeScriptTypes(
    ref: ProjectRef,
    includedSchemas?: string
  ): Promise<{ types: string }> {
    const params = includedSchemas ? `?included_schemas=${includedSchemas}` : "";
    return this.request<{ types: string }>(
      `/projects/${ref}/types/typescript${params}`
    );
  }
}

