import { prisma } from "@linkwarden/prisma";
import type { Prisma } from "@prisma/client";
import getPermission from "@/lib/api/getPermission";
import { removeFolder } from "@linkwarden/filesystem";
import { meiliClient } from "@linkwarden/lib/meilisearchClient";

export default async function deleteCollection(
  userId: number,
  collectionId: number
) {
  if (!collectionId)
    return { response: "Please choose a valid collection.", status: 401 };

  const permission = await getPermission({ userId, collectionId });
  const isMember = permission?.members.some(
    (member) => member.userId === userId
  );

  if (permission?.ownerId !== userId) {
    if (!isMember)
      return { response: "Collection is not accessible.", status: 401 };

    // Leaving a shared collection must not delete its links or archive files.
    const relation = await prisma.$transaction(async (tx) => {
      const removed = await tx.usersAndCollections.delete({
        where: { userId_collectionId: { userId, collectionId } },
      });
      await removeFromNavigation(tx, [collectionId], userId);
      await tx.link.updateMany({
        where: { collectionId },
        data: { indexVersion: null },
      });
      return removed;
    });
    return { response: relation, status: 200 };
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const collectionIds = [collectionId];
    let parents = [collectionId];
    while (parents.length) {
      const children = await tx.collection.findMany({
        where: { parentId: { in: parents } },
        select: { id: true },
      });
      parents = children.map((child) => child.id);
      collectionIds.push(...parents);
    }

    const links = await tx.link.findMany({
      where: { collectionId: { in: collectionIds } },
      select: { id: true },
    });
    await removeFromNavigation(tx, collectionIds);

    // Cascades remove descendants, links, highlights, RSS and memberships.
    // All database writes use tx, so failure rolls back the whole operation.
    const collection = await tx.collection.delete({
      where: { id: collectionId, ownerId: userId },
    });
    return { collection, collectionIds, linkIds: links.map((link) => link.id) };
  });

  // Remote calls must not hold a database transaction open or report a failed
  // deletion after the database has already committed. Cleanup is idempotent.
  for (const id of deleted.collectionIds) {
    await cleanupWithRetry(
      () => removeFolder({ filePath: `archives/${id}` }),
      id
    );
    await cleanupWithRetry(
      () => removeFolder({ filePath: `archives/preview/${id}` }),
      id
    );
  }
  if (meiliClient && deleted.linkIds.length) {
    await cleanupWithRetry(
      () => meiliClient!.index("links").deleteDocuments(deleted.linkIds),
      collectionId
    );
  }
  return { response: deleted.collection, status: 200 };
}

async function cleanupWithRetry(
  operation: () => Promise<unknown>,
  collectionId: number
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await operation();
      return;
    } catch {
      if (attempt === 2)
        console.error("Deleted collection needs archive/search cleanup", {
          collectionId,
        });
    }
  }
}

async function removeFromNavigation(
  tx: Prisma.TransactionClient,
  collectionIds: number[],
  userId?: number
) {
  const users = await tx.user.findMany({
    where: { id: userId, collectionOrder: { hasSome: collectionIds } },
    select: { id: true, collectionOrder: true },
  });
  const removedIds = new Set(collectionIds);
  for (const user of users) {
    await tx.user.update({
      where: { id: user.id },
      data: {
        collectionOrder: user.collectionOrder.filter(
          (id) => !removedIds.has(id)
        ),
      },
    });
  }

  const sections = await tx.dashboardSection.findMany({
    where: { userId, collectionId: { in: collectionIds } },
    select: { userId: true },
    distinct: ["userId"],
  });
  await tx.dashboardSection.deleteMany({
    where: { userId, collectionId: { in: collectionIds } },
  });
  for (const section of sections) {
    const remaining = await tx.dashboardSection.findMany({
      where: { userId: section.userId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });
    for (let order = 0; order < remaining.length; order++) {
      const item = remaining[order];
      if (item.order !== order)
        await tx.dashboardSection.update({
          where: { id: item.id },
          data: { order },
        });
    }
  }
}
