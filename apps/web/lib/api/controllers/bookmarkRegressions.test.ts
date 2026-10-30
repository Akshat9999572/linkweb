import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { removeFolder } from "@linkwarden/filesystem";

vi.mock("@linkwarden/filesystem", () => ({ removeFolder: vi.fn() }));
vi.mock("@linkwarden/lib/meilisearchClient", () => ({ meiliClient: null }));

let prisma: typeof import("@linkwarden/prisma").prisma;
let deleteCollection: typeof import("./collections/collectionId/deleteCollectionById").default;
let searchLinks: typeof import("./search/searchLinks").default;
let ownerId: number;
let guestId: number;

beforeAll(async () => {
  await import("dotenv/config");
  const database = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname))
    throw new Error("Regression tests require a local PostgreSQL database.");
  ({ prisma } = await import("@linkwarden/prisma"));
  deleteCollection = (
    await import("./collections/collectionId/deleteCollectionById")
  ).default;
  searchLinks = (await import("./search/searchLinks")).default;
});

beforeEach(async () => {
  const suffix = randomUUID();
  ownerId = (
    await prisma.user.create({
      data: { username: `regression_owner_${suffix}` },
    })
  ).id;
  guestId = (
    await prisma.user.create({
      data: { username: `regression_guest_${suffix}` },
    })
  ).id;
  vi.mocked(removeFolder).mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  if (ownerId && guestId)
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, guestId] } } });
});
afterAll(async () => {
  await prisma?.$disconnect();
});

async function collection(name = "Regression collection", parentId?: number) {
  return prisma.collection.create({ data: { name, ownerId, parentId } });
}

async function bookmark(
  collectionId: number,
  textContent = "archivetextneedle otherword"
) {
  return prisma.link.create({
    data: {
      name: "Unrelated title",
      description: "Unrelated summary",
      url: "https://example.com",
      collectionId,
      textContent,
    },
  });
}

async function search(query: Record<string, unknown>, userId = ownerId) {
  const result = await searchLinks({ userId, query: query as any });
  return (result.data as { links: { id: number }[] }).links;
}

describe("collection deletion regressions", () => {
  it("atomically deletes a nested tree and compacts all affected navigation before file cleanup", async () => {
    const root = await collection();
    const child = await collection("Child", root.id);
    const grandchild = await collection("Grandchild", child.id);
    const sibling = await collection("Retained sibling");
    const link = await bookmark(grandchild.id);
    await prisma.highlight.create({
      data: {
        userId: ownerId,
        linkId: link.id,
        color: "yellow",
        text: "Text",
        startOffset: 0,
        endOffset: 4,
      },
    });
    await prisma.link.update({
      where: { id: link.id },
      data: { pinnedBy: { connect: { id: ownerId } } },
    });
    await prisma.rssSubscription.create({
      data: {
        name: "Test feed",
        url: "https://example.com/feed",
        ownerId,
        collectionId: child.id,
      },
    });
    for (const userId of [ownerId, guestId]) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          collectionOrder: [root.id, child.id, grandchild.id, sibling.id],
        },
      });
      await prisma.dashboardSection.createMany({
        data: [
          { userId, collectionId: child.id, type: "COLLECTION", order: 0 },
          { userId, type: "RECENT_LINKS", order: 1 },
        ],
      });
    }
    vi.mocked(removeFolder).mockImplementation(async () => {
      expect(
        await prisma.collection.findUnique({ where: { id: root.id } })
      ).toBeNull();
    });
    const result = await deleteCollection(ownerId, root.id);
    expect(result.status).toBe(200);
    expect(
      await prisma.collection.count({
        where: { id: { in: [root.id, child.id, grandchild.id] } },
      })
    ).toBe(0);
    expect(
      await prisma.collection.findUnique({ where: { id: sibling.id } })
    ).not.toBeNull();
    expect(await prisma.link.findUnique({ where: { id: link.id } })).toBeNull();
    expect(await prisma.highlight.count({ where: { linkId: link.id } })).toBe(
      0
    );
    expect(
      await prisma.rssSubscription.count({ where: { collectionId: child.id } })
    ).toBe(0);
    for (const userId of [ownerId, guestId]) {
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
          .collectionOrder
      ).toEqual([sibling.id]);
      expect(
        await prisma.dashboardSection.findMany({
          where: { userId },
          select: { type: true, order: true },
        })
      ).toEqual([{ type: "RECENT_LINKS", order: 0 }]);
    }
    expect(removeFolder).toHaveBeenCalledTimes(6);
  });

  it("rolls back both content and navigation when the transaction fails", async () => {
    const root = await collection();
    const link = await bookmark(root.id);
    await prisma.user.update({
      where: { id: ownerId },
      data: { collectionOrder: [root.id] },
    });
    const transaction = prisma.$transaction.bind(prisma);
    vi.spyOn(prisma, "$transaction").mockImplementationOnce(((callback: any) =>
      transaction(async (tx) => {
        await callback(tx);
        throw new Error("Injected failure before commit");
      })) as any);
    await expect(deleteCollection(ownerId, root.id)).rejects.toThrow(
      "Injected failure"
    );
    expect(
      await prisma.collection.findUnique({ where: { id: root.id } })
    ).not.toBeNull();
    expect(
      await prisma.link.findUnique({ where: { id: link.id } })
    ).not.toBeNull();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ownerId } }))
        .collectionOrder
    ).toEqual([root.id]);
    expect(removeFolder).not.toHaveBeenCalled();
  });

  it("retries transient archive cleanup after committing the deletion", async () => {
    const root = await collection();
    vi.mocked(removeFolder).mockRejectedValueOnce(
      new Error("Temporary storage failure")
    );
    expect((await deleteCollection(ownerId, root.id)).status).toBe(200);
    expect(removeFolder).toHaveBeenCalledTimes(3);
    expect(
      await prisma.collection.findUnique({ where: { id: root.id } })
    ).toBeNull();
  });

  it("lets a member leave without deleting shared content or archives", async () => {
    const root = await collection();
    const link = await bookmark(root.id);
    await prisma.usersAndCollections.create({
      data: {
        userId: guestId,
        collectionId: root.id,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      },
    });
    expect((await deleteCollection(guestId, root.id)).status).toBe(200);
    expect(
      await prisma.link.findUnique({ where: { id: link.id } })
    ).not.toBeNull();
    expect(
      await prisma.usersAndCollections.count({
        where: { userId: guestId, collectionId: root.id },
      })
    ).toBe(0);
    expect(removeFolder).not.toHaveBeenCalled();
  });

  it("denies deletion by a user without access", async () => {
    const root = await collection();
    expect((await deleteCollection(guestId, root.id)).status).toBe(401);
    expect(
      await prisma.collection.findUnique({ where: { id: root.id } })
    ).not.toBeNull();
    expect(removeFolder).not.toHaveBeenCalled();
  });
});

