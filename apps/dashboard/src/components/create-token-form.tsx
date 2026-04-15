import { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ApiConnectionConfig } from "@/lib/connection-config";
import type { CreateManagedTokenInput } from "@/lib/token-api";
import { createManagedToken } from "@/lib/token-api";

interface CreateTokenFormProps {
  config: ApiConnectionConfig;
  onSuccess: (token: string) => void;
  onError: (error: Error) => void;
}

export const CreateTokenForm = memo(function CreateTokenForm({
  config,
  onSuccess,
  onError,
}: CreateTokenFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState("1000");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        const input: CreateManagedTokenInput = {
          name,
          isAdmin,
          rateLimitPerMinute: parseInt(rateLimitPerMinute, 10),
        };

        const result = await createManagedToken({
          data: {
            baseUrl: config.baseUrl,
            bearerToken: config.bearerToken,
            input,
          },
        });
        onSuccess(result.token);

        // フォームをリセット
        setName("");
        setIsAdmin(false);
        setRateLimitPerMinute("1000");
        setIsOpen(false);
      } catch (error) {
        onError(error instanceof Error ? error : new Error("不明なエラー"));
      } finally {
        setIsLoading(false);
      }
    },
    [config.baseUrl, config.bearerToken, isAdmin, name, onError, onSuccess, rateLimitPerMinute]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!isOpen) {
    return <Button onClick={handleOpen}>新しいトークンを作成</Button>;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">新しいトークンを作成</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token-name">トークン名</Label>
          <Input
            id="token-name"
            placeholder="例: Dashboard用トークン"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate-limit">レート制限 (req/min)</Label>
          <Input
            id="rate-limit"
            type="number"
            placeholder="1000"
            value={rateLimitPerMinute}
            onChange={(e) => setRateLimitPerMinute(e.target.value)}
            min="1"
            max="60000"
            required
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is-admin"
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="is-admin" className="mb-0 cursor-pointer">
            管理権限を付与
          </Label>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading || !name.trim()}>
            {isLoading ? "作成中..." : "作成"}
          </Button>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
});
