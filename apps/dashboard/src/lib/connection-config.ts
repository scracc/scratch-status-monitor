/**
 * ローカルストレージを使用した接続設定の管理
 */

const BASE_URL_KEY = "ssm_api_base_url";
const BEARER_TOKEN_KEY = "ssm_api_bearer_token";
const USERS_KEY = "ssm_connection_users";
const ACTIVE_USER_ID_KEY = "ssm_active_connection_user_id";
const CONNECTION_CHANGED_EVENT = "ssm:connection-config-changed";

interface StoredConnectionUser {
  id: string;
  name: string;
  avatar?: string;
  baseUrl: string;
  bearerToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConnectionConfig {
  id?: string;
  name?: string;
  avatar?: string;
  baseUrl: string;
  bearerToken: string;
}

export interface ConnectionUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  baseUrl: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitConnectionChanged(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(CONNECTION_CHANGED_EVENT));
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function guessUserName(baseUrl: string): string {
  try {
    const hostname = new URL(baseUrl).hostname;
    return `API @ ${hostname}`;
  } catch {
    return "接続ユーザー";
  }
}

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "user@local";
  }

  return `token-${token.slice(0, 4)}...${token.slice(-4)}`;
}

function defaultAvatar(name: string): string {
  return `/avatars/${encodeURIComponent(name)}.png`;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readUsers(): StoredConnectionUser[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is StoredConnectionUser => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.baseUrl === "string" &&
        typeof item.bearerToken === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.updatedAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeUsers(users: StoredConnectionUser[]): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getActiveUserId(): string | null {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(ACTIVE_USER_ID_KEY);
}

function setActiveUserId(userId: string | null): void {
  if (!isBrowser()) {
    return;
  }

  if (!userId) {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
}

function toConfig(user: StoredConnectionUser): ApiConnectionConfig {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    baseUrl: user.baseUrl,
    bearerToken: user.bearerToken,
  };
}

function toConnectionUser(user: StoredConnectionUser): ConnectionUser {
  return {
    id: user.id,
    name: user.name,
    email: maskToken(user.bearerToken),
    avatar: user.avatar ?? defaultAvatar(user.name),
    baseUrl: user.baseUrl,
  };
}

function migrateLegacyConfigIfNeeded(): void {
  if (!isBrowser()) {
    return;
  }

  const users = readUsers();
  if (users.length > 0) {
    return;
  }

  const legacyBaseUrl = localStorage.getItem(BASE_URL_KEY);
  const legacyBearerToken = localStorage.getItem(BEARER_TOKEN_KEY);
  if (!legacyBaseUrl || !legacyBearerToken) {
    return;
  }

  const now = new Date().toISOString();
  const migratedUser: StoredConnectionUser = {
    id: generateId(),
    name: guessUserName(legacyBaseUrl),
    baseUrl: normalizeBaseUrl(legacyBaseUrl),
    bearerToken: legacyBearerToken,
    createdAt: now,
    updatedAt: now,
  };

  writeUsers([migratedUser]);
  setActiveUserId(migratedUser.id);
}

export function loadConnectionConfig(): ApiConnectionConfig | null {
  if (!isBrowser()) {
    return null;
  }

  migrateLegacyConfigIfNeeded();

  const users = readUsers();
  if (users.length === 0) {
    return null;
  }

  const activeUserId = getActiveUserId();
  const activeUser = users.find((user) => user.id === activeUserId) ?? users[0];

  if (!activeUser) {
    return null;
  }

  if (activeUserId !== activeUser.id) {
    setActiveUserId(activeUser.id);
  }

  return toConfig(activeUser);
}

export function saveConnectionConfig(config: ApiConnectionConfig): ApiConnectionConfig {
  if (!isBrowser()) {
    return config;
  }

  migrateLegacyConfigIfNeeded();

  const users = readUsers();
  const now = new Date().toISOString();
  const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
  const activeUserId = getActiveUserId();

  const targetId =
    config.id ?? activeUserId ?? users.find((user) => user.baseUrl === normalizedBaseUrl)?.id;

  const targetIndex = targetId ? users.findIndex((user) => user.id === targetId) : -1;
  let savedUser: StoredConnectionUser;

  if (targetIndex >= 0) {
    const current = users[targetIndex];
    savedUser = {
      ...current,
      name: config.name?.trim() || current.name,
      avatar: config.avatar ?? current.avatar,
      baseUrl: normalizedBaseUrl,
      bearerToken: config.bearerToken,
      updatedAt: now,
    };
    users[targetIndex] = savedUser;
  } else {
    savedUser = {
      id: config.id ?? generateId(),
      name: config.name?.trim() || guessUserName(normalizedBaseUrl),
      avatar: config.avatar,
      baseUrl: normalizedBaseUrl,
      bearerToken: config.bearerToken,
      createdAt: now,
      updatedAt: now,
    };
    users.unshift(savedUser);
  }

  writeUsers(users);
  setActiveUserId(savedUser.id);

  // 互換性維持: 旧キーにも現在の接続を保持
  localStorage.setItem(BASE_URL_KEY, savedUser.baseUrl);
  localStorage.setItem(BEARER_TOKEN_KEY, savedUser.bearerToken);

  emitConnectionChanged();
  return toConfig(savedUser);
}

export function saveConnectionConfigAsNew(config: ApiConnectionConfig): ApiConnectionConfig {
  if (!isBrowser()) {
    return config;
  }

  const now = new Date().toISOString();
  const users = readUsers();
  const savedUser: StoredConnectionUser = {
    id: generateId(),
    name: config.name?.trim() || guessUserName(config.baseUrl),
    avatar: config.avatar,
    baseUrl: normalizeBaseUrl(config.baseUrl),
    bearerToken: config.bearerToken,
    createdAt: now,
    updatedAt: now,
  };

  users.unshift(savedUser);
  writeUsers(users);
  setActiveUserId(savedUser.id);
  localStorage.setItem(BASE_URL_KEY, savedUser.baseUrl);
  localStorage.setItem(BEARER_TOKEN_KEY, savedUser.bearerToken);

  emitConnectionChanged();
  return toConfig(savedUser);
}

export function loadConnectionUsers(): ConnectionUser[] {
  if (!isBrowser()) {
    return [];
  }

  migrateLegacyConfigIfNeeded();
  return readUsers()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toConnectionUser);
}

export function setActiveConnectionUser(userId: string): void {
  if (!isBrowser()) {
    return;
  }

  const users = readUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) {
    return;
  }

  setActiveUserId(target.id);
  localStorage.setItem(BASE_URL_KEY, target.baseUrl);
  localStorage.setItem(BEARER_TOKEN_KEY, target.bearerToken);
  emitConnectionChanged();
}

