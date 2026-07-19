import fs from "node:fs/promises";
import path from "node:path";
import { getPrefix, Locales } from "intlayer";
import type { Plugin } from "vite";

type SitemapPluginOptions = {
  baseUrl?: string;
  outputPath?: string;
  routeTreePath?: string;
  policiesDir?: string;
  intlayerConfigPath?: string;
  includeXDefault?: boolean;
};

const DEFAULT_BASE_URL = "https://ssm.scra.cc";
const DEFAULT_OUTPUT = "public/sitemap.xml";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const parseLocalesFromConfig = (text: string) => {
  const match = text.match(/locales:\s*\[([\s\S]*?)\]/);
  if (!match) {
    return null;
  }

  const tokens = [...match[1].matchAll(/Locales\.([A-Z_]+)/g)].map((m) => m[1]);

  if (tokens.length === 0) {
    return null;
  }

  const localesMap = Locales as unknown as Record<string, string | undefined>;
  const locales = tokens
    .map((token) => localesMap[token])
    .filter((locale): locale is string => typeof locale === "string");

  return locales.length > 0 ? locales : null;
};

const parseDefaultLocaleFromConfig = (text: string) => {
  const match = text.match(/defaultLocale:\s*Locales\.([A-Z_]+)/);
  if (!match) {
    return null;
  }

  const localesMap = Locales as unknown as Record<string, string | undefined>;
  const locale = localesMap[match[1]];
  return typeof locale === "string" ? locale : null;
};

const loadLocales = async (intlayerConfigPath: string) => {
  try {
    const configText = await fs.readFile(intlayerConfigPath, "utf8");
    const parsed = parseLocalesFromConfig(configText);
    if (parsed) {
      return {
        locales: parsed,
        defaultLocale: parseDefaultLocaleFromConfig(configText) ?? parsed[0],
      };
    }
  } catch {
    console.warn("[sitemap] Failed to read intlayer.config.ts, using defaults.");
  }

  return { locales: ["ja"], defaultLocale: "ja" };
};

const getLocalePrefixes = (locales: string[]) =>
  locales
    .map((locale) => ({
      locale,
      prefix: getPrefix(locale, { mode: "prefix-all" }).localePrefix,
    }))
    .filter((entry) => typeof entry.prefix === "string" && entry.prefix.length > 0)
    .map((entry) => ({ locale: entry.locale, prefix: entry.prefix as string }));

