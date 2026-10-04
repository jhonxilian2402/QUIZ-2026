import { apiClient } from "./client";
import type {
  AIModelCatalogResponse,
  AIProviderStatusResponse,
  ConversationResponse,
  MessageResponse,
  Page,
  ProviderResponse,
  QuizAnswerResponse,
  QuizAttemptResponse,
  QuizGenerationInfo,
  QuizQuestionResponse,
  QuizResponse,
  SessionResponse,
  UploadedFileResponse,
  UserResponse,
  UserSettings,
} from "./contracts";
import type { QuizCreateInput, SettingsPatchInput } from "./schemas";

/**
 * Typed frontend services.
 *
 * React components call these instead of constructing HTTP requests, so endpoint
 * paths and payload shapes live in one place and are checked against the shared
 * contracts.
 */

export const authService = {
  session: (signal?: AbortSignal) =>
    apiClient.get<SessionResponse>("/api/auth/session", { signal }),

  register: (input: { email: string; password: string; displayName: string }) =>
    apiClient.post<SessionResponse>("/api/auth/register", input),

  login: (input: { email: string; password: string }) =>
    apiClient.post<SessionResponse>("/api/auth/login", input),

  logout: () => apiClient.post<SessionResponse>("/api/auth/logout"),

  requestPasswordReset: (email: string) =>
    apiClient.post<{ message: string }>("/api/auth/password-reset", { email }),

  confirmPasswordReset: (token: string, password: string) =>
    apiClient.post<{ message: string }>("/api/auth/password-reset/confirm", {
      token,
      password,
    }),
};

export const userService = {
  me: (signal?: AbortSignal) => apiClient.get<UserResponse>("/api/me", { signal }),

  updateProfile: (input: {
    displayName?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string | null;
  }) => apiClient.patch<UserResponse>("/api/me", input),
};

export const settingsService = {
  get: (signal?: AbortSignal) =>
    apiClient.get<UserSettings>("/api/settings", { signal }),

  update: (patch: SettingsPatchInput) =>
    apiClient.patch<UserSettings>("/api/settings", patch),

  reset: () => apiClient.post<UserSettings>("/api/settings/reset"),
};

export const conversationService = {
  list: (query?: { limit?: number; cursor?: string; search?: string }, signal?: AbortSignal) =>
    apiClient.get<Page<ConversationResponse>>("/api/conversations", { query, signal }),

  create: (input?: { title?: string; model?: string | null }) =>
    apiClient.post<ConversationResponse>("/api/conversations", input ?? {}),

  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<ConversationResponse>(`/api/conversations/${id}`, { signal }),

  update: (id: string, input: { title?: string; archived?: boolean }) =>
    apiClient.patch<ConversationResponse>(`/api/conversations/${id}`, input),

  remove: (id: string) => apiClient.delete<void>(`/api/conversations/${id}`),

  messages: (id: string, query?: { limit?: number; cursor?: string }, signal?: AbortSignal) =>
    apiClient.get<Page<MessageResponse>>(`/api/conversations/${id}/messages`, {
      query,
      signal,
    }),

  sendMessage: (id: string, input: { role?: "user" | "assistant" | "system"; content: string }) =>
    apiClient.post<MessageResponse>(`/api/conversations/${id}/messages`, input),
};

