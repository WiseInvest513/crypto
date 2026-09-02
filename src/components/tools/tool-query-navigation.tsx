"use client";

import { useSearchParams } from "next/navigation";
import type { ToolSlug } from "@/lib/tools/catalog";
import {
  parseToolAsset,
  type ToolAssetSlug,
} from "@/lib/tools/tool-navigation";
import {
  ToolAssetContextPanel,
  ToolNextStepsPanel,
} from "./tool-navigation-panels";

function useSafeToolAsset(): ToolAssetSlug | null {
  const searchParams = useSearchParams();
  const values = searchParams.getAll("asset");

  return parseToolAsset(values.length === 1 ? values[0] : values);
}

export function ToolAssetContextFromQuery() {
  const asset = useSafeToolAsset();

  return asset ? <ToolAssetContextPanel asset={asset} /> : null;
}

export function ToolNextStepsFromQuery({ toolSlug }: { toolSlug: ToolSlug }) {
  const asset = useSafeToolAsset();

  return <ToolNextStepsPanel asset={asset} toolSlug={toolSlug} />;
}
