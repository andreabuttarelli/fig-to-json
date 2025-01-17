let int32 = new Int32Array(1);
let float32 = new Float32Array(int32.buffer);
export class ByteBuffer {
    _data;
    _index;
    length;
    constructor(data) {
        if (data && !(data instanceof Uint8Array)) {
            throw new Error("Must initialize a ByteBuffer with a Uint8Array");
        }
        this._data = data || new Uint8Array(256);
        this._index = 0;
        this.length = data ? data.length : 0;
    }
    toUint8Array() {
        return this._data.subarray(0, this.length);
    }
    readByte() {
        if (this._index + 1 > this._data.length) {
            throw new Error("Index out of bounds");
        }
        return this._data[this._index++];
    }
    readByteArray() {
        let length = this.readVarUint();
        let start = this._index;
        let end = start + length;
        if (end > this._data.length) {
            throw new Error("Read array out of bounds");
        }
        this._index = end;
        // Copy into a new array instead of just creating another view.
        let result = new Uint8Array(length);
        result.set(this._data.subarray(start, end));
        return result;
    }
    readVarFloat() {
        let index = this._index;
        let data = this._data;
        let length = data.length;
        // Optimization: use a single byte to store zero
        if (index + 1 > length) {
            throw new Error("Index out of bounds");
        }
        let first = data[index];
        if (first === 0) {
            this._index = index + 1;
            return 0;
        }
        // Endian-independent 32-bit read
        if (index + 4 > length) {
            throw new Error("Index out of bounds");
        }
        let bits = first |
            (data[index + 1] << 8) |
            (data[index + 2] << 16) |
            (data[index + 3] << 24);
        this._index = index + 4;
        // Move the exponent back into place
        bits = (bits << 23) | (bits >>> 9);
        // Reinterpret as a floating-point number
        int32[0] = bits;
        return float32[0];
    }
    readVarUint() {
        let value = 0;
        let shift = 0;
        do {
            var byte = this.readByte();
            value |= (byte & 127) << shift;
            shift += 7;
        } while (byte & 128 && shift < 35);
        return value >>> 0;
    }
    readVarInt() {
        let value = this.readVarUint() | 0;
        return value & 1 ? ~(value >>> 1) : value >>> 1;
    }
    readString() {
        let result = "";
        while (true) {
            let codePoint;
            // Decode UTF-8
            let a = this.readByte();
            if (a < 0xc0) {
                codePoint = a;
            }
            else {
                let b = this.readByte();
                if (a < 0xe0) {
                    codePoint = ((a & 0x1f) << 6) | (b & 0x3f);
                }
                else {
                    let c = this.readByte();
                    if (a < 0xf0) {
                        codePoint = ((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f);
                    }
                    else {
                        let d = this.readByte();
                        codePoint =
                            ((a & 0x07) << 18) |
                                ((b & 0x3f) << 12) |
                                ((c & 0x3f) << 6) |
                                (d & 0x3f);
                    }
                }
            }
            // Strings are null-terminated
            if (codePoint === 0) {
                break;
            }
            // Encode UTF-16
            if (codePoint < 0x10000) {
                result += String.fromCharCode(codePoint);
            }
            else {
                codePoint -= 0x10000;
                result += String.fromCharCode((codePoint >> 10) + 0xd800, (codePoint & ((1 << 10) - 1)) + 0xdc00);
            }
        }
        return result;
    }
    _growBy(amount) {
        if (this.length + amount > this._data.length) {
            let data = new Uint8Array((this.length + amount) << 1);
            data.set(this._data);
            this._data = data;
        }
        this.length += amount;
    }
    writeByte(value) {
        let index = this.length;
        this._growBy(1);
        this._data[index] = value;
    }
    writeByteArray(value) {
        this.writeVarUint(value.length);
        let index = this.length;
        this._growBy(value.length);
        this._data.set(value, index);
    }
    writeVarFloat(value) {
        let index = this.length;
        // Reinterpret as an integer
        float32[0] = value;
        let bits = int32[0];
        // Move the exponent to the first 8 bits
        bits = (bits >>> 23) | (bits << 9);
        // Optimization: use a single byte to store zero and denormals (check for an exponent of 0)
        if ((bits & 255) === 0) {
            this.writeByte(0);
            return;
        }
        // Endian-independent 32-bit write
        this._growBy(4);
        let data = this._data;
        data[index] = bits;
        data[index + 1] = bits >> 8;
        data[index + 2] = bits >> 16;
        data[index + 3] = bits >> 24;
    }
    writeVarUint(value) {
        do {
            let byte = value & 127;
            value >>>= 7;
            this.writeByte(value ? byte | 128 : byte);
        } while (value);
    }
    writeVarInt(value) {
        this.writeVarUint((value << 1) ^ (value >> 31));
    }
    writeString(value) {
        let codePoint;
        for (let i = 0; i < value.length; i++) {
            // Decode UTF-16
            let a = value.charCodeAt(i);
            if (i + 1 === value.length || a < 0xd800 || a >= 0xdc00) {
                codePoint = a;
            }
            else {
                let b = value.charCodeAt(++i);
                codePoint = (a << 10) + b + (0x10000 - (0xd800 << 10) - 0xdc00);
            }
            // Strings are null-terminated
            if (codePoint === 0) {
                throw new Error("Cannot encode a string containing the null character");
            }
            // Encode UTF-8
            if (codePoint < 0x80) {
                this.writeByte(codePoint);
            }
            else {
                if (codePoint < 0x800) {
                    this.writeByte(((codePoint >> 6) & 0x1f) | 0xc0);
                }
                else {
                    if (codePoint < 0x10000) {
                        this.writeByte(((codePoint >> 12) & 0x0f) | 0xe0);
                    }
                    else {
                        this.writeByte(((codePoint >> 18) & 0x07) | 0xf0);
                        this.writeByte(((codePoint >> 12) & 0x3f) | 0x80);
                    }
                    this.writeByte(((codePoint >> 6) & 0x3f) | 0x80);
                }
                this.writeByte((codePoint & 0x3f) | 0x80);
            }
        }
        // Strings are null-terminated
        this.writeByte(0);
    }
}
