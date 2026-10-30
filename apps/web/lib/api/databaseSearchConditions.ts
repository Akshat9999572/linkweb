import type { Prisma } from "@prisma/client";
import { parseSearchTokens } from "./searchQueryBuilder";

// Keep the original search controls useful without requiring a separate server.
// Each word/quoted phrase must match; field filters narrow the same result set.
export function databaseSearchConditions(
  query: string,
  userId?: number
): Prisma.LinkWhereInput[] {
  const contains = (value: string): Prisma.StringFilter => ({
    contains: value,
    mode: "insensitive",
  });

  return parseSearchTokens(query).flatMap(({ field, value, isNegative }) => {
    if (!value) return [];
    let condition: Prisma.LinkWhereInput;
    switch (field) {
      case "name":
      case "url":
      case "description":
        condition = { [field]: contains(value) };
        break;
      case "type":
        condition = { type: { equals: value, mode: "insensitive" } };
        break;
      case "collection":
        condition = { collection: { name: contains(value) } };
        break;
      case "tag":
        condition = { tags: { some: { name: contains(value) } } };
        break;
      case "pinned":
        if (!userId || !["true", "false"].includes(value)) return [];
        condition = { pinnedBy: { some: { id: userId } } };
        if (value === "false") condition = { NOT: condition };
        break;
      case "public":
        if (!["true", "false"].includes(value)) return [];
        condition = { collection: { isPublic: value === "true" } };
        break;
      case "before":
      case "after": {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return [];
        condition = {
          createdAt: field === "before" ? { lt: date } : { gt: date },
        };
        break;
      }
      default:
        condition = {
          OR: [
            { name: contains(value) },
            { url: contains(value) },
            { description: contains(value) },
            { textContent: contains(value) },
            { tags: { some: { name: contains(value) } } },
          ],
        };
    }
    return [isNegative ? { NOT: condition } : condition];
  });
}
