import "server-only";

import { homepageEditorialDraft } from "../../content/homepage-editorial";
import {
  parseHomepageEditorialConfig,
  type HomepageEditorialConfig,
} from "../../lib/editorial/homepage-editorial";

const homepageEditorialConfig = parseHomepageEditorialConfig(
  homepageEditorialDraft,
);

export type HomepageEditorialPayload = {
  config: HomepageEditorialConfig;
  now: number;
};

export function loadHomepageEditorial(
  now: () => number = Date.now,
): HomepageEditorialPayload {
  return {
    config: homepageEditorialConfig,
    now: now(),
  };
}
