'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var sander = require('sander');
var path = require('path');
var glob = require('glob');
var glob__default = _interopDefault(glob);
var __chunk_2 = require('./chunk-0b33a300.js');
var relative = _interopDefault(require('require-relative'));

var previous_contents = new Map();
function write_if_changed(file, code) {
    if (code !== previous_contents.get(file)) {
        previous_contents.set(file, code);
        sander.writeFileSync(file, code);
        fudge_mtime(file);
    }
}
function posixify(file) {
    return file.replace(/[/\\]/g, '/');
}
function fudge_mtime(file) {
    // need to fudge the mtime so that webpack doesn't go doolally
    var _a = sander.statSync(file), atime = _a.atime, mtime = _a.mtime;
    sander.utimesSync(file, new Date(atime.getTime() - 999999), new Date(mtime.getTime() - 999999));
}

function create_main_manifests(_a) {
    var routes = _a.routes, dev_port = _a.dev_port;
    var path_to_routes = path.relative(__chunk_2.locations.app() + "/manifest", __chunk_2.locations.routes());
    var client_manifest = generate_client(routes, path_to_routes, dev_port);
    var server_manifest = generate_server(routes, path_to_routes);
    write_if_changed(__chunk_2.locations.app() + "/manifest/client.js", client_manifest);
    write_if_changed(__chunk_2.locations.app() + "/manifest/server.js", server_manifest);
}
function create_serviceworker_manifest(_a) {
    var routes = _a.routes, client_files = _a.client_files;
    var assets = glob.sync('**', { cwd: 'assets', nodir: true });
    var code = ("\n\t\t// This file is generated by Sapper \u2014 do not edit it!\n\t\texport const timestamp = " + Date.now() + ";\n\n\t\texport const assets = [\n\t" + assets.map(function (x) { return "\"" + x + "\""; }).join(',\n\t') + "\n];\n\n\t\texport const shell = [\n\t" + client_files.map(function (x) { return "\"" + x + "\""; }).join(',\n\t') + "\n];\n\n\t\texport const routes = [\n\t" + routes.pages.filter(function (r) { return r.id !== '_error'; }).map(function (r) { return "{ pattern: " + r.pattern + " }"; }).join(',\n\t') + "\n];\n\t").replace(/^\t\t/gm, '').trim();
    write_if_changed(__chunk_2.locations.app() + "/manifest/service-worker.js", code);
}
function generate_client(routes, path_to_routes, dev_port) {
    var page_ids = new Set(routes.pages.map(function (page) { return page.id; }));
    var server_routes_to_ignore = routes.server_routes.filter(function (route) { return !page_ids.has(route.id); });
    var pages = routes.pages.filter(function (page) { return page.id !== '_error'; });
    var error_route = routes.pages.find(function (page) { return page.id === '_error'; });
    var code = ("\n\t\t// This file is generated by Sapper \u2014 do not edit it!\n\t\texport const routes = {\n\t\t\tignore: [" + server_routes_to_ignore.map(function (route) { return route.pattern; }).join(', ') + "],\n\n\t\t\tpages: [\n\t\t\t\t" + pages.map(function (page) {
        var file = posixify(path_to_routes + "/" + page.file);
        if (page.id === '_error') {
            return "{ error: true, load: () => import(/* webpackChunkName: \"" + page.id + "\" */ '" + file + "') }";
        }
        var params = page.params.length === 0
            ? '{}'
            : "{ " + page.params.map(function (part, i) { return part + ": match[" + (i + 1) + "]"; }).join(', ') + " }";
        return "{ pattern: " + page.pattern + ", params: " + (page.params.length > 0 ? "match" : "()") + " => (" + params + "), load: () => import(/* webpackChunkName: \"" + page.id + "\" */ '" + file + "') }";
    }).join(',\n\t\t\t\t') + "\n\t\t\t],\n\n\t\t\terror: () => import(/* webpackChunkName: '_error' */ '" + posixify(path_to_routes + "/" + error_route.file) + "')\n\t\t};").replace(/^\t\t/gm, '').trim();
    if (__chunk_2.dev()) {
        var sapper_dev_client = posixify(path.resolve(__dirname, '../sapper-dev-client.js'));
        code += ("\n\n\t\t\tif (module.hot) {\n\t\t\t\timport('" + sapper_dev_client + "').then(client => {\n\t\t\t\t\tclient.connect(" + dev_port + ");\n\t\t\t\t});\n\t\t\t}").replace(/^\t{3}/gm, '');
    }
    return code;
}
function generate_server(routes, path_to_routes) {
    var error_route = routes.pages.find(function (page) { return page.id === '_error'; });
    var imports = [].concat(routes.server_routes.map(function (route) {
        return "import * as route_" + route.id + " from '" + posixify(path_to_routes + "/" + route.file) + "';";
    }), routes.pages.map(function (page) {
        return "import page_" + page.id + " from '" + posixify(path_to_routes + "/" + page.file) + "';";
    }), "import error from '" + posixify(path_to_routes + "/" + error_route.file) + "';");
    var code = ("\n\t\t// This file is generated by Sapper \u2014 do not edit it!\n\t\t" + imports.join('\n') + "\n\n\t\texport const routes = {\n\t\t\tserver_routes: [\n\t\t\t\t" + routes.server_routes.map(function (route) {
        var params = route.params.length === 0
            ? '{}'
            : "{ " + route.params.map(function (part, i) { return part + ": match[" + (i + 1) + "]"; }).join(', ') + " }";
        return "{ id: '" + route.id + "', pattern: " + route.pattern + ", params: " + (route.params.length > 0 ? "match" : "()") + " => (" + params + "), handlers: route_" + route.id + " }";
    }).join(',\n\t\t\t\t') + "\n\t\t\t],\n\n\t\t\tpages: [\n\t\t\t\t" + routes.pages.map(function (page) {
        var params = page.params.length === 0
            ? '{}'
            : "{ " + page.params.map(function (part, i) { return part + ": match[" + (i + 1) + "]"; }).join(', ') + " }";
        return "{ id: '" + page.id + "', pattern: " + page.pattern + ", params: " + (page.params.length > 0 ? "match" : "()") + " => (" + params + "), handler: page_" + page.id + " }";
    }).join(',\n\t\t\t\t') + "\n\t\t\t],\n\n\t\t\terror: {\n\t\t\t\terror: true,\n\t\t\t\thandler: error\n\t\t\t}\n\t\t};").replace(/^\t\t/gm, '').trim();
    return code;
}

