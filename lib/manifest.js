var builder = require("xmlbuilder"),
  path = require("path"),
  schema = require("./schema.js"),
  files = require("./files.js"),
  utils = require("./utils");

var manifest = async function (fs, version, obj) {
  var configObj = schema.config(obj),
    lisOfFiles = await files(
      fs,
      path.normalize(obj.source),
      "excludeManifestFiles"
    );

  configObj.files = lisOfFiles.map(function(value) {
    var rObj = {};
    rObj["@href"] = value;
    return rObj;
  });

  return builder
    .create("manifest", {
      version: "1.0",
      encoding: "utf-8",
      standalone: false
    })
    .ele(schema[version](configObj))
    .end({
      pretty: true,
      newline: utils.EOL
    });
};

module.exports = manifest;
