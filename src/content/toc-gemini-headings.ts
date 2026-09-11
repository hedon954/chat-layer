export type GeminiHeading<T extends { isConnected: boolean } = HTMLElement> = {
  level: number;
  text: string;
  element: T | null;
};

// Keep virtualized headings, but let the current DOM determine the order and
// level of headings it contains. Text alone is not an identity: repeats are valid.
export function mergeGeminiHeadings<T extends { isConnected: boolean }>(
  cached: GeminiHeading<T>[],
  fresh: GeminiHeading<T>[]
): GeminiHeading<T>[] {
  const matches = fresh.map(() => -1);
  const used = new Set<number>();
  const match = (predicate: (old: GeminiHeading<T>, next: GeminiHeading<T>) => boolean): void => {
    for (const [index, next] of fresh.entries()) {
      if (matches[index] !== -1) continue;
      const oldIndex = cached.findIndex((old, i) => !used.has(i) && predicate(old, next));
      if (oldIndex === -1) continue;
      matches[index] = oldIndex;
      used.add(oldIndex);
    }
  };

  match((old, next) => next.element !== null && old.element === next.element);
  match((old, next) => old.level === next.level && old.text === next.text);
  match((old, next) => old.text === next.text
    && cached.filter((heading) => heading.text === next.text).length === 1
    && fresh.filter((heading) => heading.text === next.text).length === 1);

  const result: GeminiHeading<T>[] = [];
  let cursor = 0;
  let pending: GeminiHeading<T>[] = [];
  const preserveUntil = (end: number): void => {
    while (cursor < end) {
      const index = cursor++;
      if (used.has(index)) continue;
      const heading = cached[index];
      if (heading.element && !heading.element.isConnected) heading.element = null;
      result.push(heading);
    }
  };

  for (const [index, next] of fresh.entries()) {
    const oldIndex = matches[index];
    if (oldIndex === -1) {
      pending.push({ ...next });
      continue;
    }
    preserveUntil(oldIndex);
    const heading = cached[oldIndex];
    Object.assign(heading, next);
    result.push(...pending, heading);
    pending = [];
    cursor = Math.max(cursor, oldIndex + 1);
  }
  result.push(...pending);
  preserveUntil(cached.length);
  return result;
}
