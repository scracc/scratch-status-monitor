import { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TokenCreatedDialogProps {
  token: string;
  onClose: () => void;
}

export const TokenCreatedDialog = memo(function TokenCreatedDialog({
  token,
  onClose,
}: TokenCreatedDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy token:", error);
    }
  }, [token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">トークンが作成されました</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          このトークンは今後表示されません。安全な場所に保存してください。
        </p>

        <div className="mb-4 space-y-2">
          <Label htmlFor="token-display" className="text-xs">
            トークン（この画面でのみ表示）
          </Label>
          <div className="flex gap-2">
            <Input
              id="token-display"
              type="text"
              value={token}
              readOnly
              className="font-mono text-xs"
            />
            <Button size="sm" onClick={handleCopy}>
              {copied ? "コピー済み" : "コピー"}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose}>
            了解
          </Button>
        </div>
      </div>
    </div>
  );
});
