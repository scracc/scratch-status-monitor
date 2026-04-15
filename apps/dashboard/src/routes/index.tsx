"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectionSetupPanel } from "@/components/connection-setup-panel";
import { CreateTokenForm } from "@/components/create-token-form";
import { TokenCreatedDialog } from "@/components/token-created-dialog";
import { TokenList } from "@/components/token-list";
import { Button } from "@/components/ui/button";
import type { ApiConnectionConfig } from "@/lib/connection-config";
import { loadConnectionConfig, onConnectionConfigChanged } from "@/lib/connection-config";
import type { ManagedToken } from "@/lib/token-api";
import { listManagedTokens } from "@/lib/token-api";

export const Route = createFileRoute("/")({ component: TokenManagementPage });

function TokenManagementPage() {
  const [config, setConfig] = useState<ApiConnectionConfig | null>(null);
  const [tokens, setTokens] = useState<ManagedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [isConnectionEditorOpen, setIsConnectionEditorOpen] = useState(false);

  // 設定の読み込み
  useEffect(() => {
    const savedConfig = loadConnectionConfig();
    setConfig(savedConfig);

    return onConnectionConfigChanged(() => {
      const nextConfig = loadConnectionConfig();
      setConfig(nextConfig);
      if (!nextConfig) {
        setTokens([]);
      }
    });
  }, []);

  // トークン一覧の取得
  const fetchTokens = useCallback(async () => {
    if (!config) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedTokens = await listManagedTokens({
        data: {
          baseUrl: config.baseUrl,
          bearerToken: config.bearerToken,
        },
      });
      setTokens(fetchedTokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
      setError(message);
      console.error("Failed to fetch tokens:", err);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // 設定変更時にトークンを再取得
  useEffect(() => {
    if (config) {
      fetchTokens();
    }
  }, [config, fetchTokens]);

  const handleConfigured = useCallback(() => {
    const savedConfig = loadConnectionConfig();
    setConfig(savedConfig);
    setIsConnectionEditorOpen(false);
  }, []);

  const handleTokenCreated = useCallback(
    (token: string) => {
      setCreatedToken(token);
      fetchTokens();
    },
    [fetchTokens]
  );

  const handleTokenCreationError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  const maskedToken = useMemo(() => {
    if (!config) {
      return null;
    }
    return `${config.bearerToken.substring(0, 10)}...${config.bearerToken.substring(
      config.bearerToken.length - 10
    )}`;
  }, [config]);

  const handleCreatedDialogClose = useCallback(() => {
    setCreatedToken(null);
  }, []);

  const handleOpenConnectionEditor = useCallback(() => {
    setIsConnectionEditorOpen((prev) => !prev);
  }, []);

  return (
    <main className="w-full flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">トークン管理</h1>
          <p className="mt-2 text-muted-foreground">
            Scratch Status Monitor API のトークンを管理します
          </p>
        </div>

        {!config ? (
          <ConnectionSetupPanel onConfigured={handleConfigured} />
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">トークン一覧</h2>
                <CreateTokenForm
                  config={config}
                  onSuccess={handleTokenCreated}
                  onError={handleTokenCreationError}
                />
              </div>

              {isLoading ? (
                <div className="text-center text-muted-foreground">読み込み中...</div>
              ) : (
                <TokenList tokens={tokens} config={config} onRefresh={fetchTokens} />
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">接続情報</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenConnectionEditor}
                >
                  {isConnectionEditorOpen ? "閉じる" : "接続ユーザーを追加/編集"}
                </Button>
              </div>
              <div className="space-y-1 font-mono text-xs text-muted-foreground">
                <p>ユーザー: {config.name ?? "未設定"}</p>
                <p>ベースURL: {config.baseUrl}</p>
                <p>トークン: {maskedToken}</p>
              </div>
            </div>

            {isConnectionEditorOpen && <ConnectionSetupPanel onConfigured={handleConfigured} />}
          </div>
        )}
      </div>

      {createdToken && (
        <TokenCreatedDialog token={createdToken} onClose={handleCreatedDialogClose} />
      )}
    </main>
  );
}
