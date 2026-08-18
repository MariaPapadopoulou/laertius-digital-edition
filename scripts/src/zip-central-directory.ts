/**
 * Minimal zip central-directory reader: returns each entry's exact UTF-8
 * name, stored CRC-32 and uncompressed size. Parsing the central directory
 * directly (instead of shelling out to `unzip -Z1`) matters because unzip
 * replaces non-ASCII filename bytes with `?` in its listing (the workspace
 * has Greek-named attachment files), which would make those entries
 * permanently look added+removed to a freshness check.
 *
 * Assumes a non-zip64 archive (our source zips are well under the limits;
 * zip64 puts 0xffffffff markers in these fields, which we detect and reject
 * loudly). Shared by check-source-archive-freshness.ts and
 * validate-public-source-freshness.ts.
 */

export interface ZipEntry {
  name: string;
  crc: number;
  size: number;
}

export function readCentralDirectory(buf: Buffer): ZipEntry[] {
  // Locate End Of Central Directory (signature 0x06054b50), scanning back
  // over a possible trailing comment (max 64 KiB).
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("No end-of-central-directory record found (corrupt zip?)");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error("zip64 archive not supported by this reader");
  }
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`Bad central-directory entry signature at offset ${p}`);
    }
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (size === 0xffffffff) throw new Error(`zip64 size field on entry ${name}`);
    entries.push({ name, crc, size });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
