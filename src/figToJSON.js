import { ByteBuffer, compileSchema, decodeBinarySchema } from "kiwi-schema";
const transfer8to32 = function (fileByte, start, cache) {
    cache[0] = fileByte[start + 0];
    cache[1] = fileByte[start + 1];
    cache[2] = fileByte[start + 2];
    cache[3] = fileByte[start + 3];
};
// buffers to work with for convenience
const int32 = new Int32Array(1); // 32 bit word
const uint8 = new Uint8Array(int32.buffer); // 4 slots of 8 bits
const uint32 = new Uint32Array(int32.buffer); // 1 unsigned 32 bit word
function convertBlobsToBase64(json) {
    if (!json.blobs)
        return json;
    return {
        ...json,
        blobs: json.blobs.map((blob) => {
            return btoa(String.fromCharCode(...blob.bytes));
        })
    };
}
function convertBase64ToBlobs(json) {
    if (!json.blobs)
        return json;
    return {
        ...json,
        blobs: json.blobs.map((blob) => {
            return { bytes: Uint8Array.from(atob(blob), (c) => c.charCodeAt(0)) };
        })
    };
}
const calcEnd = function (fileByte, start) {
    transfer8to32(fileByte, start, uint8);
    return uint32[0];
};
export const getFigJsonData = async (fileBuffer) => {
    const [schemaByte, dataByte] = figToBinaryParts(fileBuffer);
    const schemaBB = new ByteBuffer(schemaByte);
    const schema = decodeBinarySchema(schemaBB);
    const dataBB = new ByteBuffer(dataByte);
    const schemaHelper = compileSchema(schema);
    const json = schemaHelper[`decodeMessage`](dataBB);
    return convertBlobsToBase64(json);
};
// note fileBuffer is mutated inside
function figToBinaryParts(fileBuffer) {
    let fileByte = new Uint8Array(fileBuffer);
    let schemaByte;
    let dataByte;
    // ... (rest of the unzip and initial parsing logic)
    let start = 8;
    calcEnd(fileByte, start);
    start += 4;
    // Assume the first part is schemaByte and the second part is dataByte
    let end = calcEnd(fileByte, start);
    start += 4;
    schemaByte = fileByte.slice(start, start + end);
    start += end;
    end = calcEnd(fileByte, start);
    start += 4;
    dataByte = fileByte.slice(start, start + end);
    // Note: if there are more than two parts, this simple approach won't work, 
    // and you'll need more sophisticated logic to differentiate between parts.
    return [schemaByte, dataByte];
}
