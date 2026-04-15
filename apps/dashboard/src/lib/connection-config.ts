/**
 * ローカルストレージを使用した接続設定の管理
 */

const BASE_URL_KEY = "ssm_api_base_url";
const BEARER_TOKEN_KEY = "ssm_api_bearer_token";

export interface ApiConnectionConfig {
  baseUrl: string;
  bearerToken: string;
}

export function loadConnectionConfig(): ApiConnectionConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const baseUrl = localStorage.getItem(BASE_URL_KEY);
  const bearerToken = localStorage.getItem(BEARER_TOKEN_KEY);

  if (!baseUrl || !bearerToken) {
    return null;
  }

  return { baseUrl, bearerToken };
}

export function saveConnectionConfig(config: ApiConnectionConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(BASE_URL_KEY, config.baseUrl);
  localStorage.setItem(BEARER_TOKEN_KEY, config.bearerToken);
}

export function clearConnectionConfig(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(BASE_URL_KEY);
  localStorage.removeItem(BEARER_TOKEN_KEY);
}

export function isConfigured(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(localStorage.getItem(BASE_URL_KEY) && localStorage.getItem(BEARER_TOKEN_KEY));
}
