# EXIF extractor

- Extract EXIF information from images on nodejs

# installation

Add below on your package.json and then run `yarn install` or `npm install`.

```
dependencies: {
 "exif-extractor": "git://github.com/tomoima525/exif-extractor.git#1.0.1",
}
```

# Usage

```
import { readExifFromFile } from 'exif-extractor'
const exifData = readExifFromFile(`${root}/sample/sample_001.jpg`);
console.log(exifData);
//
{ exifdata:
   { ImageWidth: 4032,
     ImageHeight: 3024,
     Make: 'Google',
     Model: 'Pixel 3',
     Orientation: 6,
     XResolution: [ 'value: 72 denominator: 72 numerator: 1' ],
     YResolution: [ 'value: 72 denominator: 72 numerator: 1' ],
     ResolutionUnit: 2,
     Software: 'HDR+ 1.0.265696846zdh',
     ...
```

## Reference

This project is heavily inspired by https://github.com/exif-js/exif-js
