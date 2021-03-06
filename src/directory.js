var Log = require('./log.js')
var config = require('../configs/config.json')
var fs = require('fs')
var Path = require('path')

/**
 * Directory manager.
 * @constructor
 */
function Directory () {
  var self = this
  this.dir = {}
  this.fileInfo = {}
  this.loadFileInfo()

  setInterval(function () {
    self.updateDownloads()
  }, 30000)
}

/**
 * Get the list and informations of files into a specific directory.
 * @param {string} dir - Directory to scan.
 * @return {object} - Directory informations.
*/
Directory.prototype.list = function (dir) {
  // save directory informations into app cache
  this.dir[dir] = this.getDir(dir)

  for (var f in this.dir[dir].files) {
    var file = Path.join(dir, f)
    file = file[0] === '/' ? file.substring(1) : file
    if (this.fileInfo[file] !== -1) {
      for (var i in this.fileInfo[file]) {
        this.dir[dir].files[f][i] = this.fileInfo[file][i]
      }
    }
  }
  return {
    'totalSize': this.dir[dir].totalSize,
    'files': this.dir[dir].files
  }
}

/**
 * Get directory informations.
 * @param {string} dir - Directory to get informations.
 * @return {object} - Directory informations.
*/
Directory.prototype.getDir = function (dir) {
  var self = this

  var list = {}
  var totalSize = 0
  var files = fs.readdirSync(Path.join(config.directory.path, dir))

  if (files.length > 0) {
    files.forEach(function (file) {
      var stats = self.getInfo(Path.join(config.directory.path, dir, file))
      list[file] = stats
      totalSize += stats.size
    })
  }

  var s = fs.statSync(Path.join(config.directory.path, dir))
  return {
    'mtime': s.mtime,
    'totalSize': totalSize,
    'files': list
  }
}

/**
 * Get file informations.
 * @param {string} file - File / Directory to get informations.
 * @return {object} - File / Directory informations.
*/
Directory.prototype.getInfo = function (file) {
  var stats = fs.statSync(file)
  var sfile = {}
  // get size if it's a Directory
  if (stats.isFile()) {
    sfile = stats
  } else {
    stats.size = sizeRecursif(file)
    sfile = stats
  }
  sfile.isfile = stats.isFile()
  sfile.isdir = stats.isDirectory()
  return sfile
}

/**
 * Lock a file.
 * @param {string} file - File to lock.
*/
Directory.prototype.setDownloading = function (file) {
  var self = this
  setTimeout(function () {
    // file info default value
    self.fileInfo[file] = self.fileInfo[file] || {}
    // increment file download
    self.fileInfo[file].download = self.fileInfo[file].download || 1
    // increment file current downloading and set the current date
    self.fileInfo[file].downloading = self.fileInfo[file].downloading
      ? {date: new Date(), count: self.fileInfo[file].downloading.count + 1}
      : {date: new Date(), count: 1}

    self.saveFileInfo()
  }, 1)
}

/**
 * Unlock a file.
 * @param {string} file - File to unlock.
*/
Directory.prototype.finishDownloading = function (file) {
  var self = this
  setTimeout(function () {
    // decrement file downloading
    self.fileInfo[file].downloading = self.fileInfo[file].downloading
      ? {date: self.fileInfo[file].downloading.date, count: self.fileInfo[file].downloading.count - 1}
      : {date: new Date(), count: 0}

    if (self.fileInfo[file].downloading.count >= 0) {
      delete self.fileInfo[file].downloading
    }
  }, 1)
}

/**
 * Auto Unlock a files after 1h.
*/
Directory.prototype.updateDownloads = function () {
  var self = this
  setTimeout(function () {
    var curDate = new Date()
    for (var key in self.fileInfo) {
      if (self.fileInfo[key].downloading) {
        // if downloading for more than 1 hour remove
        if (curDate - self.fileInfo[key].downloading.date > 3600000) {
          delete self.fileInfo[key].downloading
        }
      }
    }
  }, 1)
}

/**
 * Check if a file is locked.
 * @param {string} file - File to check.
 * @return {bool} - File lock state.
*/
Directory.prototype.isDownloading = function (file) {
  file = file[0] === '/' ? file.substring(1) : file
  return this.fileInfo[file] && this.fileInfo[file].downloading ? true : false
}

