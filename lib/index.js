"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var atob_1 = __importDefault(require("atob"));
var tags_1 = require("./tags");
var FractionValue_1 = require("./FractionValue");
function readExifFromFile(filename) {
    var arrayBuffer = base64ToArrayBuffer(fs_1.default.readFileSync(filename).toString("base64"));
    var img = {};
    var data = findExifInBinaryFile(arrayBuffer);
    img.exifdata = data || {};
    return img;
}
exports.readExifFromFile = readExifFromFile;
function base64ToArrayBuffer(base64) {
    var binary = atob_1.default(base64);
    var len = binary.length;
    var buffer = new ArrayBuffer(len);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < len; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buffer;
}
function findExifInBinaryFile(file) {
    var dataView = new DataView(file);
    if (process.env.DEBUG) {
        console.log("Got file of length " + file.byteLength);
    }
    if (dataView.getUint8(0) != 0xff || dataView.getUint8(1) != 0xd8) {
        if (process.env.DEBUG) {
            console.error("Not a valid JPEG");
        }
        return {}; // not a valid jpeg
    }
    var offset = 2;
    var length = file.byteLength;
    while (offset < length) {
        if (dataView.getUint8(offset) != 0xff) {
            if (process.env.DEBUG) {
                console.error("Not a valid marker at offset " +
                    offset +
                    ", found: " +
                    dataView.getUint8(offset));
            }
            return {}; // not a valid marker, something is wrong
        }
        var marker = dataView.getUint8(offset + 1);
        console.log(marker);
        // looking for 0xFFE1 for EXIF data
        if (marker == 225) {
            if (process.env.DEBUG) {
                console.log("Found 0xFFE1 marker");
            }
            return readEXIFData(dataView, offset + 4);
        }
        else {
            offset += 2 + dataView.getUint16(offset + 2);
        }
    }
}
function readEXIFData(file, start) {
    if (getStringFromDB(file, start, 4) != "Exif") {
        if (process.env.DEBUG) {
            console.error("Not valid EXIF data! " + getStringFromDB(file, start, 4));
        }
        return {};
    }
    var bigEnd;
    var tags, tag, exifData, gpsData, tiffOffset = start + 6;
    // test for TIFF validity and endianness
    if (file.getUint16(tiffOffset) == 0x4949) {
        bigEnd = false;
    }
    else if (file.getUint16(tiffOffset) == 0x4d4d) {
        bigEnd = true;
    }
    else {
        if (process.env.DEBUG) {
            console.error("Not valid TIFF data! (no 0x4949 or 0x4D4D)");
        }
        return {};
    }
    if (file.getUint16(tiffOffset + 2, !bigEnd) != 0x002a) {
        if (process.env.DEBUG) {
            console.error("Not valid TIFF data! (no 0x002A)");
        }
        return {};
    }
    var firstIFDOffset = file.getUint32(tiffOffset + 4, !bigEnd);
    if (firstIFDOffset < 0x00000008) {
        if (process.env.DEBUG) {
            console.error("Not valid TIFF data! (First offset less than 8)", file.getUint32(tiffOffset + 4, !bigEnd));
        }
        return {};
    }
    tags = readTags(file, tiffOffset, tiffOffset + firstIFDOffset, tags_1.TiffTags, bigEnd);
    if (tags.ExifIFDPointer) {
        exifData = readTags(file, tiffOffset, tiffOffset + tags.ExifIFDPointer, tags_1.ExifTags, bigEnd);
        for (tag in exifData) {
            switch (tag) {
                case "LightSource":
                case "Flash":
                case "MeteringMode":
                case "ExposureProgram":
                case "SensingMethod":
                case "SceneCaptureType":
                case "SceneType":
                case "CustomRendered":
                case "WhiteBalance":
                case "GainControl":
                case "Contrast":
                case "Saturation":
                case "Sharpness":
                case "SubjectDistanceRange":
                case "FileSource":
                    exifData[tag] = tags_1.StringValues[tag][exifData[tag]];
                    break;
                case "ExifVersion":
                case "FlashpixVersion":
                    exifData[tag] = String.fromCharCode(exifData[tag][0], exifData[tag][1], exifData[tag][2], exifData[tag][3]);
                    break;
                case "ComponentsConfiguration":
                    exifData[tag] =
                        tags_1.StringValues.Components[exifData[tag][0]] +
                            tags_1.StringValues.Components[exifData[tag][1]] +
                            tags_1.StringValues.Components[exifData[tag][2]] +
                            tags_1.StringValues.Components[exifData[tag][3]];
                    break;
            }
            tags[tag] = exifData[tag];
        }
    }
    if (tags.GPSInfoIFDPointer) {
        gpsData = readTags(file, tiffOffset, tiffOffset + tags.GPSInfoIFDPointer, tags_1.GPSTags, bigEnd);
        for (tag in gpsData) {
            switch (tag) {
                case "GPSVersionID":
                    gpsData[tag] =
                        gpsData[tag][0] +
                            "." +
                            gpsData[tag][1] +
                            "." +
                            gpsData[tag][2] +
                            "." +
                            gpsData[tag][3];
                    break;
            }
            tags[tag] = gpsData[tag];
        }
    }
    return tags;
}
function getStringFromDB(buffer, start, length) {
    var outstr = "";
    for (var n = start; n < start + length; n++) {
        outstr += String.fromCharCode(buffer.getUint8(n));
    }
    return outstr;
}
function readTags(file, tiffStart, dirStart, strings, bigEnd) {
    var entries = file.getUint16(dirStart, !bigEnd);
    var tags = {};
    var entryOffset;
    var tag;
    for (var i = 0; i < entries; i++) {
        entryOffset = dirStart + i * 12 + 2;
        tag = strings[file.getUint16(entryOffset, !bigEnd)];
        if (!tag) {
            if (process.env.DEBUG) {
                console.warn("Unknown tag: " + file.getUint16(entryOffset, !bigEnd));
            }
        }
        tags[tag] = readTagValue(file, entryOffset, tiffStart, bigEnd);
    }
    return tags;
}
function readTagValue(file, entryOffset, tiffStart, bigEnd) {
    var type = file.getUint16(entryOffset + 2, !bigEnd);
    var numValues = file.getUint32(entryOffset + 4, !bigEnd);
    var valueOffset = file.getUint32(entryOffset + 8, !bigEnd) + tiffStart;
    var offset;
    switch (type) {
        case 1: // byte, 8-bit unsigned int
        case 7: // undefined, 8-bit byte, value depending on field
            if (numValues == 1) {
                return file.getUint8(entryOffset + 8);
            }
            else {
                offset = numValues > 4 ? valueOffset : entryOffset + 8;
                var vals = [];
                for (var n = 0; n < numValues; n++) {
                    vals.push(file.getUint8(offset + n));
                }
                return vals;
            }
        case 2: // ascii, 8-bit byte
            offset = numValues > 4 ? valueOffset : entryOffset + 8;
            return getStringFromDB(file, offset, numValues - 1);
        case 3: // short, 16 bit int
            if (numValues == 1) {
                return file.getUint16(entryOffset + 8, !bigEnd);
            }
            else {
                offset = numValues > 2 ? valueOffset : entryOffset + 8;
                var vals = [];
                for (var n = 0; n < numValues; n++) {
                    vals.push(file.getUint16(offset + 2 * n, !bigEnd));
                }
                return vals;
            }
        case 4: // long, 32 bit int
            if (numValues == 1) {
                return file.getUint32(entryOffset + 8, !bigEnd);
            }
            else {
                var vals = [];
                for (var n = 0; n < numValues; n++) {
                    vals.push(file.getUint32(valueOffset + 4 * n, !bigEnd));
                }
                return vals;
            }
        case 5: // rational = two long values, first is numerator, second is denominator
            if (numValues == 1) {
                var numerator = file.getUint32(valueOffset, !bigEnd);
                var denominator = file.getUint32(valueOffset + 4, !bigEnd);
                var val = new FractionValue_1.FractionValue(new Number(numerator / denominator), numerator, denominator);
                return [val.toString()];
            }
            else {
                var vals = [];
                for (var n = 0; n < numValues; n++) {
                    var numerator = file.getUint32(valueOffset + 8 * n, !bigEnd);
                    var denominator = file.getUint32(valueOffset + 4 + 8 * n, !bigEnd);
                    var v = new FractionValue_1.FractionValue(new Number(numerator / denominator), numerator, denominator);
                    vals.push(v.toString());
                }
                return vals;
            }
        case 9: // slong, 32 bit signed int
            if (numValues == 1) {
                return file.getInt32(entryOffset + 8, !bigEnd);
            }
            else {
                var vals = [];
                for (var n = 0; n < numValues; n++) {
                    vals.push(file.getInt32(valueOffset + 4 * n, !bigEnd));
                }
                return vals;
            }
        case 10: // signed rational, two slongs, first is numerator, second is denominator
            if (numValues == 1) {
                return (file.getInt32(valueOffset, !bigEnd) /
                    file.getInt32(valueOffset + 4, !bigEnd));
            }
            else {
                var vals = [];
                for (var n = 0; n < numValues; n++) {
                    vals.push(file.getInt32(valueOffset + 8 * n, !bigEnd) /
                        file.getInt32(valueOffset + 4 + 8 * n, !bigEnd));
                }
                return vals;
            }
    }
}
//# sourceMappingURL=index.js.map