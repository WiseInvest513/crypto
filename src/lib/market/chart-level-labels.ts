type PriceLevel = { id: string; price: number; rank?: number };

/** Keep selected/nearby labels readable without moving their actual price lines. */
export function layoutChartLevelLabels<T extends PriceLevel>(
  levels: readonly T[],
  { min, max, top, bottom, selectedId }: {
    min: number; max: number; top: number; bottom: number; selectedId: string | null;
  },
): (T & { actualY: number; labelY: number })[] {
  if (!(max > min) || bottom - top < 22) return [];
  const capacity = Math.max(0, Math.floor((bottom - top - 21) / 22) + 1);
  const priority = (level: T) => level.id === selectedId ? 0 : level.rank ?? 4;
  const visible = levels
    .filter((level) => Number.isFinite(level.price) && level.price >= min && level.price <= max)
    .toSorted((a, b) => priority(a) - priority(b))
    .slice(0, capacity)
    .sort((a, b) => b.price - a.price);
  let nextLabelY = top + 13;
  const labels = visible.map((level) => {
    const actualY = top + (max - level.price) / (max - min) * (bottom - top);
    const labelY = Math.max(actualY - 6, nextLabelY);
    nextLabelY = labelY + 22;
    return { ...level, actualY, labelY };
  });
  for (let index = labels.length - 1; index >= 0; index--) {
    labels[index].labelY = Math.min(labels[index].labelY, bottom - 8 - (labels.length - 1 - index) * 22);
  }
  return labels;
}
