'use strict';
const path = require('path');
const _ = require('underscore');
const PluginError = require('plugin-error');
const Vinyl = require('vinyl');
const through = require('through2');

const PLUGIN_NAME = 'gulp-rev-collector';

const defaults = {
    revSuffix: '-[0-9a-f]{8,10}-?',
    extMap: {
        '.scss': '.css',
        '.less': '.css',
        '.jsx': '.js'
    }
};

function _getManifestData(file, opts) {
    let data;
    const ext = path.extname(file.path);
    if (ext === '.json') {
        let json = {};
        try {
            const content = file.contents.toString('utf8');
            if (content) {
                json = JSON.parse(content);
            }
        } catch (x) {
            this.emit('error', new PluginError(PLUGIN_NAME, x));
            return;
        }
        if (_.isObject(json)) {
            let isRev = 1;
            Object.keys(json).forEach(function (key) {
                if (!_.isString(json[key])) {
                    isRev = 0;
                    return;
                }
                const cleanReplacement = path.basename(json[key]).split('?')[0]
                if (!~[
                    path.basename(key),
                    _mapExtnames(path.basename(key), opts)
                ].indexOf(cleanReplacement)
                ) {
                    isRev = 0;
                }
            });

            if (isRev) {
                data = json;
            }
        }

    }
    return data;
}

// Issue #30 extnames normalisation
function _mapExtnames(filename, opts) {
    Object.keys(opts.extMap).forEach(function (ext) {
        const extPattern = new RegExp(escPathPattern(ext) + '$');
        if (extPattern.test(filename)) {
            filename = filename.replace(extPattern, opts.extMap[ext]);
        }
    });
    return filename;
}

function escPathPattern(pattern) {
    return pattern.replace(/[\-\[\]\{\}\(\)\*\+\?\.\^\$\|\/\\]/g, "\\$&");
}

function closeDirBySep(dirname) {
    return dirname + (!dirname || new RegExp(escPathPattern('/') + '$').test(dirname) ? '' : '/');
}

function revCollector(opts) {
    opts = _.defaults((opts || {}), defaults);

    const manifest = {};
    const mutables = [];
    return through.obj(function (file, enc, cb) {
        if (!file.isNull()) {
            const mData = _getManifestData.call(this, file, opts);
            if (mData) {
                _.extend(manifest, mData);
            } else {
                mutables.push(file);
            }
        }
        cb();
    }, function (cb) {
        const changes = [];
        const dirReplacements = [];
        if (_.isObject(opts.dirReplacements)) {
            Object.keys(opts.dirReplacements).forEach(function (srcDirname) {
                dirReplacements.push({
                    dirRX: escPathPattern(closeDirBySep(srcDirname)),
                    dirRpl: opts.dirReplacements[srcDirname]
                });
            });
        }

        if (opts.collectedManifest) {
            this.push(
                new Vinyl({
                    path: opts.collectedManifest,
                    contents: new Buffer(JSON.stringify(manifest, null, "\t"))
                })
            );
        }

        // Issue #50 extnames extended
        Object.keys(manifest).forEach(function (key) {
            const expMapedPattern = _mapExtnames(key, opts);
            if (key != expMapedPattern && !~Object.keys(manifest).indexOf(expMapedPattern)) {
                manifest[expMapedPattern] = _mapExtnames(manifest[key], opts);
            }
        });

        for (const key in manifest) {
            const patterns = [escPathPattern(key)];

            if (opts.replaceReved) {
                let patternExt = path.extname(key);
                if (patternExt in opts.extMap) {
                    patternExt = '(' + escPathPattern(patternExt) + '|' + escPathPattern(opts.extMap[patternExt]) + ')';
                } else {
                    patternExt = escPathPattern(patternExt);
                }
                patterns.push(escPathPattern((path.dirname(key) === '.' ? '' : closeDirBySep(path.dirname(key))))
                    + path.basename(key, path.extname(key))
                        .split('.')
                        .map(function (part) {
                            return escPathPattern(part) + '(' + opts.revSuffix + ')?';
                        })
                        .join('\\.')
                    + patternExt
                );
            }

            if (dirReplacements.length) {
                dirReplacements.forEach(function (dirRule) {
                    patterns.forEach(function (pattern) {
                        changes.push({
                            regexp: new RegExp(dirRule.dirRX + pattern, 'g'),
                            patternLength: (dirRule.dirRX + pattern).length,
                            replacement: _.isFunction(dirRule.dirRpl)
                                ? dirRule.dirRpl(manifest[key])
                                : closeDirBySep(dirRule.dirRpl) + manifest[key]
                        });
                    });
                });
            } else {
                patterns.forEach(function (pattern) {
                    // without dirReplacements we must leave asset filenames with prefixes in its original state
                    // let prefixDelim = '([\/\\\\\'"';
                    // // if dir part in pattern exists, all exsotoic symbols should be correct processed using dirReplacements
                    // if (/[\\\\\/]/.test(pattern)) {
                    //     prefixDelim += '\(=';
                    // } else {
                    //     if (!/[\(\)]/.test(pattern)) {
                    //         prefixDelim += '\(';
                    //     }
                    //     if (!~pattern.indexOf('=')) {
                    //         prefixDelim += '=';
                    //     }
                    // }
                    // prefixDelim += '])';
                    let prefixDelim = `(\=\"|url\\([\'\"]*)[\/\.\\w]*`
                    changes.push({
                        regexp: new RegExp(prefixDelim + pattern + `(\\?${opts.remark || 'v'}=\\w{10})?`, 'g'),
                        patternLength: pattern.length,
                        replacement: '$1' + manifest[key]
                    });
                });
            }
        }

        // Replace longer patterns first
        // e.g. match `script.js.map` before `script.js`
        changes.sort(
            function (a, b) {
                return b.patternLength - a.patternLength;
            }
        );
        mutables.forEach(function (file) {
            if (!file.isNull()) {
                let src = file.contents.toString('utf8');
                changes.forEach(function (r) {
                    src = src.replace(r.regexp, r.replacement);
                    file.contents = new Buffer(src);
                });
                this.push(file);
            }
        }, this);

        cb();
    });
}

module.exports = revCollector;
