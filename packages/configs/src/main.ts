import type { ssmrcType } from "@repo/types";

import { cache } from "./cache";
import { category } from "./category";
import { checks } from "./checks";
import { monitors } from "./monitor";
import { shortUrls } from "./short-urls";

export const ssmrc: ssmrcType.i = {
  category,
  monitors,
  checks,
  cache,
  shortUrls,
};
