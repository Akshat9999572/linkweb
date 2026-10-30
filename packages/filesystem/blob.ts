import {
  copy,
  del,
  get,
  head,
  list,
  put,
  BlobNotFoundError,
} from "@vercel/blob";

export const usesBlobStorage = () =>
  process.env.STORAGE_BACKEND === "vercel-blob";

export function blobContentType(filePath: string) {
  if (filePath.endsWith(".pdf")) return "application/pdf";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".html")) return "text/html";
  return "image/jpeg";
}

export async function putBlob(filePath: string, data: Buffer) {
  await put(filePath, data, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: blobContentType(filePath),
  });
  return true;
}

export async function readBlob(filePath: string) {
  const result = await get(filePath, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200)
    return { file: "File not found.", contentType: "text/plain", status: 404 };
  return {
    file: Buffer.from(await new Response(result.stream).arrayBuffer()),
    contentType: blobContentType(filePath),
    status: 200,
  };
}

export async function blobExists(filePath: string) {
  try {
    await head(filePath);
    return true;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return false;
    throw error;
  }
}

export async function deleteBlob(filePath: string) {
  await del(filePath);
}

export async function deleteBlobFolder(filePath: string) {
  const prefix = filePath.replace(/\/+$/, "") + "/";
  // Restart the listing after each deletion so cursor positions never skip files.
  while (true) {
    const result = await list({ prefix, limit: 1000 });
    if (!result.blobs.length) return;
    await del(result.blobs.map((blob) => blob.url));
  }
}

export async function moveBlob(from: string, to: string) {
  if (!(await blobExists(from))) return;
  await copy(from, to, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: blobContentType(to),
  });
  await del(from);
}
