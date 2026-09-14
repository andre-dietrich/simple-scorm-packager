var path = require("path"),
  files = require("./files.js"),
  config = require("./schemas/config"),
  schema = require("./schema.js"),
  metadata = require("./metadata.js"),
  manifest = require("./manifest.js"),
  nodeAdapter = require("./fs-adapter.js"),
  utils = require("./utils");

var _logSuccess = function(msg) {
  var date = new Date();
  var time = date.getHours() +
    ":" +
    date.getMinutes() +
    ":" +
    date.getSeconds();
  console.log(
    "[" + time + "]",
    "SCORM",
    "'" + "\x1b[32m" + msg + "\x1b[0m" + "'"
  );
};

var _logError = function(err) {
  var date = new Date();
  var time = date.getHours() +
    ":" +
    date.getMinutes() +
    ":" +
    date.getSeconds();
  console.log("[" + time + "]" + "\x1b[31m", err, "\x1b[0m");
};

/** Total size in bytes of every file below `dir`. */
var _directorySize = async function (fs, dir) {
  var total = 0;
  var entries = await fs.readDir(dir);

  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i]);

    if (await fs.isDirectory(full)) {
      total += await _directorySize(fs, full);
    } else {
      total += await fs.size(full);
    }
  }

  return total;
};

var buildPackage = async function (obj) {
  _logSuccess("Init");

  // Defaults to the Node adapter, so existing callers are unaffected.
  var fs = obj.fs || nodeAdapter();

  obj = config(obj);
  var schemaVersion, schemaDefinition;

  switch (obj.version) {
    case "1.2":
      schemaVersion = "scorm12";
      schemaDefinition = "scorm12edition";
      break;
    case "2004.3":
    case "2004v3":
    case "2004 3rd Edition":
      schemaVersion = "scorm2004";
      schemaDefinition = "scorm20043rdedition";
      break;
    case "2004.4":
    case "2004v4":
    case "2004 4th Edition":
      schemaVersion = "scorm2004";
      schemaDefinition = "scorm20044thedition";
      break;
  }

  if (!schemaVersion) {
    _logError("Supported versions:\n1.2\n2004 3rd Edition\n2004 4th Edition");
    return;
  }

  if (obj.package.size === "") {
    // Previously un-awaited, so the size landed after the manifest was already
    // built and never appeared in the output.
    obj.package.size = await _directorySize(fs, obj.source);
  }

  // Where this package's own schemas/ live. An adapter only sets assetRoot when
  // they are not at their install location, as in a browser bundle.
  var rootDir = fs.assetRoot || nodeAdapter.defaultAssetRoot(),
    definitionDir = path.join(
      rootDir,
      "schemas",
      "definitionFiles",
      schemaDefinition
    ),
    definitionFileList = (await files(fs, definitionDir)).map(function (file) {
      return {
        name: file,
        source: path.join(definitionDir, file),
        destination: path.join(obj.source, file)
      };
    });


  try {
    await fs.writeFile(
      path.join(obj.source, "imsmanifest.xml"),
      await manifest(fs, schemaVersion, obj))
  } catch (err) {
    return _logError(err);

  }


  _logSuccess("create " + path.join(obj.source, "imsmanifest.xml"));

  try {
    await fs.writeFile(
      path.join(obj.source, "metadata.xml"),
      metadata(obj))
  } catch (err) {
    return _logError(err);
  }

  _logSuccess("create " + path.join(obj.source, "metadata.xml"));

  for (var f = 0; f < definitionFileList.length; f++) {
    var file = definitionFileList[f];
    try {
      await fs.copyFile(file.source, file.destination);
      _logSuccess("create " + file.destination);
    } catch (err) {
      _logError(err);
    }
  }

  if (obj.package.zip) {
    var utcTime = new Date().getTime();
    await fs.ensureDir(obj.package.outputFolder);
    let finalFilename = obj.package.filename || `${utils.cleanAndTrim(obj.package.name)}_v${obj.package.version}_${obj.package.date}${obj.package.appendTimeToOutput ? `_${utcTime}` : ''}.zip`;
    var zipOutput = path.join(
      obj.package.outputFolder,
      finalFilename
    );
    _logSuccess("Archiving " + obj.source + " to " + zipOutput);

    // Awaited, so buildPackage no longer resolves before the zip exists:
    // finalize() used to be called without waiting for the stream to close.
    try {
      var bytes = await fs.zip(obj.source, zipOutput);
      _logSuccess(finalFilename + " " + bytes + " total bytes");
    } catch (err) {
      _logError(err);
      throw err;
    }
  }

  return obj;
};

module.exports = buildPackage;
