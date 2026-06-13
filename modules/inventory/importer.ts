export function parseCardLines(lines: string) {
  const allItems = lines
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const uniqueItems = Array.from(new Set(allItems));
  const removedCount = allItems.length - uniqueItems.length;

  return { allItems, uniqueItems, removedCount };
}
