import type { ssmrcType } from "@repo/types";

const ORG_NAME = "scracc";
const REPO_SLUG = "scratch-status-monitor";

export const shortUrls: ssmrcType.e.shortUrl = [
  {
    key: "contact",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSexvsgzQ6FDh-402RtAFybh1rFwJerG1AOMcjk_DLIVxeTS4w/viewform",
  },
  {
    key: "transparency",
    url: "https://transparency.ssm.scra.cc",
  },
  {
    key: "funding",
    url: "/funding/bmc",
  },
  {
    key: "funding/bmc",
    url: "https://buymeacoffee.com/toakiryu",
  },
  {
    key: "gh/org",
    url: `https://github.com/${ORG_NAME}`,
  },
  // repository
  {
    key: "gh/repo",
    url: `https://github.com/${ORG_NAME}/${REPO_SLUG}`,
  },
  {
    key: "gh/issues",
    url: `https://github.com/${ORG_NAME}/${REPO_SLUG}/issues`,
  },
  {
    key: "gh/issues.nc",
    url: `https://github.com/${ORG_NAME}/${REPO_SLUG}/issues/new/choose`,
  },
  {
    key: "gh/discussions",
    url: `https://github.com/${ORG_NAME}/${REPO_SLUG}/discussions`,
  },
  // graphs
  {
    key: "gh/contributors",
    url: `https://github.com/${ORG_NAME}/${REPO_SLUG}/graphs/contributors`,
  },
  // discussions categories
  {
    key: "gh/faq",
    url: `https://github.com/${ORG_NAME}/${REPO_SLUG}/discussions/categories/q-a`,
  },
];
