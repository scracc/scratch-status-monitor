import { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ApiConnectionConfig } from "@/lib/connection-config";
import type { ManagedToken } from "@/lib/token-api";
import { revokeManagedTokenById } from "@/lib/token-api";

interface TokenListProps {
  tokens: ManagedToken[];
  config: ApiConnectionConfig;
  onRefresh: () => void;
}

export const TokenList = memo(function TokenList({ tokens, config, onRefresh }: TokenListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = useCallback(
    async (tokenId: string) => {
      if (!window.confirm("このトークンを失効させてもよろしいですか？")) {
        return;
      }

      setRevokingId(tokenId);
      try {
        await revokeManagedTokenById({
          data: {
            baseUrl: config.baseUrl,
            bearerToken: config.bearerToken,
            tokenId,
          },
        });
        onRefresh();
      } catch (error) {
        console.error("Failed to revoke token:", error);
        alert("トークンの失効に失敗しました");
      } finally {
        setRevokingId(null);
      }
    },
    [config.baseUrl, config.bearerToken, onRefresh]
  );

  if (tokens.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">トークンがまだありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <div key={token.id} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold">{token.name}</h3>
              <p className="text-sm text-muted-foreground">ID: {token.id}</p>
            </div>
            <div className="ml-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRevoke(token.id)}
                disabled={revokingId === token.id}
              >
                {revokingId === token.id ? "処理中..." : "失効"}
              </Button>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ステータス:</span>
              <span className={token.isActive ? "text-green-600" : "text-red-600"}>
                {token.isActive ? "有効" : "無効"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">管理権限:</span>
              <span>{token.isAdmin ? "あり" : "なし"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">レート制限:</span>
              <span>{token.rateLimitPerMinute} req/min</span>
            </div>
            {token.lastUsedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">最終使用:</span>
                <span>{new Date(token.lastUsedAt).toLocaleString("ja-JP")}</span>
              </div>
            )}
            {token.expiresAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">有効期限:</span>
                <span>{new Date(token.expiresAt).toLocaleString("ja-JP")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">作成日:</span>
              <span>{new Date(token.createdAt).toLocaleString("ja-JP")}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
