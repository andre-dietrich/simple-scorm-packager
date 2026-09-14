var path = require("path");

// Never listed as manifest resources: schema definitions, plus the two
// documents the packager generates itself.
var EXCLUDED_EXTENSIONS = [".xsd", ".dtd"];
var EXCLUDED_NAMES = ["metadata.xml", "imsmanifest.xml"];

var _walk = async function (fs, dir, excludeSchemaFiles) {
  var fileList = await fs.readDir(dir);
  var finalFileList = [];

  for (var i = 0; i < fileList.length; i++) {
    var file = fileList[i];
    var full = path.join(dir, file);

    if (await fs.isDirectory(full)) {
      finalFileList = finalFileList.concat(
        await _walk(fs, full, excludeSchemaFiles)
      );
      continue;
    }

    if (!excludeSchemaFiles) {
      finalFileList.push(full);
      continue;
    }

    if (
      EXCLUDED_EXTENSIONS.indexOf(path.extname(file)) === -1 &&
      EXCLUDED_NAMES.indexOf(file) === -1
    ) {
      finalFileList.push(full);
    }
  }

  return finalFileList;
};

/**
 * Lists files below `dir`, as paths relative to it.
 *
 * @param fs storage adapter (see fs-adapter.js)
 * @param excludeSchemaFiles omit .xsd/.dtd and the generated manifest/metadata
 */
var files = async function (fs, dir, excludeSchemaFiles) {
  dir = path.normalize(dir);

  var results = await _walk(fs, dir, excludeSchemaFiles);

  return results.map(function (value) {
    var relative = value.split(dir + path.sep)[1] || value;

    // Escapes exactly what the previous url.format() escaped. Deliberate:
    // encodeURIComponent would also encode non-ASCII and "+", changing the
    // manifest hrefs of existing courses with unicode filenames.
    return relative.split(path.sep).join("/").replace(/ /g, "%20");
  });
};

module.exports = files;
