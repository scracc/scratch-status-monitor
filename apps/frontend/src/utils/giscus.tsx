import Giscus from "@giscus/react";
import { useTheme } from "next-themes";
import { useLocale } from "react-intlayer";

export function GiscusWidget() {
  const { locale } = useLocale();
  const { theme: _theme, systemTheme } = useTheme();

  const theme = _theme === "system" ? systemTheme : _theme;

  return (
    <div className="mt-10">
      <div className="relative max-h-[1500px] overflow-y-auto scrollbar-simple">
        <Giscus
          id="giscus-widget"
          repo="scracc/scratch-status-monitor"
          repoId="R_kgDOPZOm6A"
          mapping="number"
          term="1"
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="top"
          theme={theme === "dark" ? "gruvbox" : "light"}
          lang={locale}
          loading="lazy"
        />
      </div>
    </div>
  );
}
