import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  clearConnectionConfig,
  loadConnectionConfig,
  saveConnectionConfig,
} from "@/lib/connection-config";

interface ConnectionSetupPanelProps {
  onConfigured?: () => void;
}

export const ConnectionSetupPanel = memo(function ConnectionSetupPanel({
  onConfigured,
}: ConnectionSetupPanelProps) {
  const [baseUrl, setBaseUrl] = useState(() => loadConnectionConfig()?.baseUrl ?? "");
  const [bearerToken, setBearerToken] = useState(() => loadConnectionConfig()?.bearerToken ?? "");
  const [hasSavedConfig, setHasSavedConfig] = useState(() => loadConnectionConfig() !== null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      saveConnectionConfig({ baseUrl, bearerToken });
      setHasSavedConfig(true);
      onConfigured?.();
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, bearerToken, onConfigured]);

  const handleClear = useCallback(() => {
    clearConnectionConfig();
    setBaseUrl("");
    setBearerToken("");
    setHasSavedConfig(false);
  }, []);

  const isValid = useMemo(
    () => baseUrl.trim().length > 0 && bearerToken.trim().length > 0,
    [baseUrl, bearerToken]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">API 接続設定</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="base-url">API ベースURL</Label>
          <Input
            id="base-url"
            placeholder="https://api.ssm.scra.cc"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bearer-token">管理トークン</Label>
          <Input
            id="bearer-token"
            type="password"
            placeholder="あなたの管理トークン"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
          />
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={isSaving}>
            クリア
          </Button>
        </div>

        {hasSavedConfig && (
          <p className="text-sm text-muted-foreground">✓ 接続設定が保存されています</p>
        )}
      </div>
    </div>
  );
});