const loadPolicyIds = async (policiesDir: string) => {
  try {
    const entries = await fs.readdir(policiesDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    console.warn("[sitemap] Failed to read policies directory, skipping policy routes.");
    return [];
  }
};

const readRoutePaths = async (routeTreePath: string) => {
  const content = await fs.readFile(routeTreePath, "utf8");
  const blockMatch = content.match(/fullPaths:\s*([\s\S]*?)fileRoutesByTo:/);
  const source = blockMatch ? blockMatch[1] : content;
  return [...source.matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

const normalizePath = (value: string) => {
  if (value === "/") {
    return value;
  }

  return `/${value}`.replace(/\/+/g, "/").replace(/\/$/, "");
};

const buildLocalePath = (localePrefix: string, rest: string) => {
  const normalizedRest = rest === "/" ? "" : rest;
  return normalizePath(`${localePrefix}${normalizedRest}`);
};

const expandRoutes = ({ routes, policyIds }: { routes: string[]; policyIds: string[] }) => {
  const localizedRests = new Set<string>();
  const nonLocalized = new Set<string>();

  for (const route of routes) {
    if (route.includes("/404")) {
      continue;
    }
    if (route.includes("/api/")) {
      continue;
    }

    if (route === "/") {
      localizedRests.add("/");
      continue;
    }

    if (route.startsWith("/$locale")) {
      const rest = route.slice("/$locale".length) || "/";

      if (rest.includes("$")) {
        if (rest === "/policies/$policyId") {
          for (const policyId of policyIds) {
            localizedRests.add(`/policies/${policyId}`);
          }
        }

        continue;
      }

      localizedRests.add(rest);

      continue;
    }

    if (route.includes("$")) {
      continue;
    }

    nonLocalized.add(normalizePath(route));
  }

  return {
    localizedRests: [...localizedRests],
    nonLocalized: [...nonLocalized],
  };
};

type SitemapAlternate = {
  hreflang: string;
  href: string;
};

type SitemapEntry = {
  loc: string;
  alternates?: SitemapAlternate[];
};

const writeSitemap = async (outputPath: string, entries: SitemapEntry[]) => {
  const lines = entries
    .map((entry) => {
      const alternateLines = entry.alternates
        ?.map(
          (alternate) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(
              alternate.hreflang
            )}" href="${escapeXml(alternate.href)}" />`
        )
        .join("\n");

      if (alternateLines) {
        return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n${alternateLines}\n  </url>`;
      }

      return `  <url><loc>${escapeXml(entry.loc)}</loc></url>`;
    })
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    `${lines}\n</urlset>\n`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, xml, "utf8");
};

const generateSitemap = async (root: string, options: SitemapPluginOptions) => {
  const baseUrl = (options.baseUrl ?? process.env.SITEMAP_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const includeXDefault = options.includeXDefault ?? true;

  const routeTreePath = options.routeTreePath ?? path.join(root, "src", "routeTree.gen.ts");
  const policiesDir = options.policiesDir ?? path.join(root, "policies");
  const intlayerConfigPath = options.intlayerConfigPath ?? path.join(root, "intlayer.config.ts");
  const outputPath = options.outputPath ?? path.join(root, DEFAULT_OUTPUT);

  try {
    const [localesResult, policyIds, routes] = await Promise.all([
      loadLocales(intlayerConfigPath),
      loadPolicyIds(policiesDir),
      readRoutePaths(routeTreePath),
    ]);

    const localeInfos = getLocalePrefixes(localesResult.locales);
    const defaultLocale = localesResult.defaultLocale;
    const defaultPrefix =
      localeInfos.find((entry) => entry.locale === defaultLocale)?.prefix ?? localeInfos[0]?.prefix;

    const expandedRoutes = expandRoutes({ routes, policyIds });

    const entries: SitemapEntry[] = [];
    const localizedRests = expandedRoutes.localizedRests.sort();
    const nonLocalized = expandedRoutes.nonLocalized.sort();

    for (const rest of localizedRests) {
      const localeEntries = localeInfos.map((entry) => ({
        hreflang: entry.locale,
        href: new URL(buildLocalePath(entry.prefix, rest), `${baseUrl}/`).toString(),
      }));

      const alternates: SitemapAlternate[] = [...localeEntries];
      if (includeXDefault && defaultPrefix) {
        alternates.push({
          hreflang: "x-default",
          href: new URL(buildLocalePath(defaultPrefix, rest), `${baseUrl}/`).toString(),
        });
      }

      for (const localeEntry of localeEntries) {
        entries.push({
          loc: localeEntry.href,
          alternates,
        });
      }
    }

    for (const pathValue of nonLocalized) {
      entries.push({
        loc: new URL(pathValue, `${baseUrl}/`).toString(),
      });
    }

    await writeSitemap(outputPath, entries);
    console.log(`[sitemap] Generated ${entries.length} URLs -> ${outputPath}`);
  } catch (error) {
    console.error("[sitemap] Failed to generate sitemap:", error);
  }
};

export const sitemapPlugin = (options: SitemapPluginOptions = {}): Plugin => {
  let resolvedRoot = process.cwd();
  let generated = false;

  return {
    name: "ssm-sitemap",
    configResolved(config) {
      resolvedRoot = config.root;

      if (config.command === "serve" && !generated) {
        generated = true;
        void generateSitemap(resolvedRoot, options);
      }
    },
    apply: "build",
    async closeBundle() {
      await generateSitemap(resolvedRoot, options);
    },
  };
};
