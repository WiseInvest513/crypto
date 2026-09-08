import { describe, expect, it } from "vitest";
import { layoutChartLevelLabels } from "@/lib/market/chart-level-labels";

const options = { min: 0, max: 100, top: 18, bottom: 270, selectedId: null };

describe("key-level chart label layout", () => {
  it("separates dense labels while keeping real line prices unchanged", () => {
    const levels = Array.from({ length: 9 }, (_, index) => ({ id: String(index), price: 50 + index / 10 }));
    const labels = layoutChartLevelLabels(levels, options);
    expect(labels).toHaveLength(9);
    labels.forEach((label, index) => {
      expect(label.actualY).toBeCloseTo(18 + (100 - label.price) / 100 * 252);
      expect(label.labelY - 13).toBeGreaterThanOrEqual(options.top);
      expect(label.labelY + 8).toBeLessThanOrEqual(options.bottom);
      if (index) expect(label.labelY - labels[index - 1].labelY).toBeGreaterThanOrEqual(22);
    });
  });

  it("keeps the selected and nearest labels when a small canvas cannot label every layer", () => {
    const levels = Array.from({ length: 25 }, (_, index) => ({ id: String(index), price: 20 + index }));
    const labels = layoutChartLevelLabels([{ id: "near", price: 5, rank: 1 }, ...levels], { ...options, bottom: 128, selectedId: "24" });
    expect(labels.length).toBeLessThanOrEqual(5);
    expect(labels.some((label) => label.id === "24")).toBe(true);
    expect(labels.some((label) => label.id === "near")).toBe(true);
    expect(labels[0].labelY - 13).toBeGreaterThanOrEqual(options.top);
  });

  it("does not invent labels outside the price range or in invalid geometry", () => {
    const levels = [{ id: "outside", price: 150 }, { id: "invalid", price: NaN }];
    expect(layoutChartLevelLabels(levels, options)).toEqual([]);
    expect(layoutChartLevelLabels([{ id: "a", price: 50 }], { ...options, max: 0 })).toEqual([]);
  });
});
