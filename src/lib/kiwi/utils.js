export const getWordFromByteRange = function (byte, start, end) {
    let text = "";
    while (start < end) {
        start++;
        text += String.fromCharCode(byte[start]);
    }
    return text;
};
export const getOneWordFromByte = function (byte, start) {
    let end = start;
    // if the letter equal space, that word end;
    while (byte[end] != 0)
        end++;
    for (var i = start; i < end; i++) {
        const char = byte[i];
        if (char > 127)
            throw "e";
    }
    return getWordFromByteRange(byte, start, end);
};
export function quote(text) {
    return JSON.stringify(text);
}
export function error(text, line, column) {
    var error = new Error(text);
    error.line = line;
    error.column = column;
    throw error;
}