export function clearConnectionConfig(): void {
  if (!isBrowser()) {
    return;
  }

  const users = readUsers();
  const activeUserId = getActiveUserId();
  const remainingUsers = activeUserId ? users.filter((user) => user.id !== activeUserId) : users;

  writeUsers(remainingUsers);
  const nextActive = remainingUsers[0] ?? null;
  setActiveUserId(nextActive?.id ?? null);

  if (nextActive) {
    localStorage.setItem(BASE_URL_KEY, nextActive.baseUrl);
    localStorage.setItem(BEARER_TOKEN_KEY, nextActive.bearerToken);
  } else {
    localStorage.removeItem(BASE_URL_KEY);
    localStorage.removeItem(BEARER_TOKEN_KEY);
  }

  emitConnectionChanged();
}

export function getActiveConnectionUserId(): string | null {
  if (!isBrowser()) {
    return null;
  }

  migrateLegacyConfigIfNeeded();
  return getActiveUserId();
}

export function onConnectionConfigChanged(listener: () => void): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(CONNECTION_CHANGED_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(CONNECTION_CHANGED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function isConfigured(): boolean {
  return loadConnectionConfig() !== null;
}

export function removeConnectionUser(userId: string): void {
  if (!isBrowser()) {
    return;
  }

  const users = readUsers();
  const remaining = users.filter((user) => user.id !== userId);
  writeUsers(remaining);

  const activeUserId = getActiveUserId();
  if (activeUserId === userId) {
    const next = remaining[0] ?? null;
    setActiveUserId(next?.id ?? null);
    if (next) {
      localStorage.setItem(BASE_URL_KEY, next.baseUrl);
      localStorage.setItem(BEARER_TOKEN_KEY, next.bearerToken);
    } else {
      localStorage.removeItem(BASE_URL_KEY);
      localStorage.removeItem(BEARER_TOKEN_KEY);
    }
  }

  emitConnectionChanged();
}

// 旧実装との互換性維持
export function legacyClearStorageOnly(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(BASE_URL_KEY);
  localStorage.removeItem(BEARER_TOKEN_KEY);
}