/**
 * Remove a file.
 * @param {string} file - File to remove.
*/
Directory.prototype.remove = function (file) {
  if (this.isDownloading(file)) return -1
  setTimeout(function () {
    fs.stat(Path.join(config.directory.path, file), function (err, stats) {
      if (err) Log.print(err)
      if (stats) {
        if (stats.isDirectory()) {
          removeRecursif(Path.join(config.directory.path, file))
        } else {
          fs.unlink(Path.join(config.directory.path, file), function (err) {
            if (err) Log.print(err)
          })
        }
      }
    })
  }, 1)
}

/**
 * Raname a file.
 * @param {string} path - File directory path.
 * @param {string} oldname - File old name.
 * @param {string} newname - File new name.
*/
Directory.prototype.rename = function (path, oldname, newname) {
  if (this.isDownloading(path + oldname)) return -1
  setTimeout(function () {
    fs.rename(Path.join(config.directory.path, path, oldname), Path.join(config.directory.path, path, newname), function (err) {
      if (err) Log.print(err)
    })
  }, 1)
}

/**
 * Create directory.
 * @param {string} path - Parent directory path.
 * @param {string} name - Directory name.
*/
Directory.prototype.mkdir = function (path, name) {
  setTimeout(function () {
    fs.mkdir(Path.join(config.directory.path, path, name), function (err) {
      if (err) Log.print(err)
    })
  }, 1)
}

/**
 * Move a file or directory.
 * @param {string} path - File / Directory directory path.
 * @param {string} file - File / Directory name.
 * @param {string} folder - Destination directory.
*/
Directory.prototype.mv = function (path, file, folder) {
  if (this.isDownloading(Path.join(path, file))) return -1
  setTimeout(function () {
    fs.rename(Path.join(config.directory.path, path, file), Path.join(config.directory.path, path, folder, file), function (err) {
      if (err) Log.print(err)
    })
  }, 1)
}

/**
 * Set the File / Directory Owner.
 * @param {string} file - File / Directory name.
 * @param {string} user - Owner.
*/
Directory.prototype.setOwner = function (file, user) {
  var self = this
  setTimeout(function () {
    file = file[0] === '/' ? file.slice(1) : file
    // set owner defalt value
    self.fileInfo[file] = self.fileInfo[file] || {}
    // prevent override current user
    if (self.fileInfo[file].owner == null) {
      self.fileInfo[file].owner = user
    }
    self.saveFileInfo()
  }, 1)
}

/**
 * Load configs/fileInfo.json into Directory.fileInfo.
*/
Directory.prototype.loadFileInfo = function () {
  var self = this
  setTimeout(function () {
    fs.readFile('configs/fileInfo.json', function (err, data) {
      if (err) {
        console.log(err)
        self.fileInfo = {}
        self.saveFileInfo()
      } else {
        var fileInfo = JSON.parse(data)
        for (var key in fileInfo) {
          delete fileInfo[key].downloading
        }
        self.fileInfo = fileInfo
      }
    })
  }, 1)
}

/**
 * Save Directory.fileInfo into configs/fileInfo.json.
*/
Directory.prototype.saveFileInfo = function () {
  var self = this
  setTimeout(function () {
    fs.writeFile('configs/fileInfo.json', JSON.stringify(self.fileInfo), function (err) {
      if (err) console.log(err)
    })
  }, 1)
}

/**
 * Remove Directory recursively.
 * @param {string} path - Directory to remove.
*/
function removeRecursif (path) {
  setTimeout(function () {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function (file, index) {
        var curPath = Path.join(path, file)
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          removeRecursif(curPath)
        } else { // delete file
          fs.unlinkSync(curPath)
        }
      })
      fs.rmdirSync(path)
    }
  }, 1)
}

/**
 * Get the Directory size recursively.
 * @param {string} path - Directory to remove.
 * @return {int} - Directory size (bytes)
*/
function sizeRecursif (path) {
  var size = 0
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file, index) {
      var curPath = Path.join(path, file)
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        size += sizeRecursif(curPath)
      } else { // read size
        size += fs.statSync(curPath).size
      }
    })
    return size
  }
}

module.exports = new Directory()
