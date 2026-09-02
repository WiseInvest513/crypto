import "server-only";

import { homepageEditorialDraft } from "../../content/homepage-editorial";
import {
  parseHomepageEditorialConfig,
  type HomepageEditorialConfig,
} from "../../lib/editorial/homepage-editorial";
import {
  canAccessFeature,
  type UserAccess,
} from "../../lib/access/user-access";

const homepageEditorialConfig = parseHomepageEditorialConfig(
  homepageEditorialDraft,
);
const REDACTED_EDITORIAL_ENTRY = Object.freeze({
  publicationStatus: "unpublished" as const,
  effectiveAt: null,
  validUntil: null,
  lastReviewedAt: null,
  sources: Object.freeze([]),
  content: null,
});

export type HomepageEditorialPayload = {
  config: HomepageEditorialConfig;
  now: number;
};

function loadHomepageEditorial(
  now: () => number = Date.now,
): HomepageEditorialPayload {
  return {
    config: homepageEditorialConfig,
    now: now(),
  };
}

export async function loadHomepageEditorialForAccess(
  access: Promise<UserAccess>,
  now: () => number = Date.now,
): Promise<HomepageEditorialPayload> {
  const resolvedAccess = await access;
  const payload = loadHomepageEditorial(now);

  return {
    ...payload,
    config: restrictHomepageEditorialForAccess(
      payload.config,
      resolvedAccess,
    ),
  };
}

export function restrictHomepageEditorialForAccess(
  config: HomepageEditorialConfig,
  access: UserAccess,
): HomepageEditorialConfig {
  if (canAccessFeature(access, "editorial.tradeStrategy")) {
    return config;
  }

  return {
    marketStatus: REDACTED_EDITORIAL_ENTRY,
    todayInCrypto: config.todayInCrypto,
    wiseTake: REDACTED_EDITORIAL_ENTRY,
  };
}