function create_compilers(_a) {
    var webpack = _a.webpack;
    var wp = relative('webpack', process.cwd());
    var serviceworker_config = try_require(path.resolve(webpack + "/service-worker.config.js"));
    return {
        client: wp(require(path.resolve(webpack + "/client.config.js"))),
        server: wp(require(path.resolve(webpack + "/server.config.js"))),
        serviceworker: serviceworker_config && wp(serviceworker_config)
    };
}
function try_require(specifier) {
    try {
        return require(specifier);
    }
    catch (err) {
        if (err.code === 'MODULE_NOT_FOUND')
            return null;
        throw err;
    }
}

function create_routes(_a) {
    var files = (_a === void 0 ? {
        files: glob__default.sync('**/*.*', {
            cwd: __chunk_2.locations.routes(),
            dot: true,
            nodir: true
        })
    } : _a).files;
    var all_routes = files
        .filter(function (file) { return !/(^|\/|\\)(_(?!error\.html)|\.(?!well-known))/.test(file); })
        .map(function (file) {
        if (/]\[/.test(file)) {
            throw new Error("Invalid route " + file + " \u2014 parameters must be separated");
        }
        if (file === '4xx.html' || file === '5xx.html') {
            throw new Error('As of Sapper 0.14, 4xx.html and 5xx.html should be replaced with _error.html');
        }
        var base = file.replace(/\.[^/.]+$/, '');
        var parts = base.split('/'); // glob output is always posix-style
        if (/^index(\..+)?/.test(parts[parts.length - 1])) {
            var part = parts.pop();
            if (parts.length > 0)
                parts[parts.length - 1] += part.slice(5);
        }
        var id = (parts.join('_').replace(/[[\]]/g, '$').replace(/^\d/, '_$&').replace(/[^a-zA-Z0-9_$]/g, '_')) || '_';
        var type = file.endsWith('.html') ? 'page' : 'route';
        var params = [];
        var match_patterns = {};
        var param_pattern = /\[([^\(\]]+)(?:\((.+?)\))?\]/g;
        var match;
        while (match = param_pattern.exec(base)) {
            params.push(match[1]);
            if (typeof match[2] !== 'undefined') {
                if (/[\(\)\?\:]/.exec(match[2])) {
                    throw new Error('Sapper does not allow (, ), ? or : in RegExp routes yet');
                }
                // Make a map of the regexp patterns
                match_patterns[match[1]] = "(" + match[2] + "?)";
            }
        }
        // TODO can we do all this with sub-parts? or does
        // nesting make that impossible?
        var pattern_string = '';
        var i = parts.length;
        var nested = true;
        var _loop_1 = function () {
            var part = encodeURI(parts[i].normalize()).replace(/\?/g, '%3F').replace(/#/g, '%23').replace(/%5B/g, '[').replace(/%5D/g, ']');
            var dynamic = ~part.indexOf('[');
            if (dynamic) {
                // Get keys from part and replace with stored match patterns
                var keys = part.replace(/\(.*?\)/, '').split(/[\[\]]/).filter(function (x, i) { if (i % 2)
                    return x; });
                var matcher_1 = part;
                keys.forEach(function (k) {
                    var key_pattern = new RegExp('\\[' + k + '(?:\\((.+?)\\))?\\]');
                    matcher_1 = matcher_1.replace(key_pattern, match_patterns[k] || "([^/]+?)");
                });
                pattern_string = (nested && type === 'page') ? "(?:\\/" + matcher_1 + pattern_string + ")?" : "\\/" + matcher_1 + pattern_string;
            }
            else {
                nested = false;
                pattern_string = "\\/" + part + pattern_string;
            }
        };
        while (i--) {
            _loop_1();
        }
        var pattern = new RegExp("^" + pattern_string + "\\/?$");
        var test = function (url) { return pattern.test(url); };
        var exec = function (url) {
            var match = pattern.exec(url);
            if (!match)
                return;
            var result = {};
            params.forEach(function (param, i) {
                result[param] = match[i + 1];
            });
            return result;
        };
        return {
            id: id,
            base: base,
            type: type,
            file: file,
            pattern: pattern,
            test: test,
            exec: exec,
            parts: parts,
            params: params
        };
    });
    var pages = all_routes
        .filter(function (r) { return r.type === 'page'; })
        .sort(comparator);
    var server_routes = all_routes
        .filter(function (r) { return r.type === 'route'; })
        .sort(comparator);
    return { pages: pages, server_routes: server_routes };
}
function comparator(a, b) {
    if (a.parts[0] === '_error')
        return -1;
    if (b.parts[0] === '_error')
        return 1;
    var max = Math.max(a.parts.length, b.parts.length);
    for (var i = 0; i < max; i += 1) {
        var a_part = a.parts[i];
        var b_part = b.parts[i];
        if (!a_part)
            return -1;
        if (!b_part)
            return 1;
        var a_sub_parts = get_sub_parts(a_part);
        var b_sub_parts = get_sub_parts(b_part);
        var max_1 = Math.max(a_sub_parts.length, b_sub_parts.length);
        for (var i_1 = 0; i_1 < max_1; i_1 += 1) {
            var a_sub_part = a_sub_parts[i_1];
            var b_sub_part = b_sub_parts[i_1];
            if (!a_sub_part)
                return 1; // b is more specific, so goes first
            if (!b_sub_part)
                return -1;
            if (a_sub_part.dynamic !== b_sub_part.dynamic) {
                return a_sub_part.dynamic ? 1 : -1;
            }
            if (!a_sub_part.dynamic && a_sub_part.content !== b_sub_part.content) {
                return ((b_sub_part.content.length - a_sub_part.content.length) ||
                    (a_sub_part.content < b_sub_part.content ? -1 : 1));
            }
            // If both parts dynamic, check for regexp patterns
            if (a_sub_part.dynamic && b_sub_part.dynamic) {
                var regexp_pattern = /\((.*?)\)/;
                var a_match = regexp_pattern.exec(a_sub_part.content);
                var b_match = regexp_pattern.exec(b_sub_part.content);
                if (!a_match && b_match) {
                    return 1; // No regexp, so less specific than b
                }
                if (!b_match && a_match) {
                    return -1;
                }
                if (a_match && b_match && a_match[1] !== b_match[1]) {
                    return b_match[1].length - a_match[1].length;
                }
            }
        }
    }
    throw new Error("The " + a.base + " and " + b.base + " routes clash");
}
function get_sub_parts(part) {
    return part.split(/\[(.+)\]/)
        .map(function (content, i) {
        if (!content)
            return null;
        return {
            content: content,
            dynamic: i % 2 === 1
        };
    })
        .filter(Boolean);
}

exports.create_compilers = create_compilers;
exports.create_routes = create_routes;
exports.create_main_manifests = create_main_manifests;
exports.create_serviceworker_manifest = create_serviceworker_manifest;
//# sourceMappingURL=core.ts.js.map
