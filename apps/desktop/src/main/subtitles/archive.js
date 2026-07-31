const path = require("path");
const zlib = require("zlib");

const ZIP_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

const SUBTITLE_EXTS = new Set(["srt", "vtt", "ass", "ssa"]);

function extractFirstSubtitleFromZip(buf) {
  let offset = 0;
  while (offset < buf.length - 30) {
    if (
      buf[offset] === 0x50 &&
      buf[offset + 1] === 0x4b &&
      buf[offset + 2] === 0x03 &&
      buf[offset + 3] === 0x04
    ) {
      const compression = buf.readUInt16LE(offset + 8);
      const compressedSize = buf.readUInt32LE(offset + 18);
      const fileNameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const rawFileName = buf
        .slice(offset + 30, offset + 30 + fileNameLen)
        .toString("utf8");
      const dataOffset = offset + 30 + fileNameLen + extraLen;

      const fileName = path.basename(rawFileName);

      const ext = fileName.toLowerCase().split(".").pop();
      if (SUBTITLE_EXTS.has(ext)) {
        const compressedData = buf.slice(
          dataOffset,
          dataOffset + compressedSize,
        );
        let data;
        if (compression === 0) {
          if (compressedData.length > ZIP_MAX_OUTPUT_BYTES) {
            offset = dataOffset + compressedSize;
            continue;
          }
          data = compressedData;
        } else if (compression === 8) {
          try {
            data = zlib.inflateRawSync(compressedData, {
              maxOutputLength: ZIP_MAX_OUTPUT_BYTES,
            });
          } catch {
            offset = dataOffset + compressedSize;
            continue;
          }
        } else {
          offset = dataOffset + compressedSize;
          continue;
        }
        return { data, name: fileName };
      }
      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

module.exports = { SUBTITLE_EXTS, extractFirstSubtitleFromZip };
