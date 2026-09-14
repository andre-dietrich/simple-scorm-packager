"use strict";

/**
 * Storage adapter, passed as `config.fs`. Defaults to the Node adapter below,
 * so existing callers are unaffected; a browser caller supplies an in-memory
 * implementation instead.
 *
 *   readFile(file)            -> Promise<Buffer|Uint8Array>
 *   writeFile(file, content)  -> Promise<void>   (creates parent dirs)
 *   copyFile(src, dest)       -> Promise<void>   (creates parent dirs)
 *   ensureDir(dir)            -> Promise<void>
 *   readDir(dir)              -> Promise<string[]>   (immediate children)
 *   isDirectory(target)       -> Promise<boolean>
 *   size(file)                -> Promise<number>
 *   zip(dir, destination)     -> Promise<number>  (bytes written)
 *
 * `assetRoot` is a property, not a method: the directory holding this package's
 * own `schemas/`. A browser build has no __dirname and must point it at
 * wherever those files were seeded.
 *
 * Node's modules are required inside the functions below, not at module scope,
 * so a browser bundle pulls in neither fs-extra nor archiver.
 */

var ZIP_COMPRESSION_LEVEL = 9;

/**
 * Directory holding this package's own schemas/, resolved through symlinks so a
 * global npm install still finds them. Exported so index.js can fall back to it
 * for an adapter that sets no assetRoot.
 */
nodeAdapter.defaultAssetRoot = function () {
  var fs = require("fs"),
    path = require("path");

  return path.dirname(fs.realpathSync(__filename));
};

function nodeAdapter() {
  var fs = require("fs"),
    fse = require("fs-extra"),
    path = require("path"),
    archiver = require("archiver");

  return {
    assetRoot: nodeAdapter.defaultAssetRoot(),

    readFile: function (file) {
      return fse.readFile(file);
    },

    writeFile: function (file, content) {
      return fse.outputFile(file, content);
    },

    copyFile: function (src, dest) {
      return fse.copy(src, dest);
    },

    ensureDir: function (dir) {
      return fse.ensureDir(dir);
    },

    readDir: function (dir) {
      return fse.readdir(dir);
    },

    isDirectory: function (target) {
      return fse.stat(target).then(
        function (stats) {
          return stats.isDirectory();
        },
        function () {
          return false;
        }
      );
    },

    size: function (file) {
      return fse.stat(file).then(function (stats) {
        return stats.size;
      });
    },

    zip: function (dir, destination) {
      return fse.ensureDir(path.dirname(destination)).then(function () {
        return new Promise(function (resolve, reject) {
          var output = fs.createWriteStream(destination);
          var archive = archiver("zip", {
            zlib: { level: ZIP_COMPRESSION_LEVEL }
          });

          // Resolve on "close", not on finalize(), which only starts the write.
          // Resolving early is what made the old code return before the zip
          // existed on disk.
          output.on("close", function () {
            resolve(archive.pointer());
          });
          output.on("error", reject);
          archive.on("error", reject);
          archive.on("warning", function (err) {
            if (err.code === "ENOENT") console.warn(err);
            else reject(err);
          });

          archive.pipe(output);
          archive.directory(dir, "");
          archive.finalize();
        });
      });
    }
  };
}

module.exports = nodeAdapter;