export const quizService = {
  list: (query?: { limit?: number; cursor?: string; search?: string }, signal?: AbortSignal) =>
    apiClient.get<Page<QuizResponse>>("/api/quizzes", { query, signal }),

  create: (payload: QuizCreateInput) =>
    apiClient.post<{
      quiz: QuizResponse;
      questions: QuizQuestionResponse[];
      generation: QuizGenerationInfo;
    }>("/api/quizzes", payload),

  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<{ quiz: QuizResponse; questions: QuizQuestionResponse[] }>(
      `/api/quizzes/${id}`,
      { signal }
    ),

  update: (id: string, payload: Partial<QuizCreateInput>) =>
    apiClient.patch<QuizResponse>(`/api/quizzes/${id}`, payload),

  remove: (id: string) => apiClient.delete<void>(`/api/quizzes/${id}`),

  startAttempt: (id: string) =>
    apiClient.post<QuizAttemptResponse>(`/api/quizzes/${id}/attempts`),

  listAttempts: (id: string, signal?: AbortSignal) =>
    apiClient.get<Page<QuizAttemptResponse>>(`/api/quizzes/${id}/attempts`, { signal }),

  getAttempt: (attemptId: string, signal?: AbortSignal) =>
    apiClient.get<{
      attempt: QuizAttemptResponse;
      answers: QuizAnswerResponse[];
      questions: QuizQuestionResponse[];
    }>(`/api/attempts/${attemptId}`, { signal }),

  submitAnswer: (
    attemptId: string,
    questionId: string,
    selectedAnswer: string | null
  ) =>
    apiClient.post<QuizAnswerResponse>(`/api/attempts/${attemptId}/answers`, {
      questionId,
      selectedAnswer,
    }),

  completeAttempt: (attemptId: string) =>
    apiClient.post<QuizAttemptResponse>(`/api/attempts/${attemptId}/complete`),
};

export const fileService = {
  list: (query?: { limit?: number; cursor?: string }, signal?: AbortSignal) =>
    apiClient.get<Page<UploadedFileResponse>>("/api/files", { query, signal }),

  register: (input: { filename: string; mimeType: string; size: number }) =>
    apiClient.post<{
      file: UploadedFileResponse;
      storage: { provider: string; durable: boolean; reason: string };
      processing: { connected: boolean; reason: string };
    }>("/api/files", input),

  upload: (file: File, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.postForm<{ file: UploadedFileResponse }>("/api/files", form, { signal });
  },

  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<{ file: UploadedFileResponse }>(`/api/files/${id}`, { signal }),

  content: (id: string, query?: { offset?: number; limit?: number }, signal?: AbortSignal) =>
    apiClient.get<{ fileId: string; text: string; offset: number; total: number }>(
      `/api/files/${id}/content`,
      { query, signal }
    ),

  retry: (id: string) =>
    apiClient.post<{ file: UploadedFileResponse }>(`/api/files/${id}/retry`),

  search: (input: { query: string; fileIds?: string[]; limit?: number }) =>
    apiClient.post<{
      results: Array<{
        fileId: string;
        filename: string;
        page: number | null;
        position: number;
        content: string;
        rank: number;
      }>;
    }>("/api/files/search", input),

  remove: (id: string) => apiClient.delete<void>(`/api/files/${id}`),
};

export const providerService = {
  list: (signal?: AbortSignal) =>
    apiClient.get<ProviderResponse[]>("/api/providers", { signal }),

  get: (provider: string, signal?: AbortSignal) =>
    apiClient.get<ProviderResponse>(`/api/providers/${provider}`, { signal }),

  configure: (
    provider: string,
    input: { credential?: string; defaultModel?: string | null; enabled?: boolean }
  ) => apiClient.post<ProviderResponse>(`/api/providers/${provider}`, input),

  test: (provider: string) =>
    apiClient.post<{ ok: boolean; message: string }>(
      `/api/providers/${provider}/configure`,
      undefined,
      { query: { action: "test" } }
    ),

  disconnect: (provider: string) =>
    apiClient.delete<void>(`/api/providers/${provider}`),
};

export const healthService = {
  check: (signal?: AbortSignal) =>
    apiClient.get<{ status: string; database: string }>("/api/health", { signal }),
};

/**
 * AI catalog service. The frontend asks the application API for models; it
 * never knows which provider supplies them or how the catalog is fetched.
 */
export const aiService = {
  models: (
    query?: {
      freeOnly?: boolean;
      vision?: boolean;
      streaming?: boolean;
      toolCalling?: boolean;
      structuredOutput?: boolean;
      minContext?: number;
    },
    signal?: AbortSignal
  ) => apiClient.get<AIModelCatalogResponse>("/api/ai/models", { query, signal }),

  refreshModels: () =>
    apiClient.post<AIModelCatalogResponse>("/api/ai/models/refresh"),

  providerStatus: (signal?: AbortSignal) =>
    apiClient.get<AIProviderStatusResponse>("/api/ai/providers/status", { signal }),
};