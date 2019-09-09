import fs from "fs";
import atob from "atob";

import { ExifTags, TiffTags, GPSTags, StringValues } from "./tags";
import { FractionValue } from "./FractionValue";

export function readExifFromFile(filename: string) {
  let arrayBuffer = base64ToArrayBuffer(
    fs.readFileSync(filename).toString("base64")
  );
  let img: any = {};
  var data = findExifInBinaryFile(arrayBuffer);
  img.exifdata = data || {};
  return img;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function findExifInBinaryFile(file: ArrayBuffer) {
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

  let offset = 2;
  const length = file.byteLength;

  while (offset < length) {
    if (dataView.getUint8(offset) != 0xff) {
      if (process.env.DEBUG) {
        console.error(
          "Not a valid marker at offset " +
            offset +
            ", found: " +
            dataView.getUint8(offset)
        );
      }
      return {}; // not a valid marker, something is wrong
    }

    const marker = dataView.getUint8(offset + 1);
    console.log(marker);

    // looking for 0xFFE1 for EXIF data

    if (marker == 225) {
      if (process.env.DEBUG) {
        console.log("Found 0xFFE1 marker");
      }

      return readEXIFData(dataView, offset + 4);
    } else {
      offset += 2 + dataView.getUint16(offset + 2);
    }
  }
}

function readEXIFData(file: DataView, start: number) {
  if (getStringFromDB(file, start, 4) != "Exif") {
    if (process.env.DEBUG) {
      console.error("Not valid EXIF data! " + getStringFromDB(file, start, 4));
    }
    return {};
  }

  let bigEnd: boolean;
  var tags,
    tag,
    exifData,
    gpsData,
    tiffOffset = start + 6;

  // test for TIFF validity and endianness
  if (file.getUint16(tiffOffset) == 0x4949) {
    bigEnd = false;
  } else if (file.getUint16(tiffOffset) == 0x4d4d) {
    bigEnd = true;
  } else {
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
      console.error(
        "Not valid TIFF data! (First offset less than 8)",
        file.getUint32(tiffOffset + 4, !bigEnd)
      );
    }
    return {};
  }

  tags = readTags(
    file,
    tiffOffset,
    tiffOffset + firstIFDOffset,
    TiffTags,
    bigEnd
  );

  if (tags.ExifIFDPointer) {
    exifData = readTags(
      file,
      tiffOffset,
      tiffOffset + tags.ExifIFDPointer,
      ExifTags,
      bigEnd
    );
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
          exifData[tag] = StringValues[tag][exifData[tag]];
          break;

        case "ExifVersion":
        case "FlashpixVersion":
          exifData[tag] = String.fromCharCode(
            exifData[tag][0],
            exifData[tag][1],
            exifData[tag][2],
            exifData[tag][3]
          );
          break;

        case "ComponentsConfiguration":
          exifData[tag] =
            StringValues.Components[exifData[tag][0]] +
            StringValues.Components[exifData[tag][1]] +
            StringValues.Components[exifData[tag][2]] +
            StringValues.Components[exifData[tag][3]];
          break;
      }
      tags[tag] = exifData[tag];
    }
  }

  if (tags.GPSInfoIFDPointer) {
    gpsData = readTags(
      file,
      tiffOffset,
      tiffOffset + tags.GPSInfoIFDPointer,
      GPSTags,
      bigEnd
    );
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

function getStringFromDB(buffer: DataView, start, length) {
  var outstr = "";
  for (var n = start; n < start + length; n++) {
    outstr += String.fromCharCode(buffer.getUint8(n));
  }
  return outstr;
}

function readTags(
  file: DataView,
  tiffStart: number,
  dirStart: number,
  strings: any,
  bigEnd: boolean
) {
  const entries = file.getUint16(dirStart, !bigEnd);
  const tags = {};
  let entryOffset: number;
  let tag: string;

  for (let i = 0; i < entries; i++) {
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

function readTagValue(
  file: DataView,
  entryOffset: number,
  tiffStart: number,
  bigEnd: boolean
): string[] | number[] | number | string {
  const type = file.getUint16(entryOffset + 2, !bigEnd);
  const numValues = file.getUint32(entryOffset + 4, !bigEnd);
  const valueOffset = file.getUint32(entryOffset + 8, !bigEnd) + tiffStart;
  let offset: number;

  switch (type) {
    case 1: // byte, 8-bit unsigned int
    case 7: // undefined, 8-bit byte, value depending on field
      if (numValues == 1) {
        return file.getUint8(entryOffset + 8);
      } else {
        offset = numValues > 4 ? valueOffset : entryOffset + 8;
        const vals: number[] = [];
        for (let n = 0; n < numValues; n++) {
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
      } else {
        offset = numValues > 2 ? valueOffset : entryOffset + 8;
        const vals: number[] = [];
        for (let n = 0; n < numValues; n++) {
          vals.push(file.getUint16(offset + 2 * n, !bigEnd));
        }
        return vals;
      }

    case 4: // long, 32 bit int
      if (numValues == 1) {
        return file.getUint32(entryOffset + 8, !bigEnd);
      } else {
        const vals: number[] = [];
        for (let n = 0; n < numValues; n++) {
          vals.push(file.getUint32(valueOffset + 4 * n, !bigEnd));
        }
        return vals;
      }

    case 5: // rational = two long values, first is numerator, second is denominator
      if (numValues == 1) {
        const numerator = file.getUint32(valueOffset, !bigEnd);
        const denominator = file.getUint32(valueOffset + 4, !bigEnd);
        const val = new FractionValue(
          new Number(numerator / denominator) as number,
          numerator,
          denominator
        );

        return [val.toString()];
      } else {
        const vals: string[] = [];
        for (let n = 0; n < numValues; n++) {
          const numerator = file.getUint32(valueOffset + 8 * n, !bigEnd);
          const denominator = file.getUint32(valueOffset + 4 + 8 * n, !bigEnd);
          const v = new FractionValue(
            new Number(numerator / denominator) as number,
            numerator,
            denominator
          );
          vals.push(v.toString());
        }
        return vals;
      }

    case 9: // slong, 32 bit signed int
      if (numValues == 1) {
        return file.getInt32(entryOffset + 8, !bigEnd);
      } else {
        const vals: number[] = [];
        for (let n = 0; n < numValues; n++) {
          vals.push(file.getInt32(valueOffset + 4 * n, !bigEnd));
        }
        return vals;
      }

    case 10: // signed rational, two slongs, first is numerator, second is denominator
      if (numValues == 1) {
        return (
          file.getInt32(valueOffset, !bigEnd) /
          file.getInt32(valueOffset + 4, !bigEnd)
        );
      } else {
        const vals: number[] = [];
        for (let n = 0; n < numValues; n++) {
          vals.push(
            file.getInt32(valueOffset + 8 * n, !bigEnd) /
              file.getInt32(valueOffset + 4 + 8 * n, !bigEnd)
          );
        }
        return vals;
      }
  }
}
