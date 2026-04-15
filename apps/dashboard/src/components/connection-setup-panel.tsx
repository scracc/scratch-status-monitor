import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  clearConnectionConfig,
  loadConnectionConfig,
  saveConnectionConfig,
  saveConnectionConfigAsNew,
} from "@/lib/connection-config";

interface ConnectionSetupPanelProps {
  onConfigured?: () => void;
}

export const ConnectionSetupPanel = memo(function ConnectionSetupPanel({
  onConfigured,
}: ConnectionSetupPanelProps) {
  const [profileId, setProfileId] = useState(() => loadConnectionConfig()?.id ?? null);
  const [profileName, setProfileName] = useState(
    () => loadConnectionConfig()?.name ?? "接続ユーザー"
  );
  const [baseUrl, setBaseUrl] = useState(() => loadConnectionConfig()?.baseUrl ?? "");
  const [bearerToken, setBearerToken] = useState(() => loadConnectionConfig()?.bearerToken ?? "");
  const [hasSavedConfig, setHasSavedConfig] = useState(() => loadConnectionConfig() !== null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = saveConnectionConfig({
        id: profileId ?? undefined,
        name: profileName,
        baseUrl,
        bearerToken,
      });

      setProfileId(saved.id ?? null);
      setProfileName(saved.name ?? profileName);
      setBaseUrl(saved.baseUrl);
      setBearerToken(saved.bearerToken);
      setHasSavedConfig(true);
      onConfigured?.();
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, bearerToken, onConfigured, profileId, profileName]);

  const handleSaveAsNew = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = saveConnectionConfigAsNew({
        name: profileName,
        baseUrl,
        bearerToken,
      });

      setProfileId(saved.id ?? null);
      setProfileName(saved.name ?? profileName);
      setBaseUrl(saved.baseUrl);
      setBearerToken(saved.bearerToken);
      setHasSavedConfig(true);
      onConfigured?.();
    } finally {
      setIsSaving(false);
    }
  }, [baseUrl, bearerToken, onConfigured, profileName]);

  const handleClear = useCallback(() => {
    clearConnectionConfig();
    const nextConfig = loadConnectionConfig();

    setProfileId(nextConfig?.id ?? null);
    setProfileName(nextConfig?.name ?? "接続ユーザー");
    setBaseUrl(nextConfig?.baseUrl ?? "");
    setBearerToken(nextConfig?.bearerToken ?? "");
    setHasSavedConfig(nextConfig !== null);
    onConfigured?.();
  }, []);

  const isValid = useMemo(
    () =>
      profileName.trim().length > 0 && baseUrl.trim().length > 0 && bearerToken.trim().length > 0,
    [baseUrl, bearerToken, profileName]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">API 接続設定</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="connection-user-name">接続ユーザー名</Label>
          <Input
            id="connection-user-name"
            placeholder="例: Production API"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
        </div>

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
          <Button variant="secondary" onClick={handleSaveAsNew} disabled={!isValid || isSaving}>
            新規ユーザー保存
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
