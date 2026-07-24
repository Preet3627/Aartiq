const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRX_MAGIC = Buffer.from([0x43, 0x72, 0x32, 0x34]);

function parseCRXHeader(buffer) {
  if (!buffer.subarray(0, 4).equals(CRX_MAGIC)) {
    throw new Error('Invalid CRX file: magic number not found');
  }
  const version = buffer.readUInt32LE(4);
  if (version === 2) {
    const pubKeyLength = buffer.readUInt32LE(8);
    const sigLength = buffer.readUInt32LE(12);
    const zipOffset = 16 + pubKeyLength + sigLength;
    return { version: 2, zipOffset };
  } else if (version === 3) {
    const headerLength = buffer.readUInt32LE(8);
    const zipOffset = 12 + headerLength;
    return { version: 3, zipOffset };
  }
  throw new Error(`Unsupported CRX version: ${version}`);
}

function extractZip(zipBuffer, outputDir) {
  let offset = 0;
  const files = [];
  while (offset < zipBuffer.length - 4) {
    const signature = zipBuffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);
    const fileName = zipBuffer.subarray(offset + 30, offset + 30 + fileNameLength).toString('utf8');
    const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
    const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
    files.push({ name: fileName, compressedData, compressionMethod, uncompressedSize });
    offset = dataOffset + compressedSize;
  }
  for (const file of files) {
    const filePath = path.join(outputDir, file.name);
    const dirPath = path.dirname(filePath);
    fs.mkdirSync(dirPath, { recursive: true });
    if (file.name.endsWith('/')) continue;
    let data;
    if (file.compressionMethod === 0) {
      data = file.compressedData;
    } else if (file.compressionMethod === 8) {
      data = zlib.inflateRawSync(file.compressedData);
    } else {
      throw new Error(`Unsupported compression method: ${file.compressionMethod}`);
    }
    fs.writeFileSync(filePath, data);
  }
}

function extractCRX(crxPath, outputDir) {
  const crxBuffer = fs.readFileSync(crxPath);
  const header = parseCRXHeader(crxBuffer);
  const zipBuffer = crxBuffer.subarray(header.zipOffset);
  fs.mkdirSync(outputDir, { recursive: true });
  extractZip(zipBuffer, outputDir);
  return outputDir;
}

function isCRXFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath, { encoding: null });
    return buffer.length >= 4 && buffer.subarray(0, 4).equals(CRX_MAGIC);
  } catch { return false; }
}

function isExtensionDirectory(dirPath) {
  return fs.existsSync(path.join(dirPath, 'manifest.json'));
}

module.exports = { extractCRX, isCRXFile, isExtensionDirectory };
