import { Zip, ZipPassThrough } from 'fflate';

export interface ZipEntry {
  name: string;
  blob: Blob;
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';

  let index = 2;
  let candidate = `${base}-${index}${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}${extension}`;
  }

  used.add(candidate);
  return candidate;
}

export function makeZip(entries: ZipEntry[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    const used = new Set<string>();

    const archive = new Zip((error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }
      chunks.push(chunk as BlobPart);
      if (final) resolve(new Blob(chunks, { type: 'application/zip' }));
    });

    void (async () => {
      for (const entry of entries) {
        const file = new ZipPassThrough(uniqueName(entry.name, used));
        archive.add(file);
        file.push(new Uint8Array(await entry.blob.arrayBuffer()), true);
      }
      archive.end();
    })().catch(reject);
  });
}
