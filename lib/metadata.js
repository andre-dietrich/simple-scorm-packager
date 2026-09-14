var builder = require("xmlbuilder"),
  schema = require("./schema.js"),
  utils = require("./utils");

var metadata = function(obj) {
  var configObj = schema.config(obj);

  return builder
    .create("lom", {
      version: "1.0",
      encoding: "utf-8"
    })
    .ele(schema["metadata"](configObj))
    .end({
      pretty: true,
      newline: utils.EOL
    });
};

module.exports = metadata;
