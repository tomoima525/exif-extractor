import { readExifFromFile } from "../src";

const root = process.cwd();

function test() {
  const exifData = readExifFromFile(`${root}/sample/sample_001.jpg`);
  console.log("exifData", exifData);
}

test();