describe("archived content search regressions", () => {
  it("finds saved page text case-insensitively and excludes inaccessible collections", async () => {
    const root = await collection();
    const link = await bookmark(root.id);
    expect(
      (await search({ searchQueryString: "ARCHIVETEXTNEEDLE" })).map(
        (l) => l.id
      )
    ).toEqual([link.id]);
    expect(
      await search({ searchQueryString: "archivetextneedle" }, guestId)
    ).toEqual([]);
    expect(await search({ searchQueryString: "absentword" })).toEqual([]);
  });

  it("combines tag, pin and text filters instead of letting one bypass the others", async () => {
    const root = await collection();
    const match = await bookmark(root.id);
    const mismatch = await bookmark(root.id, "other page content");
    const tag = await prisma.tag.create({
      data: { ownerId, name: "Research" },
    });
    for (const id of [match.id, mismatch.id])
      await prisma.link.update({
        where: { id },
        data: { tags: { connect: { id: tag.id } } },
      });
    await prisma.link.update({
      where: { id: match.id },
      data: { pinnedBy: { connect: { id: ownerId } } },
    });
    expect(
      (
        await search({
          tagId: tag.id,
          pinnedOnly: true,
          searchQueryString: "archivetextneedle",
        })
      ).map((l) => l.id)
    ).toEqual([match.id]);
    expect(
      await search({ tagId: tag.id, searchQueryString: "absentword" })
    ).toEqual([]);
    expect(
      (
        await search({
          searchQueryString:
            "archivetextneedle tag:Research !public:true pinned:true",
        })
      ).map((l) => l.id)
    ).toEqual([match.id]);
    expect(
      await search({ searchQueryString: "archivetextneedle !tag:Research" })
    ).toEqual([]);
  });

  it("supports multiple words, quoted phrases, pagination and public-only access", async () => {
    const root = await collection();
    const link = await bookmark(root.id);
    expect(
      (await search({ searchQueryString: "archivetextneedle otherword" })).map(
        (l) => l.id
      )
    ).toEqual([link.id]);
    expect(
      (
        await search({ searchQueryString: '"archivetextneedle otherword"' })
      ).map((l) => l.id)
    ).toEqual([link.id]);
    expect(
      await search({ searchQueryString: "archivetextneedle missingword" })
    ).toEqual([]);
    expect(
      await search({ searchQueryString: "archivetextneedle", cursor: link.id })
    ).toEqual([]);
    const privateResult = await searchLinks({
      publicOnly: true,
      query: { searchQueryString: "archivetextneedle" } as any,
    });
    expect((privateResult.data as any).links).toEqual([]);
    await prisma.collection.update({
      where: { id: root.id },
      data: { isPublic: true },
    });
    const publicResult = await searchLinks({
      publicOnly: true,
      query: { searchQueryString: "archivetextneedle" } as any,
    });
    expect((publicResult.data as any).links.map((l: any) => l.id)).toEqual([
      link.id,
    ]);
  });
});
