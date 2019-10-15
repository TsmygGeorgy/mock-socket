(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.Mock = global.Mock || {})));
}(this, (function (exports) { 'use strict';

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

/**
 * Check if we're required to add a port number.
 *
 * @see https://url.spec.whatwg.org/#default-port
 * @param {Number|String} port Port number we need to check
 * @param {String} protocol Protocol we need to check against.
 * @returns {Boolean} Is it a default port for the given protocol
 * @api private
 */
var requiresPort = function required(port, protocol) {
  protocol = protocol.split(':')[0];
  port = +port;

  if (!port) { return false; }

  switch (protocol) {
    case 'http':
    case 'ws':
    return port !== 80;

    case 'https':
    case 'wss':
    return port !== 443;

    case 'ftp':
    return port !== 21;

    case 'gopher':
    return port !== 70;

    case 'file':
    return false;
  }

  return port !== 0;
};

var has = Object.prototype.hasOwnProperty;
var undef;

/**
 * Decode a URI encoded string.
 *
 * @param {String} input The URI encoded string.
 * @returns {String|Null} The decoded string.
 * @api private
 */
function decode(input) {
  try {
    return decodeURIComponent(input.replace(/\+/g, ' '));
  } catch (e) {
    return null;
  }
}

/**
 * Simple query string parser.
 *
 * @param {String} query The query string that needs to be parsed.
 * @returns {Object}
 * @api public
 */
function querystring(query) {
  var parser = /([^=?&]+)=?([^&]*)/g
    , result = {}
    , part;

  while (part = parser.exec(query)) {
    var key = decode(part[1])
      , value = decode(part[2]);

    //
    // Prevent overriding of existing properties. This ensures that build-in
    // methods like `toString` or __proto__ are not overriden by malicious
    // querystrings.
    //
    // In the case if failed decoding, we want to omit the key/value pairs
    // from the result.
    //
    if (key === null || value === null || key in result) { continue; }
    result[key] = value;
  }

  return result;
}

/**
 * Transform a query string to an object.
 *
 * @param {Object} obj Object that should be transformed.
 * @param {String} prefix Optional prefix.
 * @returns {String}
 * @api public
 */
function querystringify(obj, prefix) {
  prefix = prefix || '';

  var pairs = []
    , value
    , key;

  //
  // Optionally prefix with a '?' if needed
  //
  if ('string' !== typeof prefix) { prefix = '?'; }

  for (key in obj) {
    if (has.call(obj, key)) {
      value = obj[key];

      //
      // Edge cases where we actually want to encode the value to an empty
      // string instead of the stringified value.
      //
      if (!value && (value === null || value === undef || isNaN(value))) {
        value = '';
      }

      key = encodeURIComponent(key);
      value = encodeURIComponent(value);

      //
      // If we failed to encode the strings, we should bail out as we don't
      // want to add invalid strings to the query.
      //
      if (key === null || value === null) { continue; }
      pairs.push(key +'='+ value);
    }
  }

  return pairs.length ? prefix + pairs.join('&') : '';
}

//
// Expose the module.
//
var stringify = querystringify;
var parse = querystring;

var querystringify_1 = {
	stringify: stringify,
	parse: parse
};

var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;
var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\S\s]*)/i;
var whitespace = '[\\x09\\x0A\\x0B\\x0C\\x0D\\x20\\xA0\\u1680\\u180E\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u202F\\u205F\\u3000\\u2028\\u2029\\uFEFF]';
var left = new RegExp('^'+ whitespace +'+');

/**
 * Trim a given string.
 *
 * @param {String} str String to trim.
 * @public
 */
function trimLeft(str) {
  return (str ? str : '').toString().replace(left, '');
}

/**
 * These are the parse rules for the URL parser, it informs the parser
 * about:
 *
 * 0. The char it Needs to parse, if it's a string it should be done using
 *    indexOf, RegExp using exec and NaN means set as current value.
 * 1. The property we should set when parsing this value.
 * 2. Indication if it's backwards or forward parsing, when set as number it's
 *    the value of extra chars that should be split off.
 * 3. Inherit from location if non existing in the parser.
 * 4. `toLowerCase` the resulting value.
 */
var rules = [
  ['#', 'hash'],                        // Extract from the back.
  ['?', 'query'],                       // Extract from the back.
  function sanitize(address) {          // Sanitize what is left of the address
    return address.replace('\\', '/');
  },
  ['/', 'pathname'],                    // Extract from the back.
  ['@', 'auth', 1],                     // Extract from the front.
  [NaN, 'host', undefined, 1, 1],       // Set left over value.
  [/:(\d+)$/, 'port', undefined, 1],    // RegExp the back.
  [NaN, 'hostname', undefined, 1, 1]    // Set left over.
];

/**
 * These properties should not be copied or inherited from. This is only needed
 * for all non blob URL's as a blob URL does not include a hash, only the
 * origin.
 *
 * @type {Object}
 * @private
 */
var ignore = { hash: 1, query: 1 };

/**
 * The location object differs when your code is loaded through a normal page,
 * Worker or through a worker using a blob. And with the blobble begins the
 * trouble as the location object will contain the URL of the blob, not the
 * location of the page where our code is loaded in. The actual origin is
 * encoded in the `pathname` so we can thankfully generate a good "default"
 * location from it so we can generate proper relative URL's again.
 *
 * @param {Object|String} loc Optional default location object.
 * @returns {Object} lolcation object.
 * @public
 */
function lolcation(loc) {
  var globalVar;

  if (typeof window !== 'undefined') { globalVar = window; }
  else if (typeof commonjsGlobal !== 'undefined') { globalVar = commonjsGlobal; }
  else if (typeof self !== 'undefined') { globalVar = self; }
  else { globalVar = {}; }

  var location = globalVar.location || {};
  loc = loc || location;

  var finaldestination = {}
    , type = typeof loc
    , key;

  if ('blob:' === loc.protocol) {
    finaldestination = new Url(unescape(loc.pathname), {});
  } else if ('string' === type) {
    finaldestination = new Url(loc, {});
    for (key in ignore) { delete finaldestination[key]; }
  } else if ('object' === type) {
    for (key in loc) {
      if (key in ignore) { continue; }
      finaldestination[key] = loc[key];
    }

    if (finaldestination.slashes === undefined) {
      finaldestination.slashes = slashes.test(loc.href);
    }
  }

  return finaldestination;
}

/**
 * @typedef ProtocolExtract
 * @type Object
 * @property {String} protocol Protocol matched in the URL, in lowercase.
 * @property {Boolean} slashes `true` if protocol is followed by "//", else `false`.
 * @property {String} rest Rest of the URL that is not part of the protocol.
 */

/**
 * Extract protocol information from a URL with/without double slash ("//").
 *
 * @param {String} address URL we want to extract from.
 * @return {ProtocolExtract} Extracted information.
 * @private
 */
function extractProtocol(address) {
  address = trimLeft(address);
  var match = protocolre.exec(address);

  return {
    protocol: match[1] ? match[1].toLowerCase() : '',
    slashes: !!match[2],
    rest: match[3]
  };
}

/**
 * Resolve a relative URL pathname against a base URL pathname.
 *
 * @param {String} relative Pathname of the relative URL.
 * @param {String} base Pathname of the base URL.
 * @return {String} Resolved pathname.
 * @private
 */
function resolve(relative, base) {
  if (relative === '') { return base; }

  var path = (base || '/').split('/').slice(0, -1).concat(relative.split('/'))
    , i = path.length
    , last = path[i - 1]
    , unshift = false
    , up = 0;

  while (i--) {
    if (path[i] === '.') {
      path.splice(i, 1);
    } else if (path[i] === '..') {
      path.splice(i, 1);
      up++;
    } else if (up) {
      if (i === 0) { unshift = true; }
      path.splice(i, 1);
      up--;
    }
  }

  if (unshift) { path.unshift(''); }
  if (last === '.' || last === '..') { path.push(''); }

  return path.join('/');
}

/**
 * The actual URL instance. Instead of returning an object we've opted-in to
 * create an actual constructor as it's much more memory efficient and
 * faster and it pleases my OCD.
 *
 * It is worth noting that we should not use `URL` as class name to prevent
 * clashes with the global URL instance that got introduced in browsers.
 *
 * @constructor
 * @param {String} address URL we want to parse.
 * @param {Object|String} [location] Location defaults for relative paths.
 * @param {Boolean|Function} [parser] Parser for the query string.
 * @private
 */
function Url(address, location, parser) {
  address = trimLeft(address);

  if (!(this instanceof Url)) {
    return new Url(address, location, parser);
  }

  var relative, extracted, parse, instruction, index, key
    , instructions = rules.slice()
    , type = typeof location
    , url = this
    , i = 0;

  //
  // The following if statements allows this module two have compatibility with
  // 2 different API:
  //
  // 1. Node.js's `url.parse` api which accepts a URL, boolean as arguments
  //    where the boolean indicates that the query string should also be parsed.
  //
  // 2. The `URL` interface of the browser which accepts a URL, object as
  //    arguments. The supplied object will be used as default values / fall-back
  //    for relative paths.
  //
  if ('object' !== type && 'string' !== type) {
    parser = location;
    location = null;
  }

  if (parser && 'function' !== typeof parser) { parser = querystringify_1.parse; }

  location = lolcation(location);

  //
  // Extract protocol information before running the instructions.
  //
  extracted = extractProtocol(address || '');
  relative = !extracted.protocol && !extracted.slashes;
  url.slashes = extracted.slashes || relative && location.slashes;
  url.protocol = extracted.protocol || location.protocol || '';
  address = extracted.rest;

  //
  // When the authority component is absent the URL starts with a path
  // component.
  //
  if (!extracted.slashes) { instructions[3] = [/(.*)/, 'pathname']; }

  for (; i < instructions.length; i++) {
    instruction = instructions[i];

    if (typeof instruction === 'function') {
      address = instruction(address);
      continue;
    }

    parse = instruction[0];
    key = instruction[1];

    if (parse !== parse) {
      url[key] = address;
    } else if ('string' === typeof parse) {
      if (~(index = address.indexOf(parse))) {
        if ('number' === typeof instruction[2]) {
          url[key] = address.slice(0, index);
          address = address.slice(index + instruction[2]);
        } else {
          url[key] = address.slice(index);
          address = address.slice(0, index);
        }
      }
    } else if ((index = parse.exec(address))) {
      url[key] = index[1];
      address = address.slice(0, index.index);
    }

    url[key] = url[key] || (
      relative && instruction[3] ? location[key] || '' : ''
    );

    //
    // Hostname, host and protocol should be lowercased so they can be used to
    // create a proper `origin`.
    //
    if (instruction[4]) { url[key] = url[key].toLowerCase(); }
  }

  //
  // Also parse the supplied query string in to an object. If we're supplied
  // with a custom parser as function use that instead of the default build-in
  // parser.
  //
  if (parser) { url.query = parser(url.query); }

  //
  // If the URL is relative, resolve the pathname against the base URL.
  //
  if (
      relative
    && location.slashes
    && url.pathname.charAt(0) !== '/'
    && (url.pathname !== '' || location.pathname !== '')
  ) {
    url.pathname = resolve(url.pathname, location.pathname);
  }

  //
  // We should not add port numbers if they are already the default port number
  // for a given protocol. As the host also contains the port number we're going
  // override it with the hostname which contains no port number.
  //
  if (!requiresPort(url.port, url.protocol)) {
    url.host = url.hostname;
    url.port = '';
  }

  //
  // Parse down the `auth` for the username and password.
  //
  url.username = url.password = '';
  if (url.auth) {
    instruction = url.auth.split(':');
    url.username = instruction[0] || '';
    url.password = instruction[1] || '';
  }

  url.origin = url.protocol && url.host && url.protocol !== 'file:'
    ? url.protocol +'//'+ url.host
    : 'null';

  //
  // The href is just the compiled result.
  //
  url.href = url.toString();
}

/**
 * This is convenience method for changing properties in the URL instance to
 * insure that they all propagate correctly.
 *
 * @param {String} part          Property we need to adjust.
 * @param {Mixed} value          The newly assigned value.
 * @param {Boolean|Function} fn  When setting the query, it will be the function
 *                               used to parse the query.
 *                               When setting the protocol, double slash will be
 *                               removed from the final url if it is true.
 * @returns {URL} URL instance for chaining.
 * @public
 */
function set(part, value, fn) {
  var url = this;

  switch (part) {
    case 'query':
      if ('string' === typeof value && value.length) {
        value = (fn || querystringify_1.parse)(value);
      }

      url[part] = value;
      break;

    case 'port':
      url[part] = value;

      if (!requiresPort(value, url.protocol)) {
        url.host = url.hostname;
        url[part] = '';
      } else if (value) {
        url.host = url.hostname +':'+ value;
      }

      break;

    case 'hostname':
      url[part] = value;

      if (url.port) { value += ':'+ url.port; }
      url.host = value;
      break;

    case 'host':
      url[part] = value;

      if (/:\d+$/.test(value)) {
        value = value.split(':');
        url.port = value.pop();
        url.hostname = value.join(':');
      } else {
        url.hostname = value;
        url.port = '';
      }

      break;

    case 'protocol':
      url.protocol = value.toLowerCase();
      url.slashes = !fn;
      break;

    case 'pathname':
    case 'hash':
      if (value) {
        var char = part === 'pathname' ? '/' : '#';
        url[part] = value.charAt(0) !== char ? char + value : value;
      } else {
        url[part] = value;
      }
      break;

    default:
      url[part] = value;
  }

  for (var i = 0; i < rules.length; i++) {
    var ins = rules[i];

    if (ins[4]) { url[ins[1]] = url[ins[1]].toLowerCase(); }
  }

  url.origin = url.protocol && url.host && url.protocol !== 'file:'
    ? url.protocol +'//'+ url.host
    : 'null';

  url.href = url.toString();

  return url;
}

/**
 * Transform the properties back in to a valid and full URL string.
 *
 * @param {Function} stringify Optional query stringify function.
 * @returns {String} Compiled version of the URL.
 * @public
 */
function toString(stringify) {
  if (!stringify || 'function' !== typeof stringify) { stringify = querystringify_1.stringify; }

  var query
    , url = this
    , protocol = url.protocol;

  if (protocol && protocol.charAt(protocol.length - 1) !== ':') { protocol += ':'; }

  var result = protocol + (url.slashes ? '//' : '');

  if (url.username) {
    result += url.username;
    if (url.password) { result += ':'+ url.password; }
    result += '@';
  }

  result += url.host + url.pathname;

  query = 'object' === typeof url.query ? stringify(url.query) : url.query;
  if (query) { result += '?' !== query.charAt(0) ? '?'+ query : query; }

  if (url.hash) { result += url.hash; }

  return result;
}

Url.prototype = { set: set, toString: toString };

//
// Expose the URL parser and some additional properties that might be useful for
// others or testing.
//
Url.extractProtocol = extractProtocol;
Url.location = lolcation;
Url.trimLeft = trimLeft;
Url.qs = querystringify_1;

var urlParse = Url;

/*
 * This delay allows the thread to finish assigning its on* methods
 * before invoking the delay callback. This is purely a timing hack.
 * http://geekabyte.blogspot.com/2014/01/javascript-effect-of-setting-settimeout.html
 *
 * @param {callback: function} the callback which will be invoked after the timeout
 * @parma {context: object} the context in which to invoke the function
 */
function delay(callback, context) {
  setTimeout(function (timeoutContext) { return callback.call(timeoutContext); }, 4, context);
}

function log(method, message) {
  /* eslint-disable no-console */
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console[method].call(null, message);
  }
  /* eslint-enable no-console */
}

function reject(array, callback) {
  var results = [];
  array.forEach(function (itemInArray) {
    if (!callback(itemInArray)) {
      results.push(itemInArray);
    }
  });

  return results;
}

function filter(array, callback) {
  var results = [];
  array.forEach(function (itemInArray) {
    if (callback(itemInArray)) {
      results.push(itemInArray);
    }
  });

  return results;
}

/*
 * EventTarget is an interface implemented by objects that can
 * receive events and may have listeners for them.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
var EventTarget = function EventTarget() {
  this.listeners = {};
};

/*
 * Ties a listener function to an event type which can later be invoked via the
 * dispatchEvent method.
 *
 * @param {string} type - the type of event (ie: 'open', 'message', etc.)
 * @param {function} listener - callback function to invoke when an event is dispatched matching the type
 * @param {boolean} useCapture - N/A TODO: implement useCapture functionality
 */
EventTarget.prototype.addEventListener = function addEventListener (type, listener /* , useCapture */) {
  if (typeof listener === 'function') {
    if (!Array.isArray(this.listeners[type])) {
      this.listeners[type] = [];
    }

    // Only add the same function once
    if (filter(this.listeners[type], function (item) { return item === listener; }).length === 0) {
      this.listeners[type].push(listener);
    }
  }
};

/*
 * Removes the listener so it will no longer be invoked via the dispatchEvent method.
 *
 * @param {string} type - the type of event (ie: 'open', 'message', etc.)
 * @param {function} listener - callback function to invoke when an event is dispatched matching the type
 * @param {boolean} useCapture - N/A TODO: implement useCapture functionality
 */
EventTarget.prototype.removeEventListener = function removeEventListener (type, removingListener /* , useCapture */) {
  var arrayOfListeners = this.listeners[type];
  this.listeners[type] = reject(arrayOfListeners, function (listener) { return listener === removingListener; });
};

/*
 * Invokes all listener functions that are listening to the given event.type property. Each
 * listener will be passed the event as the first argument.
 *
 * @param {object} event - event object which will be passed to all listeners of the event.type property
 */
EventTarget.prototype.dispatchEvent = function dispatchEvent (event) {
    var this$1 = this;
    var customArguments = [], len = arguments.length - 1;
    while ( len-- > 0 ) customArguments[ len ] = arguments[ len + 1 ];

  var eventName = event.type;
  var listeners = this.listeners[eventName];

  if (!Array.isArray(listeners)) {
    return false;
  }

  listeners.forEach(function (listener) {
    if (customArguments.length > 0) {
      listener.apply(this$1, customArguments);
    } else {
      listener.call(this$1, event);
    }
  });

  return true;
};

function trimQueryPartFromURL(url) {
  var queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
}

/*
 * The network bridge is a way for the mock websocket object to 'communicate' with
 * all available servers. This is a singleton object so it is important that you
 * clean up urlMap whenever you are finished.
 */
var NetworkBridge = function NetworkBridge() {
  this.urlMap = {};
};

/*
 * Attaches a websocket object to the urlMap hash so that it can find the server
 * it is connected to and the server in turn can find it.
 *
 * @param {object} websocket - websocket object to add to the urlMap hash
 * @param {string} url
 */
NetworkBridge.prototype.attachWebSocket = function attachWebSocket (websocket, url) {
  var serverURL = trimQueryPartFromURL(url);
  var connectionLookup = this.urlMap[serverURL];

  if (connectionLookup && connectionLookup.server && connectionLookup.websockets.indexOf(websocket) === -1) {
    connectionLookup.websockets.push(websocket);
    return connectionLookup.server;
  }
};

/*
 * Attaches a websocket to a room
 */
NetworkBridge.prototype.addMembershipToRoom = function addMembershipToRoom (websocket, room) {
  var connectionLookup = this.urlMap[trimQueryPartFromURL(websocket.url)];

  if (connectionLookup && connectionLookup.server && connectionLookup.websockets.indexOf(websocket) !== -1) {
    if (!connectionLookup.roomMemberships[room]) {
      connectionLookup.roomMemberships[room] = [];
    }

    connectionLookup.roomMemberships[room].push(websocket);
  }
};

/*
 * Attaches a server object to the urlMap hash so that it can find a websockets
 * which are connected to it and so that websockets can in turn can find it.
 *
 * @param {object} server - server object to add to the urlMap hash
 * @param {string} url
 */
NetworkBridge.prototype.attachServer = function attachServer (server, url) {
  var connectionLookup = this.urlMap[url];

  if (!connectionLookup) {
    this.urlMap[url] = {
      server: server,
      websockets: [],
      roomMemberships: {}
    };

    return server;
  }
};

/*
 * Finds the server which is 'running' on the given url.
 *
 * @param {string} url - the url to use to find which server is running on it
 */
NetworkBridge.prototype.serverLookup = function serverLookup (url) {
  var serverURL = trimQueryPartFromURL(url);
  var connectionLookup = this.urlMap[serverURL];

  if (connectionLookup) {
    return connectionLookup.server;
  }
};

/*
 * Finds all websockets which is 'listening' on the given url.
 *
 * @param {string} url - the url to use to find all websockets which are associated with it
 * @param {string} room - if a room is provided, will only return sockets in this room
 * @param {class} broadcaster - socket that is broadcasting and is to be excluded from the lookup
 */
NetworkBridge.prototype.websocketsLookup = function websocketsLookup (url, room, broadcaster) {
  var serverURL = trimQueryPartFromURL(url);
  var websockets;
  var connectionLookup = this.urlMap[serverURL];

  websockets = connectionLookup ? connectionLookup.websockets : [];

  if (room) {
    var members = connectionLookup.roomMemberships[room];
    websockets = members || [];
  }

  return broadcaster ? websockets.filter(function (websocket) { return websocket !== broadcaster; }) : websockets;
};

/*
 * Removes the entry associated with the url.
 *
 * @param {string} url
 */
NetworkBridge.prototype.removeServer = function removeServer (url) {
  delete this.urlMap[trimQueryPartFromURL(url)];
};

/*
 * Removes the individual websocket from the map of associated websockets.
 *
 * @param {object} websocket - websocket object to remove from the url map
 * @param {string} url
 */
NetworkBridge.prototype.removeWebSocket = function removeWebSocket (websocket, url) {
  var serverURL = trimQueryPartFromURL(url);
  var connectionLookup = this.urlMap[serverURL];

  if (connectionLookup) {
    connectionLookup.websockets = reject(connectionLookup.websockets, function (socket) { return socket === websocket; });
  }
};

/*
 * Removes a websocket from a room
 */
NetworkBridge.prototype.removeMembershipFromRoom = function removeMembershipFromRoom (websocket, room) {
  var connectionLookup = this.urlMap[trimQueryPartFromURL(websocket.url)];
  var memberships = connectionLookup.roomMemberships[room];

  if (connectionLookup && memberships !== null) {
    connectionLookup.roomMemberships[room] = reject(memberships, function (socket) { return socket === websocket; });
  }
};

var networkBridge = new NetworkBridge(); // Note: this is a singleton

/*
 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
 */
var CLOSE_CODES = {
  CLOSE_NORMAL: 1000,
  CLOSE_GOING_AWAY: 1001,
  CLOSE_PROTOCOL_ERROR: 1002,
  CLOSE_UNSUPPORTED: 1003,
  CLOSE_NO_STATUS: 1005,
  CLOSE_ABNORMAL: 1006,
  UNSUPPORTED_DATA: 1007,
  POLICY_VIOLATION: 1008,
  CLOSE_TOO_LARGE: 1009,
  MISSING_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  TLS_HANDSHAKE: 1015
};

var ERROR_PREFIX = {
  CONSTRUCTOR_ERROR: "Failed to construct 'WebSocket':",
  CLOSE_ERROR: "Failed to execute 'close' on 'WebSocket':",
  EVENT: {
    CONSTRUCT: "Failed to construct 'Event':",
    MESSAGE: "Failed to construct 'MessageEvent':",
    CLOSE: "Failed to construct 'CloseEvent':"
  }
};

var EventPrototype = function EventPrototype () {};

EventPrototype.prototype.stopPropagation = function stopPropagation () {};
EventPrototype.prototype.stopImmediatePropagation = function stopImmediatePropagation () {};

// if no arguments are passed then the type is set to "undefined" on
// chrome and safari.
EventPrototype.prototype.initEvent = function initEvent (type, bubbles, cancelable) {
    if ( type === void 0 ) type = 'undefined';
    if ( bubbles === void 0 ) bubbles = false;
    if ( cancelable === void 0 ) cancelable = false;

  this.type = "" + type;
  this.bubbles = Boolean(bubbles);
  this.cancelable = Boolean(cancelable);
};

var Event = (function (EventPrototype$$1) {
  function Event(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError(((ERROR_PREFIX.EVENT_ERROR) + " 1 argument required, but only 0 present."));
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError(((ERROR_PREFIX.EVENT_ERROR) + " parameter 2 ('eventInitDict') is not an object."));
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;

    this.type = "" + type;
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
  }

  if ( EventPrototype$$1 ) Event.__proto__ = EventPrototype$$1;
  Event.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  Event.prototype.constructor = Event;

  return Event;
}(EventPrototype));

var MessageEvent = (function (EventPrototype$$1) {
  function MessageEvent(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError(((ERROR_PREFIX.EVENT.MESSAGE) + " 1 argument required, but only 0 present."));
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError(((ERROR_PREFIX.EVENT.MESSAGE) + " parameter 2 ('eventInitDict') is not an object"));
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;
    var data = eventInitConfig.data;
    var origin = eventInitConfig.origin;
    var lastEventId = eventInitConfig.lastEventId;
    var ports = eventInitConfig.ports;

    this.type = "" + type;
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
    this.origin = "" + origin;
    this.ports = typeof ports === 'undefined' ? null : ports;
    this.data = typeof data === 'undefined' ? null : data;
    this.lastEventId = "" + (lastEventId || '');
  }

  if ( EventPrototype$$1 ) MessageEvent.__proto__ = EventPrototype$$1;
  MessageEvent.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  MessageEvent.prototype.constructor = MessageEvent;

  return MessageEvent;
}(EventPrototype));

var CloseEvent = (function (EventPrototype$$1) {
  function CloseEvent(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError(((ERROR_PREFIX.EVENT.CLOSE) + " 1 argument required, but only 0 present."));
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError(((ERROR_PREFIX.EVENT.CLOSE) + " parameter 2 ('eventInitDict') is not an object"));
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;
    var code = eventInitConfig.code;
    var reason = eventInitConfig.reason;
    var wasClean = eventInitConfig.wasClean;

    this.type = "" + type;
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.cancelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
    this.code = typeof code === 'number' ? parseInt(code, 10) : 0;
    this.reason = "" + (reason || '');
    this.wasClean = wasClean ? Boolean(wasClean) : false;
  }

  if ( EventPrototype$$1 ) CloseEvent.__proto__ = EventPrototype$$1;
  CloseEvent.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  CloseEvent.prototype.constructor = CloseEvent;

  return CloseEvent;
}(EventPrototype));

/*
 * Creates an Event object and extends it to allow full modification of
 * its properties.
 *
 * @param {object} config - within config you will need to pass type and optionally target
 */
function createEvent(config) {
  var type = config.type;
  var target = config.target;
  var eventObject = new Event(type);

  if (target) {
    eventObject.target = target;
    eventObject.srcElement = target;
    eventObject.currentTarget = target;
  }

  return eventObject;
}

/*
 * Creates a MessageEvent object and extends it to allow full modification of
 * its properties.
 *
 * @param {object} config - within config: type, origin, data and optionally target
 */
function createMessageEvent(config) {
  var type = config.type;
  var origin = config.origin;
  var data = config.data;
  var target = config.target;
  var messageEvent = new MessageEvent(type, {
    data: data,
    origin: origin
  });

  if (target) {
    messageEvent.target = target;
    messageEvent.srcElement = target;
    messageEvent.currentTarget = target;
  }

  return messageEvent;
}

/*
 * Creates a CloseEvent object and extends it to allow full modification of
 * its properties.
 *
 * @param {object} config - within config: type and optionally target, code, and reason
 */
function createCloseEvent(config) {
  var code = config.code;
  var reason = config.reason;
  var type = config.type;
  var target = config.target;
  var wasClean = config.wasClean;

  if (!wasClean) {
    wasClean = code === 1000;
  }

  var closeEvent = new CloseEvent(type, {
    code: code,
    reason: reason,
    wasClean: wasClean
  });

  if (target) {
    closeEvent.target = target;
    closeEvent.srcElement = target;
    closeEvent.currentTarget = target;
  }

  return closeEvent;
}

function closeWebSocketConnection(context, code, reason) {
  context.readyState = WebSocket$1.CLOSING;

  var server = networkBridge.serverLookup(context.url);
  var closeEvent = createCloseEvent({
    type: 'close',
    target: context,
    code: code,
    reason: reason
  });

  delay(function () {
    networkBridge.removeWebSocket(context, context.url);

    context.readyState = WebSocket$1.CLOSED;
    context.dispatchEvent(closeEvent);

    if (server) {
      server.dispatchEvent(closeEvent, server);
    }
  }, context);
}

function failWebSocketConnection(context, code, reason) {
  context.readyState = WebSocket$1.CLOSING;

  var server = networkBridge.serverLookup(context.url);
  var closeEvent = createCloseEvent({
    type: 'close',
    target: context,
    code: code,
    reason: reason,
    wasClean: false
  });

  var errorEvent = createEvent({
    type: 'error',
    target: context
  });

  delay(function () {
    networkBridge.removeWebSocket(context, context.url);

    context.readyState = WebSocket$1.CLOSED;
    context.dispatchEvent(errorEvent);
    context.dispatchEvent(closeEvent);

    if (server) {
      server.dispatchEvent(closeEvent, server);
    }
  }, context);
}

function normalizeSendData(data) {
  if (Object.prototype.toString.call(data) !== '[object Blob]' && !(data instanceof ArrayBuffer)) {
    data = String(data);
  }

  return data;
}

function proxyFactory(target) {
  var handler = {
    get: function get(obj, prop) {
      if (prop === 'close') {
        return function close(options) {
          if ( options === void 0 ) options = {};

          var code = options.code || CLOSE_CODES.CLOSE_NORMAL;
          var reason = options.reason || '';

          closeWebSocketConnection(target, code, reason);
        };
      }

      if (prop === 'send') {
        return function send(data) {
          data = normalizeSendData(data);

          target.dispatchEvent(
            createMessageEvent({
              type: 'message',
              data: data,
              origin: this.url,
              target: target
            })
          );
        };
      }

      if (prop === 'on') {
        return function onWrapper(type, cb) {
          target.addEventListener(("server::" + type), cb);
        };
      }

      return obj[prop];
    }
  };

  var proxy = new Proxy(target, handler);
  return proxy;
}

function lengthInUtf8Bytes(str) {
  // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
  var m = encodeURIComponent(str).match(/%[89ABab]/g);
  return str.length + (m ? m.length : 0);
}

function urlVerification(url) {
  var urlRecord = new urlParse(url);
  var pathname = urlRecord.pathname;
  var protocol = urlRecord.protocol;
  var hash = urlRecord.hash;

  if (!url) {
    throw new TypeError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " 1 argument required, but only 0 present."));
  }

  if (!pathname) {
    urlRecord.pathname = '/';
  }

  if (protocol === '') {
    throw new SyntaxError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The URL '" + (urlRecord.toString()) + "' is invalid."));
  }

  if (protocol !== 'ws:' && protocol !== 'wss:') {
    throw new SyntaxError(
      ((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The URL's scheme must be either 'ws' or 'wss'. '" + protocol + "' is not allowed.")
    );
  }

  if (hash !== '') {
    /* eslint-disable max-len */
    throw new SyntaxError(
      ((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The URL contains a fragment identifier ('" + hash + "'). Fragment identifiers are not allowed in WebSocket URLs.")
    );
    /* eslint-enable max-len */
  }

  return urlRecord.toString();
}

function protocolVerification(protocols) {
  if ( protocols === void 0 ) protocols = [];

  if (!Array.isArray(protocols) && typeof protocols !== 'string') {
    throw new SyntaxError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The subprotocol '" + (protocols.toString()) + "' is invalid."));
  }

  if (typeof protocols === 'string') {
    protocols = [protocols];
  }

  var uniq = protocols
    .map(function (p) { return ({ count: 1, protocol: p }); })
    .reduce(function (a, b) {
      a[b.protocol] = (a[b.protocol] || 0) + b.count;
      return a;
    }, {});

  var duplicates = Object.keys(uniq).filter(function (a) { return uniq[a] > 1; });

  if (duplicates.length > 0) {
    throw new SyntaxError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The subprotocol '" + (duplicates[0]) + "' is duplicated."));
  }

  return protocols;
}

/*
 * The main websocket class which is designed to mimick the native WebSocket class as close
 * as possible.
 *
 * https://html.spec.whatwg.org/multipage/web-sockets.html
 */
var WebSocket$1 = (function (EventTarget$$1) {
  function WebSocket(url, protocols) {
    EventTarget$$1.call(this);

    this.url = urlVerification(url);
    protocols = protocolVerification(protocols);
    this.protocol = protocols[0] || '';

    this.binaryType = 'blob';
    this.readyState = WebSocket.CONNECTING;

    var server = networkBridge.attachWebSocket(this, this.url);

    /*
     * This delay is needed so that we dont trigger an event before the callbacks have been
     * setup. For example:
     *
     * var socket = new WebSocket('ws://localhost');
     *
     * If we dont have the delay then the event would be triggered right here and this is
     * before the onopen had a chance to register itself.
     *
     * socket.onopen = () => { // this would never be called };
     *
     * and with the delay the event gets triggered here after all of the callbacks have been
     * registered :-)
     */
    delay(function delayCallback() {
      if (server) {
        if (
          server.options.verifyClient &&
          typeof server.options.verifyClient === 'function' &&
          !server.options.verifyClient()
        ) {
          this.readyState = WebSocket.CLOSED;

          log(
            'error',
            ("WebSocket connection to '" + (this.url) + "' failed: HTTP Authentication failed; no valid credentials available")
          );

          networkBridge.removeWebSocket(this, this.url);
          this.dispatchEvent(createEvent({ type: 'error', target: this }));
          this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: CLOSE_CODES.CLOSE_NORMAL }));
        } else {
          if (server.options.selectProtocol && typeof server.options.selectProtocol === 'function') {
            var selectedProtocol = server.options.selectProtocol(protocols);
            var isFilled = selectedProtocol !== '';
            var isRequested = protocols.indexOf(selectedProtocol) !== -1;
            if (isFilled && !isRequested) {
              this.readyState = WebSocket.CLOSED;

              log('error', ("WebSocket connection to '" + (this.url) + "' failed: Invalid Sub-Protocol"));

              networkBridge.removeWebSocket(this, this.url);
              this.dispatchEvent(createEvent({ type: 'error', target: this }));
              this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: CLOSE_CODES.CLOSE_NORMAL }));
              return;
            }
            this.protocol = selectedProtocol;
          }
          this.readyState = WebSocket.OPEN;
          this.dispatchEvent(createEvent({ type: 'open', target: this }));
          server.dispatchEvent(createEvent({ type: 'connection' }), proxyFactory(this));
        }
      } else {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(createEvent({ type: 'error', target: this }));
        this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: CLOSE_CODES.CLOSE_NORMAL }));

        log('error', ("WebSocket connection to '" + (this.url) + "' failed"));
      }
    }, this);
  }

  if ( EventTarget$$1 ) WebSocket.__proto__ = EventTarget$$1;
  WebSocket.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  WebSocket.prototype.constructor = WebSocket;

  var prototypeAccessors = { onopen: {},onmessage: {},onclose: {},onerror: {} };

  prototypeAccessors.onopen.get = function () {
    return this.listeners.open;
  };

  prototypeAccessors.onmessage.get = function () {
    return this.listeners.message;
  };

  prototypeAccessors.onclose.get = function () {
    return this.listeners.close;
  };

  prototypeAccessors.onerror.get = function () {
    return this.listeners.error;
  };

  prototypeAccessors.onopen.set = function (listener) {
    delete this.listeners.open;
    this.addEventListener('open', listener);
  };

  prototypeAccessors.onmessage.set = function (listener) {
    delete this.listeners.message;
    this.addEventListener('message', listener);
  };

  prototypeAccessors.onclose.set = function (listener) {
    delete this.listeners.close;
    this.addEventListener('close', listener);
  };

  prototypeAccessors.onerror.set = function (listener) {
    delete this.listeners.error;
    this.addEventListener('error', listener);
  };

  WebSocket.prototype.send = function send (data) {
    var this$1 = this;

    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
      throw new Error('WebSocket is already in CLOSING or CLOSED state');
    }

    // TODO: handle bufferedAmount

    var messageEvent = createMessageEvent({
      type: 'server::message',
      origin: this.url,
      data: normalizeSendData(data)
    });

    var server = networkBridge.serverLookup(this.url);

    if (server) {
      delay(function () {
        this$1.dispatchEvent(messageEvent, data);
      }, server);
    }
  };

  WebSocket.prototype.close = function close (code, reason) {
    if (code !== undefined) {
      if (typeof code !== 'number' || (code !== 1000 && (code < 3000 || code > 4999))) {
        throw new TypeError(
          ((ERROR_PREFIX.CLOSE_ERROR) + " The code must be either 1000, or between 3000 and 4999. " + code + " is neither.")
        );
      }
    }

    if (reason !== undefined) {
      var length = lengthInUtf8Bytes(reason);

      if (length > 123) {
        throw new SyntaxError(((ERROR_PREFIX.CLOSE_ERROR) + " The message must not be greater than 123 bytes."));
      }
    }

    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
      return;
    }

    if (this.readyState === WebSocket.CONNECTING) {
      failWebSocketConnection(this, code, reason);
    } else {
      closeWebSocketConnection(this, code, reason);
    }
  };

  Object.defineProperties( WebSocket.prototype, prototypeAccessors );

  return WebSocket;
}(EventTarget));

WebSocket$1.CONNECTING = 0;
WebSocket$1.prototype.CONNECTING = WebSocket$1.CONNECTING;
WebSocket$1.OPEN = 1;
WebSocket$1.prototype.OPEN = WebSocket$1.OPEN;
WebSocket$1.CLOSING = 2;
WebSocket$1.prototype.CLOSING = WebSocket$1.CLOSING;
WebSocket$1.CLOSED = 3;
WebSocket$1.prototype.CLOSED = WebSocket$1.CLOSED;

var dedupe = function (arr) { return arr.reduce(function (deduped, b) {
    if (deduped.indexOf(b) > -1) { return deduped; }
    return deduped.concat(b);
  }, []); };

function retrieveGlobalObject() {
  if (typeof window !== 'undefined') {
    return window;
  }

  return typeof process === 'object' && typeof require === 'function' && typeof global === 'object' ? global : this;
}

var Server$1 = (function (EventTarget$$1) {
  function Server(url, options) {
    if ( options === void 0 ) options = {};

    EventTarget$$1.call(this);
    var urlRecord = new urlParse(url);

    if (!urlRecord.pathname) {
      urlRecord.pathname = '/';
    }

    this.url = urlRecord.toString();

    this.originalWebSocket = null;
    var server = networkBridge.attachServer(this, this.url);

    if (!server) {
      this.dispatchEvent(createEvent({ type: 'error' }));
      throw new Error('A mock server is already listening on this url');
    }

    if (typeof options.verifyClient === 'undefined') {
      options.verifyClient = null;
    }

    if (typeof options.selectProtocol === 'undefined') {
      options.selectProtocol = null;
    }

    this.options = options;
    this.start();
  }

  if ( EventTarget$$1 ) Server.__proto__ = EventTarget$$1;
  Server.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  Server.prototype.constructor = Server;

  /*
   * Attaches the mock websocket object to the global object
   */
  Server.prototype.start = function start () {
    var globalObj = retrieveGlobalObject();

    if (globalObj.WebSocket) {
      this.originalWebSocket = globalObj.WebSocket;
    }

    globalObj.WebSocket = WebSocket$1;
  };

  /*
   * Removes the mock websocket object from the global object
   */
  Server.prototype.stop = function stop (callback) {
    if ( callback === void 0 ) callback = function () {};

    var globalObj = retrieveGlobalObject();

    if (this.originalWebSocket) {
      globalObj.WebSocket = this.originalWebSocket;
    } else {
      delete globalObj.WebSocket;
    }

    this.originalWebSocket = null;

    networkBridge.removeServer(this.url);

    if (typeof callback === 'function') {
      callback();
    }
  };

  /*
   * This is the main function for the mock server to subscribe to the on events.
   *
   * ie: mockServer.on('connection', function() { console.log('a mock client connected'); });
   *
   * @param {string} type - The event key to subscribe to. Valid keys are: connection, message, and close.
   * @param {function} callback - The callback which should be called when a certain event is fired.
   */
  Server.prototype.on = function on (type, callback) {
    this.addEventListener(type, callback);
  };

  /*
   * Closes the connection and triggers the onclose method of all listening
   * websockets. After that it removes itself from the urlMap so another server
   * could add itself to the url.
   *
   * @param {object} options
   */
  Server.prototype.close = function close (options) {
    if ( options === void 0 ) options = {};

    var code = options.code;
    var reason = options.reason;
    var wasClean = options.wasClean;
    var listeners = networkBridge.websocketsLookup(this.url);

    // Remove server before notifications to prevent immediate reconnects from
    // socket onclose handlers
    networkBridge.removeServer(this.url);

    listeners.forEach(function (socket) {
      socket.readyState = WebSocket$1.CLOSE;
      socket.dispatchEvent(
        createCloseEvent({
          type: 'close',
          target: socket,
          code: code || CLOSE_CODES.CLOSE_NORMAL,
          reason: reason || '',
          wasClean: wasClean
        })
      );
    });

    this.dispatchEvent(createCloseEvent({ type: 'close' }), this);
  };

  /*
   * Sends a generic message event to all mock clients.
   */
  Server.prototype.emit = function emit (event, data, options) {
    var this$1 = this;
    if ( options === void 0 ) options = {};

    var websockets = options.websockets;

    if (!websockets) {
      websockets = networkBridge.websocketsLookup(this.url);
    }

    if (typeof options !== 'object' || arguments.length > 3) {
      data = Array.prototype.slice.call(arguments, 1, arguments.length);
      data = data.map(function (item) { return normalizeSendData(item); });
    } else {
      data = normalizeSendData(data);
    }

    websockets.forEach(function (socket) {
      if (Array.isArray(data)) {
        socket.dispatchEvent.apply(
          socket, [ createMessageEvent({
            type: event,
            data: data,
            origin: this$1.url,
            target: socket
          }) ].concat( data )
        );
      } else {
        socket.dispatchEvent(
          createMessageEvent({
            type: event,
            data: data,
            origin: this$1.url,
            target: socket
          })
        );
      }
    });
  };

  /*
   * Returns an array of websockets which are listening to this server
   * TOOD: this should return a set and not be a method
   */
  Server.prototype.clients = function clients () {
    return networkBridge.websocketsLookup(this.url);
  };

  /*
   * Prepares a method to submit an event to members of the room
   *
   * e.g. server.to('my-room').emit('hi!');
   */
  Server.prototype.to = function to (room, broadcaster, broadcastList) {
    var this$1 = this;
    if ( broadcastList === void 0 ) broadcastList = [];

    var self = this;
    var websockets = dedupe(broadcastList.concat(networkBridge.websocketsLookup(this.url, room, broadcaster)));

    return {
      to: function (chainedRoom, chainedBroadcaster) { return this$1.to.call(this$1, chainedRoom, chainedBroadcaster, websockets); },
      emit: function emit(event, data) {
        self.emit(event, data, { websockets: websockets });
      }
    };
  };

  /*
   * Alias for Server.to
   */
  Server.prototype.in = function in$1 () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return this.to.apply(null, args);
  };

  /*
   * Simulate an event from the server to the clients. Useful for
   * simulating errors.
   */
  Server.prototype.simulate = function simulate (event) {
    var listeners = networkBridge.websocketsLookup(this.url);

    if (event === 'error') {
      listeners.forEach(function (socket) {
        socket.readyState = WebSocket$1.CLOSE;
        socket.dispatchEvent(createEvent({ type: 'error' }));
      });
    }
  };

  return Server;
}(EventTarget));

/*
 * Alternative constructor to support namespaces in socket.io
 *
 * http://socket.io/docs/rooms-and-namespaces/#custom-namespaces
 */
Server$1.of = function of(url) {
  return new Server$1(url);
};

/*
 * The socket-io class is designed to mimick the real API as closely as possible.
 *
 * http://socket.io/docs/
 */
var SocketIO$1 = (function (EventTarget$$1) {
  function SocketIO(url, protocol) {
    var this$1 = this;
    if ( url === void 0 ) url = 'socket.io';
    if ( protocol === void 0 ) protocol = '';

    EventTarget$$1.call(this);

    this.binaryType = 'blob';
    var urlRecord = new urlParse(url);

    if (!urlRecord.pathname) {
      urlRecord.pathname = '/';
    }

    this.url = urlRecord.toString();
    this.readyState = SocketIO.CONNECTING;
    this.protocol = '';

    if (typeof protocol === 'string' || (typeof protocol === 'object' && protocol !== null)) {
      this.protocol = protocol;
    } else if (Array.isArray(protocol) && protocol.length > 0) {
      this.protocol = protocol[0];
    }

    var server = networkBridge.attachWebSocket(this, this.url);

    /*
     * Delay triggering the connection events so they can be defined in time.
     */
    delay(function delayCallback() {
      if (server) {
        this.readyState = SocketIO.OPEN;
        server.dispatchEvent(createEvent({ type: 'connection' }), server, this);
        server.dispatchEvent(createEvent({ type: 'connect' }), server, this); // alias
        this.dispatchEvent(createEvent({ type: 'connect', target: this }));
      } else {
        this.readyState = SocketIO.CLOSED;
        this.dispatchEvent(createEvent({ type: 'error', target: this }));
        this.dispatchEvent(
          createCloseEvent({
            type: 'close',
            target: this,
            code: CLOSE_CODES.CLOSE_NORMAL
          })
        );

        log('error', ("Socket.io connection to '" + (this.url) + "' failed"));
      }
    }, this);

    /**
      Add an aliased event listener for close / disconnect
     */
    this.addEventListener('close', function (event) {
      this$1.dispatchEvent(
        createCloseEvent({
          type: 'disconnect',
          target: event.target,
          code: event.code
        })
      );
    });
  }

  if ( EventTarget$$1 ) SocketIO.__proto__ = EventTarget$$1;
  SocketIO.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  SocketIO.prototype.constructor = SocketIO;

  var prototypeAccessors = { broadcast: {} };

  /*
   * Closes the SocketIO connection or connection attempt, if any.
   * If the connection is already CLOSED, this method does nothing.
   */
  SocketIO.prototype.close = function close () {
    if (this.readyState !== SocketIO.OPEN) {
      return undefined;
    }

    var server = networkBridge.serverLookup(this.url);
    networkBridge.removeWebSocket(this, this.url);

    this.readyState = SocketIO.CLOSED;
    this.dispatchEvent(
      createCloseEvent({
        type: 'close',
        target: this,
        code: CLOSE_CODES.CLOSE_NORMAL
      })
    );

    if (server) {
      server.dispatchEvent(
        createCloseEvent({
          type: 'disconnect',
          target: this,
          code: CLOSE_CODES.CLOSE_NORMAL
        }),
        server
      );
    }

    return this;
  };

  /*
   * Alias for Socket#close
   *
   * https://github.com/socketio/socket.io-client/blob/master/lib/socket.js#L383
   */
  SocketIO.prototype.disconnect = function disconnect () {
    return this.close();
  };

  /*
   * Submits an event to the server with a payload
   */
  SocketIO.prototype.emit = function emit (event) {
    var data = [], len = arguments.length - 1;
    while ( len-- > 0 ) data[ len ] = arguments[ len + 1 ];

    if (this.readyState !== SocketIO.OPEN) {
      throw new Error('SocketIO is already in CLOSING or CLOSED state');
    }

    var messageEvent = createMessageEvent({
      type: event,
      origin: this.url,
      data: data
    });

    var server = networkBridge.serverLookup(this.url);

    if (server) {
      server.dispatchEvent.apply(server, [ messageEvent ].concat( data ));
    }

    return this;
  };

  /*
   * Submits a 'message' event to the server.
   *
   * Should behave exactly like WebSocket#send
   *
   * https://github.com/socketio/socket.io-client/blob/master/lib/socket.js#L113
   */
  SocketIO.prototype.send = function send (data) {
    this.emit('message', data);
    return this;
  };

  /*
   * For broadcasting events to other connected sockets.
   *
   * e.g. socket.broadcast.emit('hi!');
   * e.g. socket.broadcast.to('my-room').emit('hi!');
   */
  prototypeAccessors.broadcast.get = function () {
    if (this.readyState !== SocketIO.OPEN) {
      throw new Error('SocketIO is already in CLOSING or CLOSED state');
    }

    var self = this;
    var server = networkBridge.serverLookup(this.url);
    if (!server) {
      throw new Error(("SocketIO can not find a server at the specified URL (" + (this.url) + ")"));
    }

    return {
      emit: function emit(event, data) {
        server.emit(event, data, { websockets: networkBridge.websocketsLookup(self.url, null, self) });
        return self;
      },
      to: function to(room) {
        return server.to(room, self);
      },
      in: function in$1(room) {
        return server.in(room, self);
      }
    };
  };

  /*
   * For registering events to be received from the server
   */
  SocketIO.prototype.on = function on (type, callback) {
    this.addEventListener(type, callback);
    return this;
  };

  /*
   * Remove event listener
   *
   * https://socket.io/docs/client-api/#socket-on-eventname-callback
   */
  SocketIO.prototype.off = function off (type) {
    this.removeEventListener(type);
  };

  /*
   * Join a room on a server
   *
   * http://socket.io/docs/rooms-and-namespaces/#joining-and-leaving
   */
  SocketIO.prototype.join = function join (room) {
    networkBridge.addMembershipToRoom(this, room);
  };

  /*
   * Get the websocket to leave the room
   *
   * http://socket.io/docs/rooms-and-namespaces/#joining-and-leaving
   */
  SocketIO.prototype.leave = function leave (room) {
    networkBridge.removeMembershipFromRoom(this, room);
  };

  SocketIO.prototype.to = function to (room) {
    return this.broadcast.to(room);
  };

  SocketIO.prototype.in = function in$1 () {
    return this.to.apply(null, arguments);
  };

  /*
   * Invokes all listener functions that are listening to the given event.type property. Each
   * listener will be passed the event as the first argument.
   *
   * @param {object} event - event object which will be passed to all listeners of the event.type property
   */
  SocketIO.prototype.dispatchEvent = function dispatchEvent (event) {
    var this$1 = this;
    var customArguments = [], len = arguments.length - 1;
    while ( len-- > 0 ) customArguments[ len ] = arguments[ len + 1 ];

    var eventName = event.type;
    var listeners = this.listeners[eventName];

    if (!Array.isArray(listeners)) {
      return false;
    }

    listeners.forEach(function (listener) {
      if (customArguments.length > 0) {
        listener.apply(this$1, customArguments);
      } else {
        // Regular WebSockets expect a MessageEvent but Socketio.io just wants raw data
        //  payload instanceof MessageEvent works, but you can't isntance of NodeEvent
        //  for now we detect if the output has data defined on it
        listener.call(this$1, event.data ? event.data : event);
      }
    });
  };

  Object.defineProperties( SocketIO.prototype, prototypeAccessors );

  return SocketIO;
}(EventTarget));

SocketIO$1.CONNECTING = 0;
SocketIO$1.OPEN = 1;
SocketIO$1.CLOSING = 2;
SocketIO$1.CLOSED = 3;

/*
 * Static constructor methods for the IO Socket
 */
var IO = function ioConstructor(url, protocol) {
  return new SocketIO$1(url, protocol);
};

/*
 * Alias the raw IO() constructor
 */
IO.connect = function ioConnect(url, protocol) {
  /* eslint-disable new-cap */
  return IO(url, protocol);
  /* eslint-enable new-cap */
};

var Server = Server$1;
var WebSocket = WebSocket$1;
var SocketIO = IO;

exports.Server = Server;
exports.WebSocket = WebSocket;
exports.SocketIO = SocketIO;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay1zb2NrZXQuanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9yZXF1aXJlcy1wb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5naWZ5L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3VybC1wYXJzZS9pbmRleC5qcyIsIi4uL3NyYy9oZWxwZXJzL2RlbGF5LmpzIiwiLi4vc3JjL2hlbHBlcnMvbG9nZ2VyLmpzIiwiLi4vc3JjL2hlbHBlcnMvYXJyYXktaGVscGVycy5qcyIsIi4uL3NyYy9ldmVudC90YXJnZXQuanMiLCIuLi9zcmMvbmV0d29yay1icmlkZ2UuanMiLCIuLi9zcmMvY29uc3RhbnRzLmpzIiwiLi4vc3JjL2V2ZW50L3Byb3RvdHlwZS5qcyIsIi4uL3NyYy9ldmVudC9ldmVudC5qcyIsIi4uL3NyYy9ldmVudC9tZXNzYWdlLmpzIiwiLi4vc3JjL2V2ZW50L2Nsb3NlLmpzIiwiLi4vc3JjL2V2ZW50L2ZhY3RvcnkuanMiLCIuLi9zcmMvYWxnb3JpdGhtcy9jbG9zZS5qcyIsIi4uL3NyYy9oZWxwZXJzL25vcm1hbGl6ZS1zZW5kLmpzIiwiLi4vc3JjL2hlbHBlcnMvcHJveHktZmFjdG9yeS5qcyIsIi4uL3NyYy9oZWxwZXJzL2J5dGUtbGVuZ3RoLmpzIiwiLi4vc3JjL2hlbHBlcnMvdXJsLXZlcmlmaWNhdGlvbi5qcyIsIi4uL3NyYy9oZWxwZXJzL3Byb3RvY29sLXZlcmlmaWNhdGlvbi5qcyIsIi4uL3NyYy93ZWJzb2NrZXQuanMiLCIuLi9zcmMvaGVscGVycy9kZWR1cGUuanMiLCIuLi9zcmMvaGVscGVycy9nbG9iYWwtb2JqZWN0LmpzIiwiLi4vc3JjL3NlcnZlci5qcyIsIi4uL3NyYy9zb2NrZXQtaW8uanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENoZWNrIGlmIHdlJ3JlIHJlcXVpcmVkIHRvIGFkZCBhIHBvcnQgbnVtYmVyLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly91cmwuc3BlYy53aGF0d2cub3JnLyNkZWZhdWx0LXBvcnRcbiAqIEBwYXJhbSB7TnVtYmVyfFN0cmluZ30gcG9ydCBQb3J0IG51bWJlciB3ZSBuZWVkIHRvIGNoZWNrXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvdG9jb2wgUHJvdG9jb2wgd2UgbmVlZCB0byBjaGVjayBhZ2FpbnN0LlxuICogQHJldHVybnMge0Jvb2xlYW59IElzIGl0IGEgZGVmYXVsdCBwb3J0IGZvciB0aGUgZ2l2ZW4gcHJvdG9jb2xcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHJlcXVpcmVkKHBvcnQsIHByb3RvY29sKSB7XG4gIHByb3RvY29sID0gcHJvdG9jb2wuc3BsaXQoJzonKVswXTtcbiAgcG9ydCA9ICtwb3J0O1xuXG4gIGlmICghcG9ydCkgcmV0dXJuIGZhbHNlO1xuXG4gIHN3aXRjaCAocHJvdG9jb2wpIHtcbiAgICBjYXNlICdodHRwJzpcbiAgICBjYXNlICd3cyc6XG4gICAgcmV0dXJuIHBvcnQgIT09IDgwO1xuXG4gICAgY2FzZSAnaHR0cHMnOlxuICAgIGNhc2UgJ3dzcyc6XG4gICAgcmV0dXJuIHBvcnQgIT09IDQ0MztcblxuICAgIGNhc2UgJ2Z0cCc6XG4gICAgcmV0dXJuIHBvcnQgIT09IDIxO1xuXG4gICAgY2FzZSAnZ29waGVyJzpcbiAgICByZXR1cm4gcG9ydCAhPT0gNzA7XG5cbiAgICBjYXNlICdmaWxlJzpcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gcG9ydCAhPT0gMDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG4gICwgdW5kZWY7XG5cbi8qKlxuICogRGVjb2RlIGEgVVJJIGVuY29kZWQgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgVVJJIGVuY29kZWQgc3RyaW5nLlxuICogQHJldHVybnMge1N0cmluZ3xOdWxsfSBUaGUgZGVjb2RlZCBzdHJpbmcuXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChpbnB1dC5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIEF0dGVtcHRzIHRvIGVuY29kZSBhIGdpdmVuIGlucHV0LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgc3RyaW5nIHRoYXQgbmVlZHMgdG8gYmUgZW5jb2RlZC5cbiAqIEByZXR1cm5zIHtTdHJpbmd8TnVsbH0gVGhlIGVuY29kZWQgc3RyaW5nLlxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuICB0cnkge1xuICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoaW5wdXQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBTaW1wbGUgcXVlcnkgc3RyaW5nIHBhcnNlci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcXVlcnkgVGhlIHF1ZXJ5IHN0cmluZyB0aGF0IG5lZWRzIHRvIGJlIHBhcnNlZC5cbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5mdW5jdGlvbiBxdWVyeXN0cmluZyhxdWVyeSkge1xuICB2YXIgcGFyc2VyID0gLyhbXj0/Jl0rKT0/KFteJl0qKS9nXG4gICAgLCByZXN1bHQgPSB7fVxuICAgICwgcGFydDtcblxuICB3aGlsZSAocGFydCA9IHBhcnNlci5leGVjKHF1ZXJ5KSkge1xuICAgIHZhciBrZXkgPSBkZWNvZGUocGFydFsxXSlcbiAgICAgICwgdmFsdWUgPSBkZWNvZGUocGFydFsyXSk7XG5cbiAgICAvL1xuICAgIC8vIFByZXZlbnQgb3ZlcnJpZGluZyBvZiBleGlzdGluZyBwcm9wZXJ0aWVzLiBUaGlzIGVuc3VyZXMgdGhhdCBidWlsZC1pblxuICAgIC8vIG1ldGhvZHMgbGlrZSBgdG9TdHJpbmdgIG9yIF9fcHJvdG9fXyBhcmUgbm90IG92ZXJyaWRlbiBieSBtYWxpY2lvdXNcbiAgICAvLyBxdWVyeXN0cmluZ3MuXG4gICAgLy9cbiAgICAvLyBJbiB0aGUgY2FzZSBpZiBmYWlsZWQgZGVjb2RpbmcsIHdlIHdhbnQgdG8gb21pdCB0aGUga2V5L3ZhbHVlIHBhaXJzXG4gICAgLy8gZnJvbSB0aGUgcmVzdWx0LlxuICAgIC8vXG4gICAgaWYgKGtleSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gbnVsbCB8fCBrZXkgaW4gcmVzdWx0KSBjb250aW51ZTtcbiAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYSBxdWVyeSBzdHJpbmcgdG8gYW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogT2JqZWN0IHRoYXQgc2hvdWxkIGJlIHRyYW5zZm9ybWVkLlxuICogQHBhcmFtIHtTdHJpbmd9IHByZWZpeCBPcHRpb25hbCBwcmVmaXguXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gcXVlcnlzdHJpbmdpZnkob2JqLCBwcmVmaXgpIHtcbiAgcHJlZml4ID0gcHJlZml4IHx8ICcnO1xuXG4gIHZhciBwYWlycyA9IFtdXG4gICAgLCB2YWx1ZVxuICAgICwga2V5O1xuXG4gIC8vXG4gIC8vIE9wdGlvbmFsbHkgcHJlZml4IHdpdGggYSAnPycgaWYgbmVlZGVkXG4gIC8vXG4gIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIHByZWZpeCkgcHJlZml4ID0gJz8nO1xuXG4gIGZvciAoa2V5IGluIG9iaikge1xuICAgIGlmIChoYXMuY2FsbChvYmosIGtleSkpIHtcbiAgICAgIHZhbHVlID0gb2JqW2tleV07XG5cbiAgICAgIC8vXG4gICAgICAvLyBFZGdlIGNhc2VzIHdoZXJlIHdlIGFjdHVhbGx5IHdhbnQgdG8gZW5jb2RlIHRoZSB2YWx1ZSB0byBhbiBlbXB0eVxuICAgICAgLy8gc3RyaW5nIGluc3RlYWQgb2YgdGhlIHN0cmluZ2lmaWVkIHZhbHVlLlxuICAgICAgLy9cbiAgICAgIGlmICghdmFsdWUgJiYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZiB8fCBpc05hTih2YWx1ZSkpKSB7XG4gICAgICAgIHZhbHVlID0gJyc7XG4gICAgICB9XG5cbiAgICAgIGtleSA9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuICAgICAgdmFsdWUgPSBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpO1xuXG4gICAgICAvL1xuICAgICAgLy8gSWYgd2UgZmFpbGVkIHRvIGVuY29kZSB0aGUgc3RyaW5ncywgd2Ugc2hvdWxkIGJhaWwgb3V0IGFzIHdlIGRvbid0XG4gICAgICAvLyB3YW50IHRvIGFkZCBpbnZhbGlkIHN0cmluZ3MgdG8gdGhlIHF1ZXJ5LlxuICAgICAgLy9cbiAgICAgIGlmIChrZXkgPT09IG51bGwgfHwgdmFsdWUgPT09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgcGFpcnMucHVzaChrZXkgKyc9JysgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYWlycy5sZW5ndGggPyBwcmVmaXggKyBwYWlycy5qb2luKCcmJykgOiAnJztcbn1cblxuLy9cbi8vIEV4cG9zZSB0aGUgbW9kdWxlLlxuLy9cbmV4cG9ydHMuc3RyaW5naWZ5ID0gcXVlcnlzdHJpbmdpZnk7XG5leHBvcnRzLnBhcnNlID0gcXVlcnlzdHJpbmc7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByZXF1aXJlZCA9IHJlcXVpcmUoJ3JlcXVpcmVzLXBvcnQnKVxuICAsIHFzID0gcmVxdWlyZSgncXVlcnlzdHJpbmdpZnknKVxuICAsIHNsYXNoZXMgPSAvXltBLVphLXpdW0EtWmEtejAtOSstLl0qOlxcL1xcLy9cbiAgLCBwcm90b2NvbHJlID0gL14oW2Etel1bYS16MC05ListXSo6KT8oXFwvXFwvKT8oW1xcU1xcc10qKS9pXG4gICwgd2hpdGVzcGFjZSA9ICdbXFxcXHgwOVxcXFx4MEFcXFxceDBCXFxcXHgwQ1xcXFx4MERcXFxceDIwXFxcXHhBMFxcXFx1MTY4MFxcXFx1MTgwRVxcXFx1MjAwMFxcXFx1MjAwMVxcXFx1MjAwMlxcXFx1MjAwM1xcXFx1MjAwNFxcXFx1MjAwNVxcXFx1MjAwNlxcXFx1MjAwN1xcXFx1MjAwOFxcXFx1MjAwOVxcXFx1MjAwQVxcXFx1MjAyRlxcXFx1MjA1RlxcXFx1MzAwMFxcXFx1MjAyOFxcXFx1MjAyOVxcXFx1RkVGRl0nXG4gICwgbGVmdCA9IG5ldyBSZWdFeHAoJ14nKyB3aGl0ZXNwYWNlICsnKycpO1xuXG4vKipcbiAqIFRyaW0gYSBnaXZlbiBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gdHJpbS5cbiAqIEBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gdHJpbUxlZnQoc3RyKSB7XG4gIHJldHVybiAoc3RyID8gc3RyIDogJycpLnRvU3RyaW5nKCkucmVwbGFjZShsZWZ0LCAnJyk7XG59XG5cbi8qKlxuICogVGhlc2UgYXJlIHRoZSBwYXJzZSBydWxlcyBmb3IgdGhlIFVSTCBwYXJzZXIsIGl0IGluZm9ybXMgdGhlIHBhcnNlclxuICogYWJvdXQ6XG4gKlxuICogMC4gVGhlIGNoYXIgaXQgTmVlZHMgdG8gcGFyc2UsIGlmIGl0J3MgYSBzdHJpbmcgaXQgc2hvdWxkIGJlIGRvbmUgdXNpbmdcbiAqICAgIGluZGV4T2YsIFJlZ0V4cCB1c2luZyBleGVjIGFuZCBOYU4gbWVhbnMgc2V0IGFzIGN1cnJlbnQgdmFsdWUuXG4gKiAxLiBUaGUgcHJvcGVydHkgd2Ugc2hvdWxkIHNldCB3aGVuIHBhcnNpbmcgdGhpcyB2YWx1ZS5cbiAqIDIuIEluZGljYXRpb24gaWYgaXQncyBiYWNrd2FyZHMgb3IgZm9yd2FyZCBwYXJzaW5nLCB3aGVuIHNldCBhcyBudW1iZXIgaXQnc1xuICogICAgdGhlIHZhbHVlIG9mIGV4dHJhIGNoYXJzIHRoYXQgc2hvdWxkIGJlIHNwbGl0IG9mZi5cbiAqIDMuIEluaGVyaXQgZnJvbSBsb2NhdGlvbiBpZiBub24gZXhpc3RpbmcgaW4gdGhlIHBhcnNlci5cbiAqIDQuIGB0b0xvd2VyQ2FzZWAgdGhlIHJlc3VsdGluZyB2YWx1ZS5cbiAqL1xudmFyIHJ1bGVzID0gW1xuICBbJyMnLCAnaGFzaCddLCAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgZnJvbSB0aGUgYmFjay5cbiAgWyc/JywgJ3F1ZXJ5J10sICAgICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IGZyb20gdGhlIGJhY2suXG4gIGZ1bmN0aW9uIHNhbml0aXplKGFkZHJlc3MpIHsgICAgICAgICAgLy8gU2FuaXRpemUgd2hhdCBpcyBsZWZ0IG9mIHRoZSBhZGRyZXNzXG4gICAgcmV0dXJuIGFkZHJlc3MucmVwbGFjZSgnXFxcXCcsICcvJyk7XG4gIH0sXG4gIFsnLycsICdwYXRobmFtZSddLCAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBmcm9tIHRoZSBiYWNrLlxuICBbJ0AnLCAnYXV0aCcsIDFdLCAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgZnJvbSB0aGUgZnJvbnQuXG4gIFtOYU4sICdob3N0JywgdW5kZWZpbmVkLCAxLCAxXSwgICAgICAgLy8gU2V0IGxlZnQgb3ZlciB2YWx1ZS5cbiAgWy86KFxcZCspJC8sICdwb3J0JywgdW5kZWZpbmVkLCAxXSwgICAgLy8gUmVnRXhwIHRoZSBiYWNrLlxuICBbTmFOLCAnaG9zdG5hbWUnLCB1bmRlZmluZWQsIDEsIDFdICAgIC8vIFNldCBsZWZ0IG92ZXIuXG5dO1xuXG4vKipcbiAqIFRoZXNlIHByb3BlcnRpZXMgc2hvdWxkIG5vdCBiZSBjb3BpZWQgb3IgaW5oZXJpdGVkIGZyb20uIFRoaXMgaXMgb25seSBuZWVkZWRcbiAqIGZvciBhbGwgbm9uIGJsb2IgVVJMJ3MgYXMgYSBibG9iIFVSTCBkb2VzIG5vdCBpbmNsdWRlIGEgaGFzaCwgb25seSB0aGVcbiAqIG9yaWdpbi5cbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xudmFyIGlnbm9yZSA9IHsgaGFzaDogMSwgcXVlcnk6IDEgfTtcblxuLyoqXG4gKiBUaGUgbG9jYXRpb24gb2JqZWN0IGRpZmZlcnMgd2hlbiB5b3VyIGNvZGUgaXMgbG9hZGVkIHRocm91Z2ggYSBub3JtYWwgcGFnZSxcbiAqIFdvcmtlciBvciB0aHJvdWdoIGEgd29ya2VyIHVzaW5nIGEgYmxvYi4gQW5kIHdpdGggdGhlIGJsb2JibGUgYmVnaW5zIHRoZVxuICogdHJvdWJsZSBhcyB0aGUgbG9jYXRpb24gb2JqZWN0IHdpbGwgY29udGFpbiB0aGUgVVJMIG9mIHRoZSBibG9iLCBub3QgdGhlXG4gKiBsb2NhdGlvbiBvZiB0aGUgcGFnZSB3aGVyZSBvdXIgY29kZSBpcyBsb2FkZWQgaW4uIFRoZSBhY3R1YWwgb3JpZ2luIGlzXG4gKiBlbmNvZGVkIGluIHRoZSBgcGF0aG5hbWVgIHNvIHdlIGNhbiB0aGFua2Z1bGx5IGdlbmVyYXRlIGEgZ29vZCBcImRlZmF1bHRcIlxuICogbG9jYXRpb24gZnJvbSBpdCBzbyB3ZSBjYW4gZ2VuZXJhdGUgcHJvcGVyIHJlbGF0aXZlIFVSTCdzIGFnYWluLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gbG9jIE9wdGlvbmFsIGRlZmF1bHQgbG9jYXRpb24gb2JqZWN0LlxuICogQHJldHVybnMge09iamVjdH0gbG9sY2F0aW9uIG9iamVjdC5cbiAqIEBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gbG9sY2F0aW9uKGxvYykge1xuICB2YXIgZ2xvYmFsVmFyO1xuXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgZ2xvYmFsVmFyID0gd2luZG93O1xuICBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykgZ2xvYmFsVmFyID0gZ2xvYmFsO1xuICBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIGdsb2JhbFZhciA9IHNlbGY7XG4gIGVsc2UgZ2xvYmFsVmFyID0ge307XG5cbiAgdmFyIGxvY2F0aW9uID0gZ2xvYmFsVmFyLmxvY2F0aW9uIHx8IHt9O1xuICBsb2MgPSBsb2MgfHwgbG9jYXRpb247XG5cbiAgdmFyIGZpbmFsZGVzdGluYXRpb24gPSB7fVxuICAgICwgdHlwZSA9IHR5cGVvZiBsb2NcbiAgICAsIGtleTtcblxuICBpZiAoJ2Jsb2I6JyA9PT0gbG9jLnByb3RvY29sKSB7XG4gICAgZmluYWxkZXN0aW5hdGlvbiA9IG5ldyBVcmwodW5lc2NhcGUobG9jLnBhdGhuYW1lKSwge30pO1xuICB9IGVsc2UgaWYgKCdzdHJpbmcnID09PSB0eXBlKSB7XG4gICAgZmluYWxkZXN0aW5hdGlvbiA9IG5ldyBVcmwobG9jLCB7fSk7XG4gICAgZm9yIChrZXkgaW4gaWdub3JlKSBkZWxldGUgZmluYWxkZXN0aW5hdGlvbltrZXldO1xuICB9IGVsc2UgaWYgKCdvYmplY3QnID09PSB0eXBlKSB7XG4gICAgZm9yIChrZXkgaW4gbG9jKSB7XG4gICAgICBpZiAoa2V5IGluIGlnbm9yZSkgY29udGludWU7XG4gICAgICBmaW5hbGRlc3RpbmF0aW9uW2tleV0gPSBsb2Nba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoZmluYWxkZXN0aW5hdGlvbi5zbGFzaGVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGZpbmFsZGVzdGluYXRpb24uc2xhc2hlcyA9IHNsYXNoZXMudGVzdChsb2MuaHJlZik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbmFsZGVzdGluYXRpb247XG59XG5cbi8qKlxuICogQHR5cGVkZWYgUHJvdG9jb2xFeHRyYWN0XG4gKiBAdHlwZSBPYmplY3RcbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSBwcm90b2NvbCBQcm90b2NvbCBtYXRjaGVkIGluIHRoZSBVUkwsIGluIGxvd2VyY2FzZS5cbiAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gc2xhc2hlcyBgdHJ1ZWAgaWYgcHJvdG9jb2wgaXMgZm9sbG93ZWQgYnkgXCIvL1wiLCBlbHNlIGBmYWxzZWAuXG4gKiBAcHJvcGVydHkge1N0cmluZ30gcmVzdCBSZXN0IG9mIHRoZSBVUkwgdGhhdCBpcyBub3QgcGFydCBvZiB0aGUgcHJvdG9jb2wuXG4gKi9cblxuLyoqXG4gKiBFeHRyYWN0IHByb3RvY29sIGluZm9ybWF0aW9uIGZyb20gYSBVUkwgd2l0aC93aXRob3V0IGRvdWJsZSBzbGFzaCAoXCIvL1wiKS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYWRkcmVzcyBVUkwgd2Ugd2FudCB0byBleHRyYWN0IGZyb20uXG4gKiBAcmV0dXJuIHtQcm90b2NvbEV4dHJhY3R9IEV4dHJhY3RlZCBpbmZvcm1hdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RQcm90b2NvbChhZGRyZXNzKSB7XG4gIGFkZHJlc3MgPSB0cmltTGVmdChhZGRyZXNzKTtcbiAgdmFyIG1hdGNoID0gcHJvdG9jb2xyZS5leGVjKGFkZHJlc3MpO1xuXG4gIHJldHVybiB7XG4gICAgcHJvdG9jb2w6IG1hdGNoWzFdID8gbWF0Y2hbMV0udG9Mb3dlckNhc2UoKSA6ICcnLFxuICAgIHNsYXNoZXM6ICEhbWF0Y2hbMl0sXG4gICAgcmVzdDogbWF0Y2hbM11cbiAgfTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGEgcmVsYXRpdmUgVVJMIHBhdGhuYW1lIGFnYWluc3QgYSBiYXNlIFVSTCBwYXRobmFtZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcmVsYXRpdmUgUGF0aG5hbWUgb2YgdGhlIHJlbGF0aXZlIFVSTC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBiYXNlIFBhdGhuYW1lIG9mIHRoZSBiYXNlIFVSTC5cbiAqIEByZXR1cm4ge1N0cmluZ30gUmVzb2x2ZWQgcGF0aG5hbWUuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiByZXNvbHZlKHJlbGF0aXZlLCBiYXNlKSB7XG4gIGlmIChyZWxhdGl2ZSA9PT0gJycpIHJldHVybiBiYXNlO1xuXG4gIHZhciBwYXRoID0gKGJhc2UgfHwgJy8nKS5zcGxpdCgnLycpLnNsaWNlKDAsIC0xKS5jb25jYXQocmVsYXRpdmUuc3BsaXQoJy8nKSlcbiAgICAsIGkgPSBwYXRoLmxlbmd0aFxuICAgICwgbGFzdCA9IHBhdGhbaSAtIDFdXG4gICAgLCB1bnNoaWZ0ID0gZmFsc2VcbiAgICAsIHVwID0gMDtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgaWYgKHBhdGhbaV0gPT09ICcuJykge1xuICAgICAgcGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChwYXRoW2ldID09PSAnLi4nKSB7XG4gICAgICBwYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgaWYgKGkgPT09IDApIHVuc2hpZnQgPSB0cnVlO1xuICAgICAgcGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIGlmICh1bnNoaWZ0KSBwYXRoLnVuc2hpZnQoJycpO1xuICBpZiAobGFzdCA9PT0gJy4nIHx8IGxhc3QgPT09ICcuLicpIHBhdGgucHVzaCgnJyk7XG5cbiAgcmV0dXJuIHBhdGguam9pbignLycpO1xufVxuXG4vKipcbiAqIFRoZSBhY3R1YWwgVVJMIGluc3RhbmNlLiBJbnN0ZWFkIG9mIHJldHVybmluZyBhbiBvYmplY3Qgd2UndmUgb3B0ZWQtaW4gdG9cbiAqIGNyZWF0ZSBhbiBhY3R1YWwgY29uc3RydWN0b3IgYXMgaXQncyBtdWNoIG1vcmUgbWVtb3J5IGVmZmljaWVudCBhbmRcbiAqIGZhc3RlciBhbmQgaXQgcGxlYXNlcyBteSBPQ0QuXG4gKlxuICogSXQgaXMgd29ydGggbm90aW5nIHRoYXQgd2Ugc2hvdWxkIG5vdCB1c2UgYFVSTGAgYXMgY2xhc3MgbmFtZSB0byBwcmV2ZW50XG4gKiBjbGFzaGVzIHdpdGggdGhlIGdsb2JhbCBVUkwgaW5zdGFuY2UgdGhhdCBnb3QgaW50cm9kdWNlZCBpbiBicm93c2Vycy5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSBhZGRyZXNzIFVSTCB3ZSB3YW50IHRvIHBhcnNlLlxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBbbG9jYXRpb25dIExvY2F0aW9uIGRlZmF1bHRzIGZvciByZWxhdGl2ZSBwYXRocy5cbiAqIEBwYXJhbSB7Qm9vbGVhbnxGdW5jdGlvbn0gW3BhcnNlcl0gUGFyc2VyIGZvciB0aGUgcXVlcnkgc3RyaW5nLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gVXJsKGFkZHJlc3MsIGxvY2F0aW9uLCBwYXJzZXIpIHtcbiAgYWRkcmVzcyA9IHRyaW1MZWZ0KGFkZHJlc3MpO1xuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBVcmwpKSB7XG4gICAgcmV0dXJuIG5ldyBVcmwoYWRkcmVzcywgbG9jYXRpb24sIHBhcnNlcik7XG4gIH1cblxuICB2YXIgcmVsYXRpdmUsIGV4dHJhY3RlZCwgcGFyc2UsIGluc3RydWN0aW9uLCBpbmRleCwga2V5XG4gICAgLCBpbnN0cnVjdGlvbnMgPSBydWxlcy5zbGljZSgpXG4gICAgLCB0eXBlID0gdHlwZW9mIGxvY2F0aW9uXG4gICAgLCB1cmwgPSB0aGlzXG4gICAgLCBpID0gMDtcblxuICAvL1xuICAvLyBUaGUgZm9sbG93aW5nIGlmIHN0YXRlbWVudHMgYWxsb3dzIHRoaXMgbW9kdWxlIHR3byBoYXZlIGNvbXBhdGliaWxpdHkgd2l0aFxuICAvLyAyIGRpZmZlcmVudCBBUEk6XG4gIC8vXG4gIC8vIDEuIE5vZGUuanMncyBgdXJsLnBhcnNlYCBhcGkgd2hpY2ggYWNjZXB0cyBhIFVSTCwgYm9vbGVhbiBhcyBhcmd1bWVudHNcbiAgLy8gICAgd2hlcmUgdGhlIGJvb2xlYW4gaW5kaWNhdGVzIHRoYXQgdGhlIHF1ZXJ5IHN0cmluZyBzaG91bGQgYWxzbyBiZSBwYXJzZWQuXG4gIC8vXG4gIC8vIDIuIFRoZSBgVVJMYCBpbnRlcmZhY2Ugb2YgdGhlIGJyb3dzZXIgd2hpY2ggYWNjZXB0cyBhIFVSTCwgb2JqZWN0IGFzXG4gIC8vICAgIGFyZ3VtZW50cy4gVGhlIHN1cHBsaWVkIG9iamVjdCB3aWxsIGJlIHVzZWQgYXMgZGVmYXVsdCB2YWx1ZXMgLyBmYWxsLWJhY2tcbiAgLy8gICAgZm9yIHJlbGF0aXZlIHBhdGhzLlxuICAvL1xuICBpZiAoJ29iamVjdCcgIT09IHR5cGUgJiYgJ3N0cmluZycgIT09IHR5cGUpIHtcbiAgICBwYXJzZXIgPSBsb2NhdGlvbjtcbiAgICBsb2NhdGlvbiA9IG51bGw7XG4gIH1cblxuICBpZiAocGFyc2VyICYmICdmdW5jdGlvbicgIT09IHR5cGVvZiBwYXJzZXIpIHBhcnNlciA9IHFzLnBhcnNlO1xuXG4gIGxvY2F0aW9uID0gbG9sY2F0aW9uKGxvY2F0aW9uKTtcblxuICAvL1xuICAvLyBFeHRyYWN0IHByb3RvY29sIGluZm9ybWF0aW9uIGJlZm9yZSBydW5uaW5nIHRoZSBpbnN0cnVjdGlvbnMuXG4gIC8vXG4gIGV4dHJhY3RlZCA9IGV4dHJhY3RQcm90b2NvbChhZGRyZXNzIHx8ICcnKTtcbiAgcmVsYXRpdmUgPSAhZXh0cmFjdGVkLnByb3RvY29sICYmICFleHRyYWN0ZWQuc2xhc2hlcztcbiAgdXJsLnNsYXNoZXMgPSBleHRyYWN0ZWQuc2xhc2hlcyB8fCByZWxhdGl2ZSAmJiBsb2NhdGlvbi5zbGFzaGVzO1xuICB1cmwucHJvdG9jb2wgPSBleHRyYWN0ZWQucHJvdG9jb2wgfHwgbG9jYXRpb24ucHJvdG9jb2wgfHwgJyc7XG4gIGFkZHJlc3MgPSBleHRyYWN0ZWQucmVzdDtcblxuICAvL1xuICAvLyBXaGVuIHRoZSBhdXRob3JpdHkgY29tcG9uZW50IGlzIGFic2VudCB0aGUgVVJMIHN0YXJ0cyB3aXRoIGEgcGF0aFxuICAvLyBjb21wb25lbnQuXG4gIC8vXG4gIGlmICghZXh0cmFjdGVkLnNsYXNoZXMpIGluc3RydWN0aW9uc1szXSA9IFsvKC4qKS8sICdwYXRobmFtZSddO1xuXG4gIGZvciAoOyBpIDwgaW5zdHJ1Y3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgaW5zdHJ1Y3Rpb24gPSBpbnN0cnVjdGlvbnNbaV07XG5cbiAgICBpZiAodHlwZW9mIGluc3RydWN0aW9uID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBhZGRyZXNzID0gaW5zdHJ1Y3Rpb24oYWRkcmVzcyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwYXJzZSA9IGluc3RydWN0aW9uWzBdO1xuICAgIGtleSA9IGluc3RydWN0aW9uWzFdO1xuXG4gICAgaWYgKHBhcnNlICE9PSBwYXJzZSkge1xuICAgICAgdXJsW2tleV0gPSBhZGRyZXNzO1xuICAgIH0gZWxzZSBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBwYXJzZSkge1xuICAgICAgaWYgKH4oaW5kZXggPSBhZGRyZXNzLmluZGV4T2YocGFyc2UpKSkge1xuICAgICAgICBpZiAoJ251bWJlcicgPT09IHR5cGVvZiBpbnN0cnVjdGlvblsyXSkge1xuICAgICAgICAgIHVybFtrZXldID0gYWRkcmVzcy5zbGljZSgwLCBpbmRleCk7XG4gICAgICAgICAgYWRkcmVzcyA9IGFkZHJlc3Muc2xpY2UoaW5kZXggKyBpbnN0cnVjdGlvblsyXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXJsW2tleV0gPSBhZGRyZXNzLnNsaWNlKGluZGV4KTtcbiAgICAgICAgICBhZGRyZXNzID0gYWRkcmVzcy5zbGljZSgwLCBpbmRleCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKChpbmRleCA9IHBhcnNlLmV4ZWMoYWRkcmVzcykpKSB7XG4gICAgICB1cmxba2V5XSA9IGluZGV4WzFdO1xuICAgICAgYWRkcmVzcyA9IGFkZHJlc3Muc2xpY2UoMCwgaW5kZXguaW5kZXgpO1xuICAgIH1cblxuICAgIHVybFtrZXldID0gdXJsW2tleV0gfHwgKFxuICAgICAgcmVsYXRpdmUgJiYgaW5zdHJ1Y3Rpb25bM10gPyBsb2NhdGlvbltrZXldIHx8ICcnIDogJydcbiAgICApO1xuXG4gICAgLy9cbiAgICAvLyBIb3N0bmFtZSwgaG9zdCBhbmQgcHJvdG9jb2wgc2hvdWxkIGJlIGxvd2VyY2FzZWQgc28gdGhleSBjYW4gYmUgdXNlZCB0b1xuICAgIC8vIGNyZWF0ZSBhIHByb3BlciBgb3JpZ2luYC5cbiAgICAvL1xuICAgIGlmIChpbnN0cnVjdGlvbls0XSkgdXJsW2tleV0gPSB1cmxba2V5XS50b0xvd2VyQ2FzZSgpO1xuICB9XG5cbiAgLy9cbiAgLy8gQWxzbyBwYXJzZSB0aGUgc3VwcGxpZWQgcXVlcnkgc3RyaW5nIGluIHRvIGFuIG9iamVjdC4gSWYgd2UncmUgc3VwcGxpZWRcbiAgLy8gd2l0aCBhIGN1c3RvbSBwYXJzZXIgYXMgZnVuY3Rpb24gdXNlIHRoYXQgaW5zdGVhZCBvZiB0aGUgZGVmYXVsdCBidWlsZC1pblxuICAvLyBwYXJzZXIuXG4gIC8vXG4gIGlmIChwYXJzZXIpIHVybC5xdWVyeSA9IHBhcnNlcih1cmwucXVlcnkpO1xuXG4gIC8vXG4gIC8vIElmIHRoZSBVUkwgaXMgcmVsYXRpdmUsIHJlc29sdmUgdGhlIHBhdGhuYW1lIGFnYWluc3QgdGhlIGJhc2UgVVJMLlxuICAvL1xuICBpZiAoXG4gICAgICByZWxhdGl2ZVxuICAgICYmIGxvY2F0aW9uLnNsYXNoZXNcbiAgICAmJiB1cmwucGF0aG5hbWUuY2hhckF0KDApICE9PSAnLydcbiAgICAmJiAodXJsLnBhdGhuYW1lICE9PSAnJyB8fCBsb2NhdGlvbi5wYXRobmFtZSAhPT0gJycpXG4gICkge1xuICAgIHVybC5wYXRobmFtZSA9IHJlc29sdmUodXJsLnBhdGhuYW1lLCBsb2NhdGlvbi5wYXRobmFtZSk7XG4gIH1cblxuICAvL1xuICAvLyBXZSBzaG91bGQgbm90IGFkZCBwb3J0IG51bWJlcnMgaWYgdGhleSBhcmUgYWxyZWFkeSB0aGUgZGVmYXVsdCBwb3J0IG51bWJlclxuICAvLyBmb3IgYSBnaXZlbiBwcm90b2NvbC4gQXMgdGhlIGhvc3QgYWxzbyBjb250YWlucyB0aGUgcG9ydCBudW1iZXIgd2UncmUgZ29pbmdcbiAgLy8gb3ZlcnJpZGUgaXQgd2l0aCB0aGUgaG9zdG5hbWUgd2hpY2ggY29udGFpbnMgbm8gcG9ydCBudW1iZXIuXG4gIC8vXG4gIGlmICghcmVxdWlyZWQodXJsLnBvcnQsIHVybC5wcm90b2NvbCkpIHtcbiAgICB1cmwuaG9zdCA9IHVybC5ob3N0bmFtZTtcbiAgICB1cmwucG9ydCA9ICcnO1xuICB9XG5cbiAgLy9cbiAgLy8gUGFyc2UgZG93biB0aGUgYGF1dGhgIGZvciB0aGUgdXNlcm5hbWUgYW5kIHBhc3N3b3JkLlxuICAvL1xuICB1cmwudXNlcm5hbWUgPSB1cmwucGFzc3dvcmQgPSAnJztcbiAgaWYgKHVybC5hdXRoKSB7XG4gICAgaW5zdHJ1Y3Rpb24gPSB1cmwuYXV0aC5zcGxpdCgnOicpO1xuICAgIHVybC51c2VybmFtZSA9IGluc3RydWN0aW9uWzBdIHx8ICcnO1xuICAgIHVybC5wYXNzd29yZCA9IGluc3RydWN0aW9uWzFdIHx8ICcnO1xuICB9XG5cbiAgdXJsLm9yaWdpbiA9IHVybC5wcm90b2NvbCAmJiB1cmwuaG9zdCAmJiB1cmwucHJvdG9jb2wgIT09ICdmaWxlOidcbiAgICA/IHVybC5wcm90b2NvbCArJy8vJysgdXJsLmhvc3RcbiAgICA6ICdudWxsJztcblxuICAvL1xuICAvLyBUaGUgaHJlZiBpcyBqdXN0IHRoZSBjb21waWxlZCByZXN1bHQuXG4gIC8vXG4gIHVybC5ocmVmID0gdXJsLnRvU3RyaW5nKCk7XG59XG5cbi8qKlxuICogVGhpcyBpcyBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNoYW5naW5nIHByb3BlcnRpZXMgaW4gdGhlIFVSTCBpbnN0YW5jZSB0b1xuICogaW5zdXJlIHRoYXQgdGhleSBhbGwgcHJvcGFnYXRlIGNvcnJlY3RseS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGFydCAgICAgICAgICBQcm9wZXJ0eSB3ZSBuZWVkIHRvIGFkanVzdC5cbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlICAgICAgICAgIFRoZSBuZXdseSBhc3NpZ25lZCB2YWx1ZS5cbiAqIEBwYXJhbSB7Qm9vbGVhbnxGdW5jdGlvbn0gZm4gIFdoZW4gc2V0dGluZyB0aGUgcXVlcnksIGl0IHdpbGwgYmUgdGhlIGZ1bmN0aW9uXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VkIHRvIHBhcnNlIHRoZSBxdWVyeS5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdoZW4gc2V0dGluZyB0aGUgcHJvdG9jb2wsIGRvdWJsZSBzbGFzaCB3aWxsIGJlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkIGZyb20gdGhlIGZpbmFsIHVybCBpZiBpdCBpcyB0cnVlLlxuICogQHJldHVybnMge1VSTH0gVVJMIGluc3RhbmNlIGZvciBjaGFpbmluZy5cbiAqIEBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gc2V0KHBhcnQsIHZhbHVlLCBmbikge1xuICB2YXIgdXJsID0gdGhpcztcblxuICBzd2l0Y2ggKHBhcnQpIHtcbiAgICBjYXNlICdxdWVyeSc6XG4gICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiB2YWx1ZSAmJiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgdmFsdWUgPSAoZm4gfHwgcXMucGFyc2UpKHZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgdXJsW3BhcnRdID0gdmFsdWU7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3BvcnQnOlxuICAgICAgdXJsW3BhcnRdID0gdmFsdWU7XG5cbiAgICAgIGlmICghcmVxdWlyZWQodmFsdWUsIHVybC5wcm90b2NvbCkpIHtcbiAgICAgICAgdXJsLmhvc3QgPSB1cmwuaG9zdG5hbWU7XG4gICAgICAgIHVybFtwYXJ0XSA9ICcnO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSkge1xuICAgICAgICB1cmwuaG9zdCA9IHVybC5ob3N0bmFtZSArJzonKyB2YWx1ZTtcbiAgICAgIH1cblxuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdob3N0bmFtZSc6XG4gICAgICB1cmxbcGFydF0gPSB2YWx1ZTtcblxuICAgICAgaWYgKHVybC5wb3J0KSB2YWx1ZSArPSAnOicrIHVybC5wb3J0O1xuICAgICAgdXJsLmhvc3QgPSB2YWx1ZTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnaG9zdCc6XG4gICAgICB1cmxbcGFydF0gPSB2YWx1ZTtcblxuICAgICAgaWYgKC86XFxkKyQvLnRlc3QodmFsdWUpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc3BsaXQoJzonKTtcbiAgICAgICAgdXJsLnBvcnQgPSB2YWx1ZS5wb3AoKTtcbiAgICAgICAgdXJsLmhvc3RuYW1lID0gdmFsdWUuam9pbignOicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdXJsLmhvc3RuYW1lID0gdmFsdWU7XG4gICAgICAgIHVybC5wb3J0ID0gJyc7XG4gICAgICB9XG5cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncHJvdG9jb2wnOlxuICAgICAgdXJsLnByb3RvY29sID0gdmFsdWUudG9Mb3dlckNhc2UoKTtcbiAgICAgIHVybC5zbGFzaGVzID0gIWZuO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdwYXRobmFtZSc6XG4gICAgY2FzZSAnaGFzaCc6XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgdmFyIGNoYXIgPSBwYXJ0ID09PSAncGF0aG5hbWUnID8gJy8nIDogJyMnO1xuICAgICAgICB1cmxbcGFydF0gPSB2YWx1ZS5jaGFyQXQoMCkgIT09IGNoYXIgPyBjaGFyICsgdmFsdWUgOiB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVybFtwYXJ0XSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgdXJsW3BhcnRdID0gdmFsdWU7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGlucyA9IHJ1bGVzW2ldO1xuXG4gICAgaWYgKGluc1s0XSkgdXJsW2luc1sxXV0gPSB1cmxbaW5zWzFdXS50b0xvd2VyQ2FzZSgpO1xuICB9XG5cbiAgdXJsLm9yaWdpbiA9IHVybC5wcm90b2NvbCAmJiB1cmwuaG9zdCAmJiB1cmwucHJvdG9jb2wgIT09ICdmaWxlOidcbiAgICA/IHVybC5wcm90b2NvbCArJy8vJysgdXJsLmhvc3RcbiAgICA6ICdudWxsJztcblxuICB1cmwuaHJlZiA9IHVybC50b1N0cmluZygpO1xuXG4gIHJldHVybiB1cmw7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBwcm9wZXJ0aWVzIGJhY2sgaW4gdG8gYSB2YWxpZCBhbmQgZnVsbCBVUkwgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHN0cmluZ2lmeSBPcHRpb25hbCBxdWVyeSBzdHJpbmdpZnkgZnVuY3Rpb24uXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBDb21waWxlZCB2ZXJzaW9uIG9mIHRoZSBVUkwuXG4gKiBAcHVibGljXG4gKi9cbmZ1bmN0aW9uIHRvU3RyaW5nKHN0cmluZ2lmeSkge1xuICBpZiAoIXN0cmluZ2lmeSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygc3RyaW5naWZ5KSBzdHJpbmdpZnkgPSBxcy5zdHJpbmdpZnk7XG5cbiAgdmFyIHF1ZXJ5XG4gICAgLCB1cmwgPSB0aGlzXG4gICAgLCBwcm90b2NvbCA9IHVybC5wcm90b2NvbDtcblxuICBpZiAocHJvdG9jb2wgJiYgcHJvdG9jb2wuY2hhckF0KHByb3RvY29sLmxlbmd0aCAtIDEpICE9PSAnOicpIHByb3RvY29sICs9ICc6JztcblxuICB2YXIgcmVzdWx0ID0gcHJvdG9jb2wgKyAodXJsLnNsYXNoZXMgPyAnLy8nIDogJycpO1xuXG4gIGlmICh1cmwudXNlcm5hbWUpIHtcbiAgICByZXN1bHQgKz0gdXJsLnVzZXJuYW1lO1xuICAgIGlmICh1cmwucGFzc3dvcmQpIHJlc3VsdCArPSAnOicrIHVybC5wYXNzd29yZDtcbiAgICByZXN1bHQgKz0gJ0AnO1xuICB9XG5cbiAgcmVzdWx0ICs9IHVybC5ob3N0ICsgdXJsLnBhdGhuYW1lO1xuXG4gIHF1ZXJ5ID0gJ29iamVjdCcgPT09IHR5cGVvZiB1cmwucXVlcnkgPyBzdHJpbmdpZnkodXJsLnF1ZXJ5KSA6IHVybC5xdWVyeTtcbiAgaWYgKHF1ZXJ5KSByZXN1bHQgKz0gJz8nICE9PSBxdWVyeS5jaGFyQXQoMCkgPyAnPycrIHF1ZXJ5IDogcXVlcnk7XG5cbiAgaWYgKHVybC5oYXNoKSByZXN1bHQgKz0gdXJsLmhhc2g7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuVXJsLnByb3RvdHlwZSA9IHsgc2V0OiBzZXQsIHRvU3RyaW5nOiB0b1N0cmluZyB9O1xuXG4vL1xuLy8gRXhwb3NlIHRoZSBVUkwgcGFyc2VyIGFuZCBzb21lIGFkZGl0aW9uYWwgcHJvcGVydGllcyB0aGF0IG1pZ2h0IGJlIHVzZWZ1bCBmb3Jcbi8vIG90aGVycyBvciB0ZXN0aW5nLlxuLy9cblVybC5leHRyYWN0UHJvdG9jb2wgPSBleHRyYWN0UHJvdG9jb2w7XG5VcmwubG9jYXRpb24gPSBsb2xjYXRpb247XG5VcmwudHJpbUxlZnQgPSB0cmltTGVmdDtcblVybC5xcyA9IHFzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybDtcbiIsIi8qXG4gKiBUaGlzIGRlbGF5IGFsbG93cyB0aGUgdGhyZWFkIHRvIGZpbmlzaCBhc3NpZ25pbmcgaXRzIG9uKiBtZXRob2RzXG4gKiBiZWZvcmUgaW52b2tpbmcgdGhlIGRlbGF5IGNhbGxiYWNrLiBUaGlzIGlzIHB1cmVseSBhIHRpbWluZyBoYWNrLlxuICogaHR0cDovL2dlZWthYnl0ZS5ibG9nc3BvdC5jb20vMjAxNC8wMS9qYXZhc2NyaXB0LWVmZmVjdC1vZi1zZXR0aW5nLXNldHRpbWVvdXQuaHRtbFxuICpcbiAqIEBwYXJhbSB7Y2FsbGJhY2s6IGZ1bmN0aW9ufSB0aGUgY2FsbGJhY2sgd2hpY2ggd2lsbCBiZSBpbnZva2VkIGFmdGVyIHRoZSB0aW1lb3V0XG4gKiBAcGFybWEge2NvbnRleHQ6IG9iamVjdH0gdGhlIGNvbnRleHQgaW4gd2hpY2ggdG8gaW52b2tlIHRoZSBmdW5jdGlvblxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBkZWxheShjYWxsYmFjaywgY29udGV4dCkge1xuICBzZXRUaW1lb3V0KHRpbWVvdXRDb250ZXh0ID0+IGNhbGxiYWNrLmNhbGwodGltZW91dENvbnRleHQpLCA0LCBjb250ZXh0KTtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGxvZyhtZXRob2QsIG1lc3NhZ2UpIHtcbiAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAndGVzdCcpIHtcbiAgICBjb25zb2xlW21ldGhvZF0uY2FsbChudWxsLCBtZXNzYWdlKTtcbiAgfVxuICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiByZWplY3QoYXJyYXksIGNhbGxiYWNrKSB7XG4gIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgYXJyYXkuZm9yRWFjaChpdGVtSW5BcnJheSA9PiB7XG4gICAgaWYgKCFjYWxsYmFjayhpdGVtSW5BcnJheSkpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVtSW5BcnJheSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbHRlcihhcnJheSwgY2FsbGJhY2spIHtcbiAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICBhcnJheS5mb3JFYWNoKGl0ZW1JbkFycmF5ID0+IHtcbiAgICBpZiAoY2FsbGJhY2soaXRlbUluQXJyYXkpKSB7XG4gICAgICByZXN1bHRzLnB1c2goaXRlbUluQXJyYXkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJpbXBvcnQgeyByZWplY3QsIGZpbHRlciB9IGZyb20gJy4uL2hlbHBlcnMvYXJyYXktaGVscGVycyc7XG5cbi8qXG4gKiBFdmVudFRhcmdldCBpcyBhbiBpbnRlcmZhY2UgaW1wbGVtZW50ZWQgYnkgb2JqZWN0cyB0aGF0IGNhblxuICogcmVjZWl2ZSBldmVudHMgYW5kIG1heSBoYXZlIGxpc3RlbmVycyBmb3IgdGhlbS5cbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRXZlbnRUYXJnZXRcbiAqL1xuY2xhc3MgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICB9XG5cbiAgLypcbiAgICogVGllcyBhIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIGFuIGV2ZW50IHR5cGUgd2hpY2ggY2FuIGxhdGVyIGJlIGludm9rZWQgdmlhIHRoZVxuICAgKiBkaXNwYXRjaEV2ZW50IG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSB0aGUgdHlwZSBvZiBldmVudCAoaWU6ICdvcGVuJywgJ21lc3NhZ2UnLCBldGMuKVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIGFuIGV2ZW50IGlzIGRpc3BhdGNoZWQgbWF0Y2hpbmcgdGhlIHR5cGVcbiAgICogQHBhcmFtIHtib29sZWFufSB1c2VDYXB0dXJlIC0gTi9BIFRPRE86IGltcGxlbWVudCB1c2VDYXB0dXJlIGZ1bmN0aW9uYWxpdHlcbiAgICovXG4gIGFkZEV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXIgLyogLCB1c2VDYXB0dXJlICovKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHRoaXMubGlzdGVuZXJzW3R5cGVdKSkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgfVxuXG4gICAgICAvLyBPbmx5IGFkZCB0aGUgc2FtZSBmdW5jdGlvbiBvbmNlXG4gICAgICBpZiAoZmlsdGVyKHRoaXMubGlzdGVuZXJzW3R5cGVdLCBpdGVtID0+IGl0ZW0gPT09IGxpc3RlbmVyKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogUmVtb3ZlcyB0aGUgbGlzdGVuZXIgc28gaXQgd2lsbCBubyBsb25nZXIgYmUgaW52b2tlZCB2aWEgdGhlIGRpc3BhdGNoRXZlbnQgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIHRoZSB0eXBlIG9mIGV2ZW50IChpZTogJ29wZW4nLCAnbWVzc2FnZScsIGV0Yy4pXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gYW4gZXZlbnQgaXMgZGlzcGF0Y2hlZCBtYXRjaGluZyB0aGUgdHlwZVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVzZUNhcHR1cmUgLSBOL0EgVE9ETzogaW1wbGVtZW50IHVzZUNhcHR1cmUgZnVuY3Rpb25hbGl0eVxuICAgKi9cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCByZW1vdmluZ0xpc3RlbmVyIC8qICwgdXNlQ2FwdHVyZSAqLykge1xuICAgIGNvbnN0IGFycmF5T2ZMaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVyc1t0eXBlXTtcbiAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IHJlamVjdChhcnJheU9mTGlzdGVuZXJzLCBsaXN0ZW5lciA9PiBsaXN0ZW5lciA9PT0gcmVtb3ZpbmdMaXN0ZW5lcik7XG4gIH1cblxuICAvKlxuICAgKiBJbnZva2VzIGFsbCBsaXN0ZW5lciBmdW5jdGlvbnMgdGhhdCBhcmUgbGlzdGVuaW5nIHRvIHRoZSBnaXZlbiBldmVudC50eXBlIHByb3BlcnR5LiBFYWNoXG4gICAqIGxpc3RlbmVyIHdpbGwgYmUgcGFzc2VkIHRoZSBldmVudCBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudCAtIGV2ZW50IG9iamVjdCB3aGljaCB3aWxsIGJlIHBhc3NlZCB0byBhbGwgbGlzdGVuZXJzIG9mIHRoZSBldmVudC50eXBlIHByb3BlcnR5XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50LCAuLi5jdXN0b21Bcmd1bWVudHMpIHtcbiAgICBjb25zdCBldmVudE5hbWUgPSBldmVudC50eXBlO1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkobGlzdGVuZXJzKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGxpc3RlbmVycy5mb3JFYWNoKGxpc3RlbmVyID0+IHtcbiAgICAgIGlmIChjdXN0b21Bcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBjdXN0b21Bcmd1bWVudHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdGVuZXIuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFdmVudFRhcmdldDtcbiIsImltcG9ydCB7IHJlamVjdCB9IGZyb20gJy4vaGVscGVycy9hcnJheS1oZWxwZXJzJztcblxuZnVuY3Rpb24gdHJpbVF1ZXJ5UGFydEZyb21VUkwodXJsKSB7XG4gIGNvbnN0IHF1ZXJ5SW5kZXggPSB1cmwuaW5kZXhPZignPycpO1xuICByZXR1cm4gcXVlcnlJbmRleCA+PSAwID8gdXJsLnNsaWNlKDAsIHF1ZXJ5SW5kZXgpIDogdXJsO1xufVxuXG4vKlxuICogVGhlIG5ldHdvcmsgYnJpZGdlIGlzIGEgd2F5IGZvciB0aGUgbW9jayB3ZWJzb2NrZXQgb2JqZWN0IHRvICdjb21tdW5pY2F0ZScgd2l0aFxuICogYWxsIGF2YWlsYWJsZSBzZXJ2ZXJzLiBUaGlzIGlzIGEgc2luZ2xldG9uIG9iamVjdCBzbyBpdCBpcyBpbXBvcnRhbnQgdGhhdCB5b3VcbiAqIGNsZWFuIHVwIHVybE1hcCB3aGVuZXZlciB5b3UgYXJlIGZpbmlzaGVkLlxuICovXG5jbGFzcyBOZXR3b3JrQnJpZGdlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy51cmxNYXAgPSB7fTtcbiAgfVxuXG4gIC8qXG4gICAqIEF0dGFjaGVzIGEgd2Vic29ja2V0IG9iamVjdCB0byB0aGUgdXJsTWFwIGhhc2ggc28gdGhhdCBpdCBjYW4gZmluZCB0aGUgc2VydmVyXG4gICAqIGl0IGlzIGNvbm5lY3RlZCB0byBhbmQgdGhlIHNlcnZlciBpbiB0dXJuIGNhbiBmaW5kIGl0LlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gd2Vic29ja2V0IC0gd2Vic29ja2V0IG9iamVjdCB0byBhZGQgdG8gdGhlIHVybE1hcCBoYXNoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcbiAgICovXG4gIGF0dGFjaFdlYlNvY2tldCh3ZWJzb2NrZXQsIHVybCkge1xuICAgIGNvbnN0IHNlcnZlclVSTCA9IHRyaW1RdWVyeVBhcnRGcm9tVVJMKHVybCk7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3NlcnZlclVSTF07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCAmJiBjb25uZWN0aW9uTG9va3VwLnNlcnZlciAmJiBjb25uZWN0aW9uTG9va3VwLndlYnNvY2tldHMuaW5kZXhPZih3ZWJzb2NrZXQpID09PSAtMSkge1xuICAgICAgY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzLnB1c2god2Vic29ja2V0KTtcbiAgICAgIHJldHVybiBjb25uZWN0aW9uTG9va3VwLnNlcnZlcjtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBBdHRhY2hlcyBhIHdlYnNvY2tldCB0byBhIHJvb21cbiAgICovXG4gIGFkZE1lbWJlcnNoaXBUb1Jvb20od2Vic29ja2V0LCByb29tKSB7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3RyaW1RdWVyeVBhcnRGcm9tVVJMKHdlYnNvY2tldC51cmwpXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwICYmIGNvbm5lY3Rpb25Mb29rdXAuc2VydmVyICYmIGNvbm5lY3Rpb25Mb29rdXAud2Vic29ja2V0cy5pbmRleE9mKHdlYnNvY2tldCkgIT09IC0xKSB7XG4gICAgICBpZiAoIWNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dKSB7XG4gICAgICAgIGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dID0gW107XG4gICAgICB9XG5cbiAgICAgIGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dLnB1c2god2Vic29ja2V0KTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBBdHRhY2hlcyBhIHNlcnZlciBvYmplY3QgdG8gdGhlIHVybE1hcCBoYXNoIHNvIHRoYXQgaXQgY2FuIGZpbmQgYSB3ZWJzb2NrZXRzXG4gICAqIHdoaWNoIGFyZSBjb25uZWN0ZWQgdG8gaXQgYW5kIHNvIHRoYXQgd2Vic29ja2V0cyBjYW4gaW4gdHVybiBjYW4gZmluZCBpdC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHNlcnZlciAtIHNlcnZlciBvYmplY3QgdG8gYWRkIHRvIHRoZSB1cmxNYXAgaGFzaFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICAqL1xuICBhdHRhY2hTZXJ2ZXIoc2VydmVyLCB1cmwpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdXJsXTtcblxuICAgIGlmICghY29ubmVjdGlvbkxvb2t1cCkge1xuICAgICAgdGhpcy51cmxNYXBbdXJsXSA9IHtcbiAgICAgICAgc2VydmVyLFxuICAgICAgICB3ZWJzb2NrZXRzOiBbXSxcbiAgICAgICAgcm9vbU1lbWJlcnNoaXBzOiB7fVxuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHNlcnZlcjtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBGaW5kcyB0aGUgc2VydmVyIHdoaWNoIGlzICdydW5uaW5nJyBvbiB0aGUgZ2l2ZW4gdXJsLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gdGhlIHVybCB0byB1c2UgdG8gZmluZCB3aGljaCBzZXJ2ZXIgaXMgcnVubmluZyBvbiBpdFxuICAgKi9cbiAgc2VydmVyTG9va3VwKHVybCkge1xuICAgIGNvbnN0IHNlcnZlclVSTCA9IHRyaW1RdWVyeVBhcnRGcm9tVVJMKHVybCk7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3NlcnZlclVSTF07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCkge1xuICAgICAgcmV0dXJuIGNvbm5lY3Rpb25Mb29rdXAuc2VydmVyO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIEZpbmRzIGFsbCB3ZWJzb2NrZXRzIHdoaWNoIGlzICdsaXN0ZW5pbmcnIG9uIHRoZSBnaXZlbiB1cmwuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSB0aGUgdXJsIHRvIHVzZSB0byBmaW5kIGFsbCB3ZWJzb2NrZXRzIHdoaWNoIGFyZSBhc3NvY2lhdGVkIHdpdGggaXRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJvb20gLSBpZiBhIHJvb20gaXMgcHJvdmlkZWQsIHdpbGwgb25seSByZXR1cm4gc29ja2V0cyBpbiB0aGlzIHJvb21cbiAgICogQHBhcmFtIHtjbGFzc30gYnJvYWRjYXN0ZXIgLSBzb2NrZXQgdGhhdCBpcyBicm9hZGNhc3RpbmcgYW5kIGlzIHRvIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIGxvb2t1cFxuICAgKi9cbiAgd2Vic29ja2V0c0xvb2t1cCh1cmwsIHJvb20sIGJyb2FkY2FzdGVyKSB7XG4gICAgY29uc3Qgc2VydmVyVVJMID0gdHJpbVF1ZXJ5UGFydEZyb21VUkwodXJsKTtcbiAgICBsZXQgd2Vic29ja2V0cztcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbc2VydmVyVVJMXTtcblxuICAgIHdlYnNvY2tldHMgPSBjb25uZWN0aW9uTG9va3VwID8gY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzIDogW107XG5cbiAgICBpZiAocm9vbSkge1xuICAgICAgY29uc3QgbWVtYmVycyA9IGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dO1xuICAgICAgd2Vic29ja2V0cyA9IG1lbWJlcnMgfHwgW107XG4gICAgfVxuXG4gICAgcmV0dXJuIGJyb2FkY2FzdGVyID8gd2Vic29ja2V0cy5maWx0ZXIod2Vic29ja2V0ID0+IHdlYnNvY2tldCAhPT0gYnJvYWRjYXN0ZXIpIDogd2Vic29ja2V0cztcbiAgfVxuXG4gIC8qXG4gICAqIFJlbW92ZXMgdGhlIGVudHJ5IGFzc29jaWF0ZWQgd2l0aCB0aGUgdXJsLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICAqL1xuICByZW1vdmVTZXJ2ZXIodXJsKSB7XG4gICAgZGVsZXRlIHRoaXMudXJsTWFwW3RyaW1RdWVyeVBhcnRGcm9tVVJMKHVybCldO1xuICB9XG5cbiAgLypcbiAgICogUmVtb3ZlcyB0aGUgaW5kaXZpZHVhbCB3ZWJzb2NrZXQgZnJvbSB0aGUgbWFwIG9mIGFzc29jaWF0ZWQgd2Vic29ja2V0cy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHdlYnNvY2tldCAtIHdlYnNvY2tldCBvYmplY3QgdG8gcmVtb3ZlIGZyb20gdGhlIHVybCBtYXBcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICAgKi9cbiAgcmVtb3ZlV2ViU29ja2V0KHdlYnNvY2tldCwgdXJsKSB7XG4gICAgY29uc3Qgc2VydmVyVVJMID0gdHJpbVF1ZXJ5UGFydEZyb21VUkwodXJsKTtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbc2VydmVyVVJMXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwKSB7XG4gICAgICBjb25uZWN0aW9uTG9va3VwLndlYnNvY2tldHMgPSByZWplY3QoY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzLCBzb2NrZXQgPT4gc29ja2V0ID09PSB3ZWJzb2NrZXQpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIFJlbW92ZXMgYSB3ZWJzb2NrZXQgZnJvbSBhIHJvb21cbiAgICovXG4gIHJlbW92ZU1lbWJlcnNoaXBGcm9tUm9vbSh3ZWJzb2NrZXQsIHJvb20pIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdHJpbVF1ZXJ5UGFydEZyb21VUkwod2Vic29ja2V0LnVybCldO1xuICAgIGNvbnN0IG1lbWJlcnNoaXBzID0gY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCAmJiBtZW1iZXJzaGlwcyAhPT0gbnVsbCkge1xuICAgICAgY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV0gPSByZWplY3QobWVtYmVyc2hpcHMsIHNvY2tldCA9PiBzb2NrZXQgPT09IHdlYnNvY2tldCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBOZXR3b3JrQnJpZGdlKCk7IC8vIE5vdGU6IHRoaXMgaXMgYSBzaW5nbGV0b25cbiIsIi8qXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQ2xvc2VFdmVudFxuICovXG5leHBvcnQgY29uc3QgQ0xPU0VfQ09ERVMgPSB7XG4gIENMT1NFX05PUk1BTDogMTAwMCxcbiAgQ0xPU0VfR09JTkdfQVdBWTogMTAwMSxcbiAgQ0xPU0VfUFJPVE9DT0xfRVJST1I6IDEwMDIsXG4gIENMT1NFX1VOU1VQUE9SVEVEOiAxMDAzLFxuICBDTE9TRV9OT19TVEFUVVM6IDEwMDUsXG4gIENMT1NFX0FCTk9STUFMOiAxMDA2LFxuICBVTlNVUFBPUlRFRF9EQVRBOiAxMDA3LFxuICBQT0xJQ1lfVklPTEFUSU9OOiAxMDA4LFxuICBDTE9TRV9UT09fTEFSR0U6IDEwMDksXG4gIE1JU1NJTkdfRVhURU5TSU9OOiAxMDEwLFxuICBJTlRFUk5BTF9FUlJPUjogMTAxMSxcbiAgU0VSVklDRV9SRVNUQVJUOiAxMDEyLFxuICBUUllfQUdBSU5fTEFURVI6IDEwMTMsXG4gIFRMU19IQU5EU0hBS0U6IDEwMTVcbn07XG5cbmV4cG9ydCBjb25zdCBFUlJPUl9QUkVGSVggPSB7XG4gIENPTlNUUlVDVE9SX0VSUk9SOiBcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1dlYlNvY2tldCc6XCIsXG4gIENMT1NFX0VSUk9SOiBcIkZhaWxlZCB0byBleGVjdXRlICdjbG9zZScgb24gJ1dlYlNvY2tldCc6XCIsXG4gIEVWRU5UOiB7XG4gICAgQ09OU1RSVUNUOiBcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ0V2ZW50JzpcIixcbiAgICBNRVNTQUdFOiBcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ01lc3NhZ2VFdmVudCc6XCIsXG4gICAgQ0xPU0U6IFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnQ2xvc2VFdmVudCc6XCJcbiAgfVxufTtcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50UHJvdG90eXBlIHtcbiAgLy8gTm9vcHNcbiAgc3RvcFByb3BhZ2F0aW9uKCkge31cbiAgc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCkge31cblxuICAvLyBpZiBubyBhcmd1bWVudHMgYXJlIHBhc3NlZCB0aGVuIHRoZSB0eXBlIGlzIHNldCB0byBcInVuZGVmaW5lZFwiIG9uXG4gIC8vIGNocm9tZSBhbmQgc2FmYXJpLlxuICBpbml0RXZlbnQodHlwZSA9ICd1bmRlZmluZWQnLCBidWJibGVzID0gZmFsc2UsIGNhbmNlbGFibGUgPSBmYWxzZSkge1xuICAgIHRoaXMudHlwZSA9IGAke3R5cGV9YDtcbiAgICB0aGlzLmJ1YmJsZXMgPSBCb29sZWFuKGJ1YmJsZXMpO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IEJvb2xlYW4oY2FuY2VsYWJsZSk7XG4gIH1cbn1cbiIsImltcG9ydCBFdmVudFByb3RvdHlwZSBmcm9tICcuL3Byb3RvdHlwZSc7XG5pbXBvcnQgeyBFUlJPUl9QUkVGSVggfSBmcm9tICcuLi9jb25zdGFudHMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudCBleHRlbmRzIEV2ZW50UHJvdG90eXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgZXZlbnRJbml0Q29uZmlnID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5FVkVOVF9FUlJPUn0gMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgMCBwcmVzZW50LmApO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZXZlbnRJbml0Q29uZmlnICE9PSAnb2JqZWN0Jykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgJHtFUlJPUl9QUkVGSVguRVZFTlRfRVJST1J9IHBhcmFtZXRlciAyICgnZXZlbnRJbml0RGljdCcpIGlzIG5vdCBhbiBvYmplY3QuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlIH0gPSBldmVudEluaXRDb25maWc7XG5cbiAgICB0aGlzLnR5cGUgPSBgJHt0eXBlfWA7XG4gICAgdGhpcy50aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLnNyY0VsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMucmV0dXJuVmFsdWUgPSB0cnVlO1xuICAgIHRoaXMuaXNUcnVzdGVkID0gZmFsc2U7XG4gICAgdGhpcy5ldmVudFBoYXNlID0gMDtcbiAgICB0aGlzLmRlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmN1cnJlbnRUYXJnZXQgPSBudWxsO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IGNhbmNlbGFibGUgPyBCb29sZWFuKGNhbmNlbGFibGUpIDogZmFsc2U7XG4gICAgdGhpcy5jYW5uY2VsQnViYmxlID0gZmFsc2U7XG4gICAgdGhpcy5idWJibGVzID0gYnViYmxlcyA/IEJvb2xlYW4oYnViYmxlcykgOiBmYWxzZTtcbiAgfVxufVxuIiwiaW1wb3J0IEV2ZW50UHJvdG90eXBlIGZyb20gJy4vcHJvdG90eXBlJztcbmltcG9ydCB7IEVSUk9SX1BSRUZJWCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1lc3NhZ2VFdmVudCBleHRlbmRzIEV2ZW50UHJvdG90eXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgZXZlbnRJbml0Q29uZmlnID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5FVkVOVC5NRVNTQUdFfSAxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuYCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBldmVudEluaXRDb25maWcgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5FVkVOVC5NRVNTQUdFfSBwYXJhbWV0ZXIgMiAoJ2V2ZW50SW5pdERpY3QnKSBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlLCBkYXRhLCBvcmlnaW4sIGxhc3RFdmVudElkLCBwb3J0cyB9ID0gZXZlbnRJbml0Q29uZmlnO1xuXG4gICAgdGhpcy50eXBlID0gYCR7dHlwZX1gO1xuICAgIHRoaXMudGltZVN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnRhcmdldCA9IG51bGw7XG4gICAgdGhpcy5zcmNFbGVtZW50ID0gbnVsbDtcbiAgICB0aGlzLnJldHVyblZhbHVlID0gdHJ1ZTtcbiAgICB0aGlzLmlzVHJ1c3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuZXZlbnRQaGFzZSA9IDA7XG4gICAgdGhpcy5kZWZhdWx0UHJldmVudGVkID0gZmFsc2U7XG4gICAgdGhpcy5jdXJyZW50VGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLmNhbmNlbGFibGUgPSBjYW5jZWxhYmxlID8gQm9vbGVhbihjYW5jZWxhYmxlKSA6IGZhbHNlO1xuICAgIHRoaXMuY2FubmNlbEJ1YmJsZSA9IGZhbHNlO1xuICAgIHRoaXMuYnViYmxlcyA9IGJ1YmJsZXMgPyBCb29sZWFuKGJ1YmJsZXMpIDogZmFsc2U7XG4gICAgdGhpcy5vcmlnaW4gPSBgJHtvcmlnaW59YDtcbiAgICB0aGlzLnBvcnRzID0gdHlwZW9mIHBvcnRzID09PSAndW5kZWZpbmVkJyA/IG51bGwgOiBwb3J0cztcbiAgICB0aGlzLmRhdGEgPSB0eXBlb2YgZGF0YSA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogZGF0YTtcbiAgICB0aGlzLmxhc3RFdmVudElkID0gYCR7bGFzdEV2ZW50SWQgfHwgJyd9YDtcbiAgfVxufVxuIiwiaW1wb3J0IEV2ZW50UHJvdG90eXBlIGZyb20gJy4vcHJvdG90eXBlJztcbmltcG9ydCB7IEVSUk9SX1BSRUZJWCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENsb3NlRXZlbnQgZXh0ZW5kcyBFdmVudFByb3RvdHlwZSB7XG4gIGNvbnN0cnVjdG9yKHR5cGUsIGV2ZW50SW5pdENvbmZpZyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICghdHlwZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgJHtFUlJPUl9QUkVGSVguRVZFTlQuQ0xPU0V9IDEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5IDAgcHJlc2VudC5gKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGV2ZW50SW5pdENvbmZpZyAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYCR7RVJST1JfUFJFRklYLkVWRU5ULkNMT1NFfSBwYXJhbWV0ZXIgMiAoJ2V2ZW50SW5pdERpY3QnKSBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlLCBjb2RlLCByZWFzb24sIHdhc0NsZWFuIH0gPSBldmVudEluaXRDb25maWc7XG5cbiAgICB0aGlzLnR5cGUgPSBgJHt0eXBlfWA7XG4gICAgdGhpcy50aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLnNyY0VsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMucmV0dXJuVmFsdWUgPSB0cnVlO1xuICAgIHRoaXMuaXNUcnVzdGVkID0gZmFsc2U7XG4gICAgdGhpcy5ldmVudFBoYXNlID0gMDtcbiAgICB0aGlzLmRlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmN1cnJlbnRUYXJnZXQgPSBudWxsO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IGNhbmNlbGFibGUgPyBCb29sZWFuKGNhbmNlbGFibGUpIDogZmFsc2U7XG4gICAgdGhpcy5jYW5jZWxCdWJibGUgPSBmYWxzZTtcbiAgICB0aGlzLmJ1YmJsZXMgPSBidWJibGVzID8gQm9vbGVhbihidWJibGVzKSA6IGZhbHNlO1xuICAgIHRoaXMuY29kZSA9IHR5cGVvZiBjb2RlID09PSAnbnVtYmVyJyA/IHBhcnNlSW50KGNvZGUsIDEwKSA6IDA7XG4gICAgdGhpcy5yZWFzb24gPSBgJHtyZWFzb24gfHwgJyd9YDtcbiAgICB0aGlzLndhc0NsZWFuID0gd2FzQ2xlYW4gPyBCb29sZWFuKHdhc0NsZWFuKSA6IGZhbHNlO1xuICB9XG59XG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudCc7XG5pbXBvcnQgTWVzc2FnZUV2ZW50IGZyb20gJy4vbWVzc2FnZSc7XG5pbXBvcnQgQ2xvc2VFdmVudCBmcm9tICcuL2Nsb3NlJztcblxuLypcbiAqIENyZWF0ZXMgYW4gRXZlbnQgb2JqZWN0IGFuZCBleHRlbmRzIGl0IHRvIGFsbG93IGZ1bGwgbW9kaWZpY2F0aW9uIG9mXG4gKiBpdHMgcHJvcGVydGllcy5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIC0gd2l0aGluIGNvbmZpZyB5b3Ugd2lsbCBuZWVkIHRvIHBhc3MgdHlwZSBhbmQgb3B0aW9uYWxseSB0YXJnZXRcbiAqL1xuZnVuY3Rpb24gY3JlYXRlRXZlbnQoY29uZmlnKSB7XG4gIGNvbnN0IHsgdHlwZSwgdGFyZ2V0IH0gPSBjb25maWc7XG4gIGNvbnN0IGV2ZW50T2JqZWN0ID0gbmV3IEV2ZW50KHR5cGUpO1xuXG4gIGlmICh0YXJnZXQpIHtcbiAgICBldmVudE9iamVjdC50YXJnZXQgPSB0YXJnZXQ7XG4gICAgZXZlbnRPYmplY3Quc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBldmVudE9iamVjdC5jdXJyZW50VGFyZ2V0ID0gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIGV2ZW50T2JqZWN0O1xufVxuXG4vKlxuICogQ3JlYXRlcyBhIE1lc3NhZ2VFdmVudCBvYmplY3QgYW5kIGV4dGVuZHMgaXQgdG8gYWxsb3cgZnVsbCBtb2RpZmljYXRpb24gb2ZcbiAqIGl0cyBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgLSB3aXRoaW4gY29uZmlnOiB0eXBlLCBvcmlnaW4sIGRhdGEgYW5kIG9wdGlvbmFsbHkgdGFyZ2V0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU1lc3NhZ2VFdmVudChjb25maWcpIHtcbiAgY29uc3QgeyB0eXBlLCBvcmlnaW4sIGRhdGEsIHRhcmdldCB9ID0gY29uZmlnO1xuICBjb25zdCBtZXNzYWdlRXZlbnQgPSBuZXcgTWVzc2FnZUV2ZW50KHR5cGUsIHtcbiAgICBkYXRhLFxuICAgIG9yaWdpblxuICB9KTtcblxuICBpZiAodGFyZ2V0KSB7XG4gICAgbWVzc2FnZUV2ZW50LnRhcmdldCA9IHRhcmdldDtcbiAgICBtZXNzYWdlRXZlbnQuc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBtZXNzYWdlRXZlbnQuY3VycmVudFRhcmdldCA9IHRhcmdldDtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlRXZlbnQ7XG59XG5cbi8qXG4gKiBDcmVhdGVzIGEgQ2xvc2VFdmVudCBvYmplY3QgYW5kIGV4dGVuZHMgaXQgdG8gYWxsb3cgZnVsbCBtb2RpZmljYXRpb24gb2ZcbiAqIGl0cyBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgLSB3aXRoaW4gY29uZmlnOiB0eXBlIGFuZCBvcHRpb25hbGx5IHRhcmdldCwgY29kZSwgYW5kIHJlYXNvblxuICovXG5mdW5jdGlvbiBjcmVhdGVDbG9zZUV2ZW50KGNvbmZpZykge1xuICBjb25zdCB7IGNvZGUsIHJlYXNvbiwgdHlwZSwgdGFyZ2V0IH0gPSBjb25maWc7XG4gIGxldCB7IHdhc0NsZWFuIH0gPSBjb25maWc7XG5cbiAgaWYgKCF3YXNDbGVhbikge1xuICAgIHdhc0NsZWFuID0gY29kZSA9PT0gMTAwMDtcbiAgfVxuXG4gIGNvbnN0IGNsb3NlRXZlbnQgPSBuZXcgQ2xvc2VFdmVudCh0eXBlLCB7XG4gICAgY29kZSxcbiAgICByZWFzb24sXG4gICAgd2FzQ2xlYW5cbiAgfSk7XG5cbiAgaWYgKHRhcmdldCkge1xuICAgIGNsb3NlRXZlbnQudGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGNsb3NlRXZlbnQuc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBjbG9zZUV2ZW50LmN1cnJlbnRUYXJnZXQgPSB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4gY2xvc2VFdmVudDtcbn1cblxuZXhwb3J0IHsgY3JlYXRlRXZlbnQsIGNyZWF0ZU1lc3NhZ2VFdmVudCwgY3JlYXRlQ2xvc2VFdmVudCB9O1xuIiwiaW1wb3J0IFdlYlNvY2tldCBmcm9tICcuLi93ZWJzb2NrZXQnO1xuaW1wb3J0IGRlbGF5IGZyb20gJy4uL2hlbHBlcnMvZGVsYXknO1xuaW1wb3J0IG5ldHdvcmtCcmlkZ2UgZnJvbSAnLi4vbmV0d29yay1icmlkZ2UnO1xuaW1wb3J0IHsgY3JlYXRlQ2xvc2VFdmVudCwgY3JlYXRlRXZlbnQgfSBmcm9tICcuLi9ldmVudC9mYWN0b3J5JztcblxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlV2ViU29ja2V0Q29ubmVjdGlvbihjb250ZXh0LCBjb2RlLCByZWFzb24pIHtcbiAgY29udGV4dC5yZWFkeVN0YXRlID0gV2ViU29ja2V0LkNMT1NJTkc7XG5cbiAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAoY29udGV4dC51cmwpO1xuICBjb25zdCBjbG9zZUV2ZW50ID0gY3JlYXRlQ2xvc2VFdmVudCh7XG4gICAgdHlwZTogJ2Nsb3NlJyxcbiAgICB0YXJnZXQ6IGNvbnRleHQsXG4gICAgY29kZSxcbiAgICByZWFzb25cbiAgfSk7XG5cbiAgZGVsYXkoKCkgPT4ge1xuICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlV2ViU29ja2V0KGNvbnRleHQsIGNvbnRleHQudXJsKTtcblxuICAgIGNvbnRleHQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRUQ7XG4gICAgY29udGV4dC5kaXNwYXRjaEV2ZW50KGNsb3NlRXZlbnQpO1xuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgc2VydmVyLmRpc3BhdGNoRXZlbnQoY2xvc2VFdmVudCwgc2VydmVyKTtcbiAgICB9XG4gIH0sIGNvbnRleHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmFpbFdlYlNvY2tldENvbm5lY3Rpb24oY29udGV4dCwgY29kZSwgcmVhc29uKSB7XG4gIGNvbnRleHQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TSU5HO1xuXG4gIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKGNvbnRleHQudXJsKTtcbiAgY29uc3QgY2xvc2VFdmVudCA9IGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgIHR5cGU6ICdjbG9zZScsXG4gICAgdGFyZ2V0OiBjb250ZXh0LFxuICAgIGNvZGUsXG4gICAgcmVhc29uLFxuICAgIHdhc0NsZWFuOiBmYWxzZVxuICB9KTtcblxuICBjb25zdCBlcnJvckV2ZW50ID0gY3JlYXRlRXZlbnQoe1xuICAgIHR5cGU6ICdlcnJvcicsXG4gICAgdGFyZ2V0OiBjb250ZXh0XG4gIH0pO1xuXG4gIGRlbGF5KCgpID0+IHtcbiAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVdlYlNvY2tldChjb250ZXh0LCBjb250ZXh0LnVybCk7XG5cbiAgICBjb250ZXh0LnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuICAgIGNvbnRleHQuZGlzcGF0Y2hFdmVudChlcnJvckV2ZW50KTtcbiAgICBjb250ZXh0LmRpc3BhdGNoRXZlbnQoY2xvc2VFdmVudCk7XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChjbG9zZUV2ZW50LCBzZXJ2ZXIpO1xuICAgIH1cbiAgfSwgY29udGV4dCk7XG59XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBub3JtYWxpemVTZW5kRGF0YShkYXRhKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZGF0YSkgIT09ICdbb2JqZWN0IEJsb2JdJyAmJiAhKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcbiAgICBkYXRhID0gU3RyaW5nKGRhdGEpO1xuICB9XG5cbiAgcmV0dXJuIGRhdGE7XG59XG4iLCJpbXBvcnQgeyBDTE9TRV9DT0RFUyB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBjbG9zZVdlYlNvY2tldENvbm5lY3Rpb24gfSBmcm9tICcuLi9hbGdvcml0aG1zL2Nsb3NlJztcbmltcG9ydCBub3JtYWxpemVTZW5kRGF0YSBmcm9tICcuL25vcm1hbGl6ZS1zZW5kJztcbmltcG9ydCB7IGNyZWF0ZU1lc3NhZ2VFdmVudCB9IGZyb20gJy4uL2V2ZW50L2ZhY3RvcnknO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm94eUZhY3RvcnkodGFyZ2V0KSB7XG4gIGNvbnN0IGhhbmRsZXIgPSB7XG4gICAgZ2V0KG9iaiwgcHJvcCkge1xuICAgICAgaWYgKHByb3AgPT09ICdjbG9zZScpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGNsb3NlKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBvcHRpb25zLmNvZGUgfHwgQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMO1xuICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IG9wdGlvbnMucmVhc29uIHx8ICcnO1xuXG4gICAgICAgICAgY2xvc2VXZWJTb2NrZXRDb25uZWN0aW9uKHRhcmdldCwgY29kZSwgcmVhc29uKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByb3AgPT09ICdzZW5kJykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gc2VuZChkYXRhKSB7XG4gICAgICAgICAgZGF0YSA9IG5vcm1hbGl6ZVNlbmREYXRhKGRhdGEpO1xuXG4gICAgICAgICAgdGFyZ2V0LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgICBjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgICAgICAgICB0eXBlOiAnbWVzc2FnZScsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICAgICAgICAgIHRhcmdldFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvcCA9PT0gJ29uJykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gb25XcmFwcGVyKHR5cGUsIGNiKSB7XG4gICAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoYHNlcnZlcjo6JHt0eXBlfWAsIGNiKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG9ialtwcm9wXTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgcHJveHkgPSBuZXcgUHJveHkodGFyZ2V0LCBoYW5kbGVyKTtcbiAgcmV0dXJuIHByb3h5O1xufVxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbGVuZ3RoSW5VdGY4Qnl0ZXMoc3RyKSB7XG4gIC8vIE1hdGNoZXMgb25seSB0aGUgMTAuLiBieXRlcyB0aGF0IGFyZSBub24taW5pdGlhbCBjaGFyYWN0ZXJzIGluIGEgbXVsdGktYnl0ZSBzZXF1ZW5jZS5cbiAgY29uc3QgbSA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIpLm1hdGNoKC8lWzg5QUJhYl0vZyk7XG4gIHJldHVybiBzdHIubGVuZ3RoICsgKG0gPyBtLmxlbmd0aCA6IDApO1xufVxuIiwiaW1wb3J0IFVSTCBmcm9tICd1cmwtcGFyc2UnO1xuaW1wb3J0IHsgRVJST1JfUFJFRklYIH0gZnJvbSAnLi4vY29uc3RhbnRzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXJsVmVyaWZpY2F0aW9uKHVybCkge1xuICBjb25zdCB1cmxSZWNvcmQgPSBuZXcgVVJMKHVybCk7XG4gIGNvbnN0IHsgcGF0aG5hbWUsIHByb3RvY29sLCBoYXNoIH0gPSB1cmxSZWNvcmQ7XG5cbiAgaWYgKCF1cmwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5DT05TVFJVQ1RPUl9FUlJPUn0gMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgMCBwcmVzZW50LmApO1xuICB9XG5cbiAgaWYgKCFwYXRobmFtZSkge1xuICAgIHVybFJlY29yZC5wYXRobmFtZSA9ICcvJztcbiAgfVxuXG4gIGlmIChwcm90b2NvbCA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYCR7RVJST1JfUFJFRklYLkNPTlNUUlVDVE9SX0VSUk9SfSBUaGUgVVJMICcke3VybFJlY29yZC50b1N0cmluZygpfScgaXMgaW52YWxpZC5gKTtcbiAgfVxuXG4gIGlmIChwcm90b2NvbCAhPT0gJ3dzOicgJiYgcHJvdG9jb2wgIT09ICd3c3M6Jykge1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgIGAke0VSUk9SX1BSRUZJWC5DT05TVFJVQ1RPUl9FUlJPUn0gVGhlIFVSTCdzIHNjaGVtZSBtdXN0IGJlIGVpdGhlciAnd3MnIG9yICd3c3MnLiAnJHtwcm90b2NvbH0nIGlzIG5vdCBhbGxvd2VkLmBcbiAgICApO1xuICB9XG5cbiAgaWYgKGhhc2ggIT09ICcnKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbWF4LWxlbiAqL1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgIGAke1xuICAgICAgICBFUlJPUl9QUkVGSVguQ09OU1RSVUNUT1JfRVJST1JcbiAgICAgIH0gVGhlIFVSTCBjb250YWlucyBhIGZyYWdtZW50IGlkZW50aWZpZXIgKCcke2hhc2h9JykuIEZyYWdtZW50IGlkZW50aWZpZXJzIGFyZSBub3QgYWxsb3dlZCBpbiBXZWJTb2NrZXQgVVJMcy5gXG4gICAgKTtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG1heC1sZW4gKi9cbiAgfVxuXG4gIHJldHVybiB1cmxSZWNvcmQudG9TdHJpbmcoKTtcbn1cbiIsImltcG9ydCB7IEVSUk9SX1BSRUZJWCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHByb3RvY29sVmVyaWZpY2F0aW9uKHByb3RvY29scyA9IFtdKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShwcm90b2NvbHMpICYmIHR5cGVvZiBwcm90b2NvbHMgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGAke0VSUk9SX1BSRUZJWC5DT05TVFJVQ1RPUl9FUlJPUn0gVGhlIHN1YnByb3RvY29sICcke3Byb3RvY29scy50b1N0cmluZygpfScgaXMgaW52YWxpZC5gKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcHJvdG9jb2xzID09PSAnc3RyaW5nJykge1xuICAgIHByb3RvY29scyA9IFtwcm90b2NvbHNdO1xuICB9XG5cbiAgY29uc3QgdW5pcSA9IHByb3RvY29sc1xuICAgIC5tYXAocCA9PiAoeyBjb3VudDogMSwgcHJvdG9jb2w6IHAgfSkpXG4gICAgLnJlZHVjZSgoYSwgYikgPT4ge1xuICAgICAgYVtiLnByb3RvY29sXSA9IChhW2IucHJvdG9jb2xdIHx8IDApICsgYi5jb3VudDtcbiAgICAgIHJldHVybiBhO1xuICAgIH0sIHt9KTtcblxuICBjb25zdCBkdXBsaWNhdGVzID0gT2JqZWN0LmtleXModW5pcSkuZmlsdGVyKGEgPT4gdW5pcVthXSA+IDEpO1xuXG4gIGlmIChkdXBsaWNhdGVzLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYCR7RVJST1JfUFJFRklYLkNPTlNUUlVDVE9SX0VSUk9SfSBUaGUgc3VicHJvdG9jb2wgJyR7ZHVwbGljYXRlc1swXX0nIGlzIGR1cGxpY2F0ZWQuYCk7XG4gIH1cblxuICByZXR1cm4gcHJvdG9jb2xzO1xufVxuIiwiaW1wb3J0IGRlbGF5IGZyb20gJy4vaGVscGVycy9kZWxheSc7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4vaGVscGVycy9sb2dnZXInO1xuaW1wb3J0IEV2ZW50VGFyZ2V0IGZyb20gJy4vZXZlbnQvdGFyZ2V0JztcbmltcG9ydCBuZXR3b3JrQnJpZGdlIGZyb20gJy4vbmV0d29yay1icmlkZ2UnO1xuaW1wb3J0IHByb3h5RmFjdG9yeSBmcm9tICcuL2hlbHBlcnMvcHJveHktZmFjdG9yeSc7XG5pbXBvcnQgbGVuZ3RoSW5VdGY4Qnl0ZXMgZnJvbSAnLi9oZWxwZXJzL2J5dGUtbGVuZ3RoJztcbmltcG9ydCB7IENMT1NFX0NPREVTLCBFUlJPUl9QUkVGSVggfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgdXJsVmVyaWZpY2F0aW9uIGZyb20gJy4vaGVscGVycy91cmwtdmVyaWZpY2F0aW9uJztcbmltcG9ydCBub3JtYWxpemVTZW5kRGF0YSBmcm9tICcuL2hlbHBlcnMvbm9ybWFsaXplLXNlbmQnO1xuaW1wb3J0IHByb3RvY29sVmVyaWZpY2F0aW9uIGZyb20gJy4vaGVscGVycy9wcm90b2NvbC12ZXJpZmljYXRpb24nO1xuaW1wb3J0IHsgY3JlYXRlRXZlbnQsIGNyZWF0ZU1lc3NhZ2VFdmVudCwgY3JlYXRlQ2xvc2VFdmVudCB9IGZyb20gJy4vZXZlbnQvZmFjdG9yeSc7XG5pbXBvcnQgeyBjbG9zZVdlYlNvY2tldENvbm5lY3Rpb24sIGZhaWxXZWJTb2NrZXRDb25uZWN0aW9uIH0gZnJvbSAnLi9hbGdvcml0aG1zL2Nsb3NlJztcblxuLypcbiAqIFRoZSBtYWluIHdlYnNvY2tldCBjbGFzcyB3aGljaCBpcyBkZXNpZ25lZCB0byBtaW1pY2sgdGhlIG5hdGl2ZSBXZWJTb2NrZXQgY2xhc3MgYXMgY2xvc2VcbiAqIGFzIHBvc3NpYmxlLlxuICpcbiAqIGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3dlYi1zb2NrZXRzLmh0bWxcbiAqL1xuY2xhc3MgV2ViU29ja2V0IGV4dGVuZHMgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3Rvcih1cmwsIHByb3RvY29scykge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLnVybCA9IHVybFZlcmlmaWNhdGlvbih1cmwpO1xuICAgIHByb3RvY29scyA9IHByb3RvY29sVmVyaWZpY2F0aW9uKHByb3RvY29scyk7XG4gICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sc1swXSB8fCAnJztcblxuICAgIHRoaXMuYmluYXJ5VHlwZSA9ICdibG9iJztcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ09OTkVDVElORztcblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIC8qXG4gICAgICogVGhpcyBkZWxheSBpcyBuZWVkZWQgc28gdGhhdCB3ZSBkb250IHRyaWdnZXIgYW4gZXZlbnQgYmVmb3JlIHRoZSBjYWxsYmFja3MgaGF2ZSBiZWVuXG4gICAgICogc2V0dXAuIEZvciBleGFtcGxlOlxuICAgICAqXG4gICAgICogdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoJ3dzOi8vbG9jYWxob3N0Jyk7XG4gICAgICpcbiAgICAgKiBJZiB3ZSBkb250IGhhdmUgdGhlIGRlbGF5IHRoZW4gdGhlIGV2ZW50IHdvdWxkIGJlIHRyaWdnZXJlZCByaWdodCBoZXJlIGFuZCB0aGlzIGlzXG4gICAgICogYmVmb3JlIHRoZSBvbm9wZW4gaGFkIGEgY2hhbmNlIHRvIHJlZ2lzdGVyIGl0c2VsZi5cbiAgICAgKlxuICAgICAqIHNvY2tldC5vbm9wZW4gPSAoKSA9PiB7IC8vIHRoaXMgd291bGQgbmV2ZXIgYmUgY2FsbGVkIH07XG4gICAgICpcbiAgICAgKiBhbmQgd2l0aCB0aGUgZGVsYXkgdGhlIGV2ZW50IGdldHMgdHJpZ2dlcmVkIGhlcmUgYWZ0ZXIgYWxsIG9mIHRoZSBjYWxsYmFja3MgaGF2ZSBiZWVuXG4gICAgICogcmVnaXN0ZXJlZCA6LSlcbiAgICAgKi9cbiAgICBkZWxheShmdW5jdGlvbiBkZWxheUNhbGxiYWNrKCkge1xuICAgICAgaWYgKHNlcnZlcikge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2VydmVyLm9wdGlvbnMudmVyaWZ5Q2xpZW50ICYmXG4gICAgICAgICAgdHlwZW9mIHNlcnZlci5vcHRpb25zLnZlcmlmeUNsaWVudCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgICFzZXJ2ZXIub3B0aW9ucy52ZXJpZnlDbGllbnQoKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuXG4gICAgICAgICAgbG9nZ2VyKFxuICAgICAgICAgICAgJ2Vycm9yJyxcbiAgICAgICAgICAgIGBXZWJTb2NrZXQgY29ubmVjdGlvbiB0byAnJHt0aGlzLnVybH0nIGZhaWxlZDogSFRUUCBBdXRoZW50aWNhdGlvbiBmYWlsZWQ7IG5vIHZhbGlkIGNyZWRlbnRpYWxzIGF2YWlsYWJsZWBcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgbmV0d29ya0JyaWRnZS5yZW1vdmVXZWJTb2NrZXQodGhpcywgdGhpcy51cmwpO1xuICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdlcnJvcicsIHRhcmdldDogdGhpcyB9KSk7XG4gICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoeyB0eXBlOiAnY2xvc2UnLCB0YXJnZXQ6IHRoaXMsIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTCB9KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHNlcnZlci5vcHRpb25zLnNlbGVjdFByb3RvY29sICYmIHR5cGVvZiBzZXJ2ZXIub3B0aW9ucy5zZWxlY3RQcm90b2NvbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRQcm90b2NvbCA9IHNlcnZlci5vcHRpb25zLnNlbGVjdFByb3RvY29sKHByb3RvY29scyk7XG4gICAgICAgICAgICBjb25zdCBpc0ZpbGxlZCA9IHNlbGVjdGVkUHJvdG9jb2wgIT09ICcnO1xuICAgICAgICAgICAgY29uc3QgaXNSZXF1ZXN0ZWQgPSBwcm90b2NvbHMuaW5kZXhPZihzZWxlY3RlZFByb3RvY29sKSAhPT0gLTE7XG4gICAgICAgICAgICBpZiAoaXNGaWxsZWQgJiYgIWlzUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRUQ7XG5cbiAgICAgICAgICAgICAgbG9nZ2VyKCdlcnJvcicsIGBXZWJTb2NrZXQgY29ubmVjdGlvbiB0byAnJHt0aGlzLnVybH0nIGZhaWxlZDogSW52YWxpZCBTdWItUHJvdG9jb2xgKTtcblxuICAgICAgICAgICAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVdlYlNvY2tldCh0aGlzLCB0aGlzLnVybCk7XG4gICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdlcnJvcicsIHRhcmdldDogdGhpcyB9KSk7XG4gICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVDbG9zZUV2ZW50KHsgdHlwZTogJ2Nsb3NlJywgdGFyZ2V0OiB0aGlzLCBjb2RlOiBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUwgfSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnByb3RvY29sID0gc2VsZWN0ZWRQcm90b2NvbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gV2ViU29ja2V0Lk9QRU47XG4gICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ29wZW4nLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3Rpb24nIH0pLCBwcm94eUZhY3RvcnkodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlQ2xvc2VFdmVudCh7IHR5cGU6ICdjbG9zZScsIHRhcmdldDogdGhpcywgY29kZTogQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMIH0pKTtcblxuICAgICAgICBsb2dnZXIoJ2Vycm9yJywgYFdlYlNvY2tldCBjb25uZWN0aW9uIHRvICcke3RoaXMudXJsfScgZmFpbGVkYCk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBnZXQgb25vcGVuKCkge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5vcGVuO1xuICB9XG5cbiAgZ2V0IG9ubWVzc2FnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5saXN0ZW5lcnMubWVzc2FnZTtcbiAgfVxuXG4gIGdldCBvbmNsb3NlKCkge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5jbG9zZTtcbiAgfVxuXG4gIGdldCBvbmVycm9yKCkge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5lcnJvcjtcbiAgfVxuXG4gIHNldCBvbm9wZW4obGlzdGVuZXIpIHtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnMub3BlbjtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBsaXN0ZW5lcik7XG4gIH1cblxuICBzZXQgb25tZXNzYWdlKGxpc3RlbmVyKSB7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzLm1lc3NhZ2U7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgbGlzdGVuZXIpO1xuICB9XG5cbiAgc2V0IG9uY2xvc2UobGlzdGVuZXIpIHtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnMuY2xvc2U7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHNldCBvbmVycm9yKGxpc3RlbmVyKSB7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzLmVycm9yO1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBsaXN0ZW5lcik7XG4gIH1cblxuICBzZW5kKGRhdGEpIHtcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ0xPU0lORyB8fCB0aGlzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DTE9TRUQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignV2ViU29ja2V0IGlzIGFscmVhZHkgaW4gQ0xPU0lORyBvciBDTE9TRUQgc3RhdGUnKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBoYW5kbGUgYnVmZmVyZWRBbW91bnRcblxuICAgIGNvbnN0IG1lc3NhZ2VFdmVudCA9IGNyZWF0ZU1lc3NhZ2VFdmVudCh7XG4gICAgICB0eXBlOiAnc2VydmVyOjptZXNzYWdlJyxcbiAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICBkYXRhOiBub3JtYWxpemVTZW5kRGF0YShkYXRhKVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAodGhpcy51cmwpO1xuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgZGVsYXkoKCkgPT4ge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobWVzc2FnZUV2ZW50LCBkYXRhKTtcbiAgICAgIH0sIHNlcnZlcik7XG4gICAgfVxuICB9XG5cbiAgY2xvc2UoY29kZSwgcmVhc29uKSB7XG4gICAgaWYgKGNvZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHR5cGVvZiBjb2RlICE9PSAnbnVtYmVyJyB8fCAoY29kZSAhPT0gMTAwMCAmJiAoY29kZSA8IDMwMDAgfHwgY29kZSA+IDQ5OTkpKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGAke0VSUk9SX1BSRUZJWC5DTE9TRV9FUlJPUn0gVGhlIGNvZGUgbXVzdCBiZSBlaXRoZXIgMTAwMCwgb3IgYmV0d2VlbiAzMDAwIGFuZCA0OTk5LiAke2NvZGV9IGlzIG5laXRoZXIuYFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChyZWFzb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgbGVuZ3RoID0gbGVuZ3RoSW5VdGY4Qnl0ZXMocmVhc29uKTtcblxuICAgICAgaWYgKGxlbmd0aCA+IDEyMykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYCR7RVJST1JfUFJFRklYLkNMT1NFX0VSUk9SfSBUaGUgbWVzc2FnZSBtdXN0IG5vdCBiZSBncmVhdGVyIHRoYW4gMTIzIGJ5dGVzLmApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DTE9TSU5HIHx8IHRoaXMucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0LkNMT1NFRCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DT05ORUNUSU5HKSB7XG4gICAgICBmYWlsV2ViU29ja2V0Q29ubmVjdGlvbih0aGlzLCBjb2RlLCByZWFzb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjbG9zZVdlYlNvY2tldENvbm5lY3Rpb24odGhpcywgY29kZSwgcmVhc29uKTtcbiAgICB9XG4gIH1cbn1cblxuV2ViU29ja2V0LkNPTk5FQ1RJTkcgPSAwO1xuV2ViU29ja2V0LnByb3RvdHlwZS5DT05ORUNUSU5HID0gV2ViU29ja2V0LkNPTk5FQ1RJTkc7XG5XZWJTb2NrZXQuT1BFTiA9IDE7XG5XZWJTb2NrZXQucHJvdG90eXBlLk9QRU4gPSBXZWJTb2NrZXQuT1BFTjtcbldlYlNvY2tldC5DTE9TSU5HID0gMjtcbldlYlNvY2tldC5wcm90b3R5cGUuQ0xPU0lORyA9IFdlYlNvY2tldC5DTE9TSU5HO1xuV2ViU29ja2V0LkNMT1NFRCA9IDM7XG5XZWJTb2NrZXQucHJvdG90eXBlLkNMT1NFRCA9IFdlYlNvY2tldC5DTE9TRUQ7XG5cbmV4cG9ydCBkZWZhdWx0IFdlYlNvY2tldDtcbiIsImV4cG9ydCBkZWZhdWx0IGFyciA9PlxuICBhcnIucmVkdWNlKChkZWR1cGVkLCBiKSA9PiB7XG4gICAgaWYgKGRlZHVwZWQuaW5kZXhPZihiKSA+IC0xKSByZXR1cm4gZGVkdXBlZDtcbiAgICByZXR1cm4gZGVkdXBlZC5jb25jYXQoYik7XG4gIH0sIFtdKTtcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJldHJpZXZlR2xvYmFsT2JqZWN0KCkge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gd2luZG93O1xuICB9XG5cbiAgcmV0dXJuIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyA/IGdsb2JhbCA6IHRoaXM7XG59XG4iLCJpbXBvcnQgVVJMIGZyb20gJ3VybC1wYXJzZSc7XG5pbXBvcnQgV2ViU29ja2V0IGZyb20gJy4vd2Vic29ja2V0JztcbmltcG9ydCBkZWR1cGUgZnJvbSAnLi9oZWxwZXJzL2RlZHVwZSc7XG5pbXBvcnQgRXZlbnRUYXJnZXQgZnJvbSAnLi9ldmVudC90YXJnZXQnO1xuaW1wb3J0IHsgQ0xPU0VfQ09ERVMgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgbmV0d29ya0JyaWRnZSBmcm9tICcuL25ldHdvcmstYnJpZGdlJztcbmltcG9ydCBnbG9iYWxPYmplY3QgZnJvbSAnLi9oZWxwZXJzL2dsb2JhbC1vYmplY3QnO1xuaW1wb3J0IG5vcm1hbGl6ZVNlbmREYXRhIGZyb20gJy4vaGVscGVycy9ub3JtYWxpemUtc2VuZCc7XG5pbXBvcnQgeyBjcmVhdGVFdmVudCwgY3JlYXRlTWVzc2FnZUV2ZW50LCBjcmVhdGVDbG9zZUV2ZW50IH0gZnJvbSAnLi9ldmVudC9mYWN0b3J5JztcblxuY2xhc3MgU2VydmVyIGV4dGVuZHMgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgdXJsUmVjb3JkID0gbmV3IFVSTCh1cmwpO1xuXG4gICAgaWYgKCF1cmxSZWNvcmQucGF0aG5hbWUpIHtcbiAgICAgIHVybFJlY29yZC5wYXRobmFtZSA9ICcvJztcbiAgICB9XG5cbiAgICB0aGlzLnVybCA9IHVybFJlY29yZC50b1N0cmluZygpO1xuXG4gICAgdGhpcy5vcmlnaW5hbFdlYlNvY2tldCA9IG51bGw7XG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5hdHRhY2hTZXJ2ZXIodGhpcywgdGhpcy51cmwpO1xuXG4gICAgaWYgKCFzZXJ2ZXIpIHtcbiAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdlcnJvcicgfSkpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIG1vY2sgc2VydmVyIGlzIGFscmVhZHkgbGlzdGVuaW5nIG9uIHRoaXMgdXJsJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnZlcmlmeUNsaWVudCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIG9wdGlvbnMudmVyaWZ5Q2xpZW50ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuc2VsZWN0UHJvdG9jb2wgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBvcHRpb25zLnNlbGVjdFByb3RvY29sID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuc3RhcnQoKTtcbiAgfVxuXG4gIC8qXG4gICAqIEF0dGFjaGVzIHRoZSBtb2NrIHdlYnNvY2tldCBvYmplY3QgdG8gdGhlIGdsb2JhbCBvYmplY3RcbiAgICovXG4gIHN0YXJ0KCkge1xuICAgIGNvbnN0IGdsb2JhbE9iaiA9IGdsb2JhbE9iamVjdCgpO1xuXG4gICAgaWYgKGdsb2JhbE9iai5XZWJTb2NrZXQpIHtcbiAgICAgIHRoaXMub3JpZ2luYWxXZWJTb2NrZXQgPSBnbG9iYWxPYmouV2ViU29ja2V0O1xuICAgIH1cblxuICAgIGdsb2JhbE9iai5XZWJTb2NrZXQgPSBXZWJTb2NrZXQ7XG4gIH1cblxuICAvKlxuICAgKiBSZW1vdmVzIHRoZSBtb2NrIHdlYnNvY2tldCBvYmplY3QgZnJvbSB0aGUgZ2xvYmFsIG9iamVjdFxuICAgKi9cbiAgc3RvcChjYWxsYmFjayA9ICgpID0+IHt9KSB7XG4gICAgY29uc3QgZ2xvYmFsT2JqID0gZ2xvYmFsT2JqZWN0KCk7XG5cbiAgICBpZiAodGhpcy5vcmlnaW5hbFdlYlNvY2tldCkge1xuICAgICAgZ2xvYmFsT2JqLldlYlNvY2tldCA9IHRoaXMub3JpZ2luYWxXZWJTb2NrZXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBnbG9iYWxPYmouV2ViU29ja2V0O1xuICAgIH1cblxuICAgIHRoaXMub3JpZ2luYWxXZWJTb2NrZXQgPSBudWxsO1xuXG4gICAgbmV0d29ya0JyaWRnZS5yZW1vdmVTZXJ2ZXIodGhpcy51cmwpO1xuXG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBUaGlzIGlzIHRoZSBtYWluIGZ1bmN0aW9uIGZvciB0aGUgbW9jayBzZXJ2ZXIgdG8gc3Vic2NyaWJlIHRvIHRoZSBvbiBldmVudHMuXG4gICAqXG4gICAqIGllOiBtb2NrU2VydmVyLm9uKCdjb25uZWN0aW9uJywgZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCdhIG1vY2sgY2xpZW50IGNvbm5lY3RlZCcpOyB9KTtcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgZXZlbnQga2V5IHRvIHN1YnNjcmliZSB0by4gVmFsaWQga2V5cyBhcmU6IGNvbm5lY3Rpb24sIG1lc3NhZ2UsIGFuZCBjbG9zZS5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgd2hpY2ggc2hvdWxkIGJlIGNhbGxlZCB3aGVuIGEgY2VydGFpbiBldmVudCBpcyBmaXJlZC5cbiAgICovXG4gIG9uKHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qXG4gICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiBhbmQgdHJpZ2dlcnMgdGhlIG9uY2xvc2UgbWV0aG9kIG9mIGFsbCBsaXN0ZW5pbmdcbiAgICogd2Vic29ja2V0cy4gQWZ0ZXIgdGhhdCBpdCByZW1vdmVzIGl0c2VsZiBmcm9tIHRoZSB1cmxNYXAgc28gYW5vdGhlciBzZXJ2ZXJcbiAgICogY291bGQgYWRkIGl0c2VsZiB0byB0aGUgdXJsLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9uc1xuICAgKi9cbiAgY2xvc2Uob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBjb2RlLCByZWFzb24sIHdhc0NsZWFuIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cCh0aGlzLnVybCk7XG5cbiAgICAvLyBSZW1vdmUgc2VydmVyIGJlZm9yZSBub3RpZmljYXRpb25zIHRvIHByZXZlbnQgaW1tZWRpYXRlIHJlY29ubmVjdHMgZnJvbVxuICAgIC8vIHNvY2tldCBvbmNsb3NlIGhhbmRsZXJzXG4gICAgbmV0d29ya0JyaWRnZS5yZW1vdmVTZXJ2ZXIodGhpcy51cmwpO1xuXG4gICAgbGlzdGVuZXJzLmZvckVhY2goc29ja2V0ID0+IHtcbiAgICAgIHNvY2tldC5yZWFkeVN0YXRlID0gV2ViU29ja2V0LkNMT1NFO1xuICAgICAgc29ja2V0LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgICAgIHR5cGU6ICdjbG9zZScsXG4gICAgICAgICAgdGFyZ2V0OiBzb2NrZXQsXG4gICAgICAgICAgY29kZTogY29kZSB8fCBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUwsXG4gICAgICAgICAgcmVhc29uOiByZWFzb24gfHwgJycsXG4gICAgICAgICAgd2FzQ2xlYW5cbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlQ2xvc2VFdmVudCh7IHR5cGU6ICdjbG9zZScgfSksIHRoaXMpO1xuICB9XG5cbiAgLypcbiAgICogU2VuZHMgYSBnZW5lcmljIG1lc3NhZ2UgZXZlbnQgdG8gYWxsIG1vY2sgY2xpZW50cy5cbiAgICovXG4gIGVtaXQoZXZlbnQsIGRhdGEsIG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCB7IHdlYnNvY2tldHMgfSA9IG9wdGlvbnM7XG5cbiAgICBpZiAoIXdlYnNvY2tldHMpIHtcbiAgICAgIHdlYnNvY2tldHMgPSBuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgYXJndW1lbnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgIGRhdGEgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEsIGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgICAgZGF0YSA9IGRhdGEubWFwKGl0ZW0gPT4gbm9ybWFsaXplU2VuZERhdGEoaXRlbSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhID0gbm9ybWFsaXplU2VuZERhdGEoZGF0YSk7XG4gICAgfVxuXG4gICAgd2Vic29ja2V0cy5mb3JFYWNoKHNvY2tldCA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICBzb2NrZXQuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgICAgICAgdHlwZTogZXZlbnQsXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgb3JpZ2luOiB0aGlzLnVybCxcbiAgICAgICAgICAgIHRhcmdldDogc29ja2V0XG4gICAgICAgICAgfSksXG4gICAgICAgICAgLi4uZGF0YVxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc29ja2V0LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgY3JlYXRlTWVzc2FnZUV2ZW50KHtcbiAgICAgICAgICAgIHR5cGU6IGV2ZW50LFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICAgICAgICB0YXJnZXQ6IHNvY2tldFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIHdlYnNvY2tldHMgd2hpY2ggYXJlIGxpc3RlbmluZyB0byB0aGlzIHNlcnZlclxuICAgKiBUT09EOiB0aGlzIHNob3VsZCByZXR1cm4gYSBzZXQgYW5kIG5vdCBiZSBhIG1ldGhvZFxuICAgKi9cbiAgY2xpZW50cygpIHtcbiAgICByZXR1cm4gbmV0d29ya0JyaWRnZS53ZWJzb2NrZXRzTG9va3VwKHRoaXMudXJsKTtcbiAgfVxuXG4gIC8qXG4gICAqIFByZXBhcmVzIGEgbWV0aG9kIHRvIHN1Ym1pdCBhbiBldmVudCB0byBtZW1iZXJzIG9mIHRoZSByb29tXG4gICAqXG4gICAqIGUuZy4gc2VydmVyLnRvKCdteS1yb29tJykuZW1pdCgnaGkhJyk7XG4gICAqL1xuICB0byhyb29tLCBicm9hZGNhc3RlciwgYnJvYWRjYXN0TGlzdCA9IFtdKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd2Vic29ja2V0cyA9IGRlZHVwZShicm9hZGNhc3RMaXN0LmNvbmNhdChuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwsIHJvb20sIGJyb2FkY2FzdGVyKSkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvOiAoY2hhaW5lZFJvb20sIGNoYWluZWRCcm9hZGNhc3RlcikgPT4gdGhpcy50by5jYWxsKHRoaXMsIGNoYWluZWRSb29tLCBjaGFpbmVkQnJvYWRjYXN0ZXIsIHdlYnNvY2tldHMpLFxuICAgICAgZW1pdChldmVudCwgZGF0YSkge1xuICAgICAgICBzZWxmLmVtaXQoZXZlbnQsIGRhdGEsIHsgd2Vic29ja2V0cyB9KTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogQWxpYXMgZm9yIFNlcnZlci50b1xuICAgKi9cbiAgaW4oLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLnRvLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9XG5cbiAgLypcbiAgICogU2ltdWxhdGUgYW4gZXZlbnQgZnJvbSB0aGUgc2VydmVyIHRvIHRoZSBjbGllbnRzLiBVc2VmdWwgZm9yXG4gICAqIHNpbXVsYXRpbmcgZXJyb3JzLlxuICAgKi9cbiAgc2ltdWxhdGUoZXZlbnQpIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwpO1xuXG4gICAgaWYgKGV2ZW50ID09PSAnZXJyb3InKSB7XG4gICAgICBsaXN0ZW5lcnMuZm9yRWFjaChzb2NrZXQgPT4ge1xuICAgICAgICBzb2NrZXQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRTtcbiAgICAgICAgc29ja2V0LmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InIH0pKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG4vKlxuICogQWx0ZXJuYXRpdmUgY29uc3RydWN0b3IgdG8gc3VwcG9ydCBuYW1lc3BhY2VzIGluIHNvY2tldC5pb1xuICpcbiAqIGh0dHA6Ly9zb2NrZXQuaW8vZG9jcy9yb29tcy1hbmQtbmFtZXNwYWNlcy8jY3VzdG9tLW5hbWVzcGFjZXNcbiAqL1xuU2VydmVyLm9mID0gZnVuY3Rpb24gb2YodXJsKSB7XG4gIHJldHVybiBuZXcgU2VydmVyKHVybCk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTZXJ2ZXI7XG4iLCJpbXBvcnQgVVJMIGZyb20gJ3VybC1wYXJzZSc7XG5pbXBvcnQgZGVsYXkgZnJvbSAnLi9oZWxwZXJzL2RlbGF5JztcbmltcG9ydCBFdmVudFRhcmdldCBmcm9tICcuL2V2ZW50L3RhcmdldCc7XG5pbXBvcnQgbmV0d29ya0JyaWRnZSBmcm9tICcuL25ldHdvcmstYnJpZGdlJztcbmltcG9ydCB7IENMT1NFX0NPREVTIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuL2hlbHBlcnMvbG9nZ2VyJztcbmltcG9ydCB7IGNyZWF0ZUV2ZW50LCBjcmVhdGVNZXNzYWdlRXZlbnQsIGNyZWF0ZUNsb3NlRXZlbnQgfSBmcm9tICcuL2V2ZW50L2ZhY3RvcnknO1xuXG4vKlxuICogVGhlIHNvY2tldC1pbyBjbGFzcyBpcyBkZXNpZ25lZCB0byBtaW1pY2sgdGhlIHJlYWwgQVBJIGFzIGNsb3NlbHkgYXMgcG9zc2libGUuXG4gKlxuICogaHR0cDovL3NvY2tldC5pby9kb2NzL1xuICovXG5jbGFzcyBTb2NrZXRJTyBleHRlbmRzIEV2ZW50VGFyZ2V0IHtcbiAgLypcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICAgKi9cbiAgY29uc3RydWN0b3IodXJsID0gJ3NvY2tldC5pbycsIHByb3RvY29sID0gJycpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5iaW5hcnlUeXBlID0gJ2Jsb2InO1xuICAgIGNvbnN0IHVybFJlY29yZCA9IG5ldyBVUkwodXJsKTtcblxuICAgIGlmICghdXJsUmVjb3JkLnBhdGhuYW1lKSB7XG4gICAgICB1cmxSZWNvcmQucGF0aG5hbWUgPSAnLyc7XG4gICAgfVxuXG4gICAgdGhpcy51cmwgPSB1cmxSZWNvcmQudG9TdHJpbmcoKTtcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBTb2NrZXRJTy5DT05ORUNUSU5HO1xuICAgIHRoaXMucHJvdG9jb2wgPSAnJztcblxuICAgIGlmICh0eXBlb2YgcHJvdG9jb2wgPT09ICdzdHJpbmcnIHx8ICh0eXBlb2YgcHJvdG9jb2wgPT09ICdvYmplY3QnICYmIHByb3RvY29sICE9PSBudWxsKSkge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwcm90b2NvbCkgJiYgcHJvdG9jb2wubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sWzBdO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIC8qXG4gICAgICogRGVsYXkgdHJpZ2dlcmluZyB0aGUgY29ubmVjdGlvbiBldmVudHMgc28gdGhleSBjYW4gYmUgZGVmaW5lZCBpbiB0aW1lLlxuICAgICAqL1xuICAgIGRlbGF5KGZ1bmN0aW9uIGRlbGF5Q2FsbGJhY2soKSB7XG4gICAgICBpZiAoc2VydmVyKSB7XG4gICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFNvY2tldElPLk9QRU47XG4gICAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3Rpb24nIH0pLCBzZXJ2ZXIsIHRoaXMpO1xuICAgICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdjb25uZWN0JyB9KSwgc2VydmVyLCB0aGlzKTsgLy8gYWxpYXNcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3QnLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gU29ja2V0SU8uQ0xPU0VEO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgY3JlYXRlQ2xvc2VFdmVudCh7XG4gICAgICAgICAgICB0eXBlOiAnY2xvc2UnLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICAgICAgY29kZTogQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcblxuICAgICAgICBsb2dnZXIoJ2Vycm9yJywgYFNvY2tldC5pbyBjb25uZWN0aW9uIHRvICcke3RoaXMudXJsfScgZmFpbGVkYCk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG5cbiAgICAvKipcbiAgICAgIEFkZCBhbiBhbGlhc2VkIGV2ZW50IGxpc3RlbmVyIGZvciBjbG9zZSAvIGRpc2Nvbm5lY3RcbiAgICAgKi9cbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgZXZlbnQgPT4ge1xuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBjcmVhdGVDbG9zZUV2ZW50KHtcbiAgICAgICAgICB0eXBlOiAnZGlzY29ubmVjdCcsXG4gICAgICAgICAgdGFyZ2V0OiBldmVudC50YXJnZXQsXG4gICAgICAgICAgY29kZTogZXZlbnQuY29kZVxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIENsb3NlcyB0aGUgU29ja2V0SU8gY29ubmVjdGlvbiBvciBjb25uZWN0aW9uIGF0dGVtcHQsIGlmIGFueS5cbiAgICogSWYgdGhlIGNvbm5lY3Rpb24gaXMgYWxyZWFkeSBDTE9TRUQsIHRoaXMgbWV0aG9kIGRvZXMgbm90aGluZy5cbiAgICovXG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAodGhpcy51cmwpO1xuICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIHRoaXMucmVhZHlTdGF0ZSA9IFNvY2tldElPLkNMT1NFRDtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoXG4gICAgICBjcmVhdGVDbG9zZUV2ZW50KHtcbiAgICAgICAgdHlwZTogJ2Nsb3NlJyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICBjb2RlOiBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBjcmVhdGVDbG9zZUV2ZW50KHtcbiAgICAgICAgICB0eXBlOiAnZGlzY29ubmVjdCcsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICAgIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTFxuICAgICAgICB9KSxcbiAgICAgICAgc2VydmVyXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogQWxpYXMgZm9yIFNvY2tldCNjbG9zZVxuICAgKlxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vc29ja2V0aW8vc29ja2V0LmlvLWNsaWVudC9ibG9iL21hc3Rlci9saWIvc29ja2V0LmpzI0wzODNcbiAgICovXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvc2UoKTtcbiAgfVxuXG4gIC8qXG4gICAqIFN1Ym1pdHMgYW4gZXZlbnQgdG8gdGhlIHNlcnZlciB3aXRoIGEgcGF5bG9hZFxuICAgKi9cbiAgZW1pdChldmVudCwgLi4uZGF0YSkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU29ja2V0SU8gaXMgYWxyZWFkeSBpbiBDTE9TSU5HIG9yIENMT1NFRCBzdGF0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VFdmVudCA9IGNyZWF0ZU1lc3NhZ2VFdmVudCh7XG4gICAgICB0eXBlOiBldmVudCxcbiAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICBkYXRhXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZXJ2ZXIgPSBuZXR3b3JrQnJpZGdlLnNlcnZlckxvb2t1cCh0aGlzLnVybCk7XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChtZXNzYWdlRXZlbnQsIC4uLmRhdGEpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogU3VibWl0cyBhICdtZXNzYWdlJyBldmVudCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBTaG91bGQgYmVoYXZlIGV4YWN0bHkgbGlrZSBXZWJTb2NrZXQjc2VuZFxuICAgKlxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vc29ja2V0aW8vc29ja2V0LmlvLWNsaWVudC9ibG9iL21hc3Rlci9saWIvc29ja2V0LmpzI0wxMTNcbiAgICovXG4gIHNlbmQoZGF0YSkge1xuICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogRm9yIGJyb2FkY2FzdGluZyBldmVudHMgdG8gb3RoZXIgY29ubmVjdGVkIHNvY2tldHMuXG4gICAqXG4gICAqIGUuZy4gc29ja2V0LmJyb2FkY2FzdC5lbWl0KCdoaSEnKTtcbiAgICogZS5nLiBzb2NrZXQuYnJvYWRjYXN0LnRvKCdteS1yb29tJykuZW1pdCgnaGkhJyk7XG4gICAqL1xuICBnZXQgYnJvYWRjYXN0KCkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU29ja2V0SU8gaXMgYWxyZWFkeSBpbiBDTE9TSU5HIG9yIENMT1NFRCBzdGF0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKHRoaXMudXJsKTtcbiAgICBpZiAoIXNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb2NrZXRJTyBjYW4gbm90IGZpbmQgYSBzZXJ2ZXIgYXQgdGhlIHNwZWNpZmllZCBVUkwgKCR7dGhpcy51cmx9KWApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBlbWl0KGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIHNlcnZlci5lbWl0KGV2ZW50LCBkYXRhLCB7IHdlYnNvY2tldHM6IG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cChzZWxmLnVybCwgbnVsbCwgc2VsZikgfSk7XG4gICAgICAgIHJldHVybiBzZWxmO1xuICAgICAgfSxcbiAgICAgIHRvKHJvb20pIHtcbiAgICAgICAgcmV0dXJuIHNlcnZlci50byhyb29tLCBzZWxmKTtcbiAgICAgIH0sXG4gICAgICBpbihyb29tKSB7XG4gICAgICAgIHJldHVybiBzZXJ2ZXIuaW4ocm9vbSwgc2VsZik7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIEZvciByZWdpc3RlcmluZyBldmVudHMgdG8gYmUgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyXG4gICAqL1xuICBvbih0eXBlLCBjYWxsYmFjaykge1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKlxuICAgKiBSZW1vdmUgZXZlbnQgbGlzdGVuZXJcbiAgICpcbiAgICogaHR0cHM6Ly9zb2NrZXQuaW8vZG9jcy9jbGllbnQtYXBpLyNzb2NrZXQtb24tZXZlbnRuYW1lLWNhbGxiYWNrXG4gICAqL1xuICBvZmYodHlwZSkge1xuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlKTtcbiAgfVxuXG4gIC8qXG4gICAqIEpvaW4gYSByb29tIG9uIGEgc2VydmVyXG4gICAqXG4gICAqIGh0dHA6Ly9zb2NrZXQuaW8vZG9jcy9yb29tcy1hbmQtbmFtZXNwYWNlcy8jam9pbmluZy1hbmQtbGVhdmluZ1xuICAgKi9cbiAgam9pbihyb29tKSB7XG4gICAgbmV0d29ya0JyaWRnZS5hZGRNZW1iZXJzaGlwVG9Sb29tKHRoaXMsIHJvb20pO1xuICB9XG5cbiAgLypcbiAgICogR2V0IHRoZSB3ZWJzb2NrZXQgdG8gbGVhdmUgdGhlIHJvb21cbiAgICpcbiAgICogaHR0cDovL3NvY2tldC5pby9kb2NzL3Jvb21zLWFuZC1uYW1lc3BhY2VzLyNqb2luaW5nLWFuZC1sZWF2aW5nXG4gICAqL1xuICBsZWF2ZShyb29tKSB7XG4gICAgbmV0d29ya0JyaWRnZS5yZW1vdmVNZW1iZXJzaGlwRnJvbVJvb20odGhpcywgcm9vbSk7XG4gIH1cblxuICB0byhyb29tKSB7XG4gICAgcmV0dXJuIHRoaXMuYnJvYWRjYXN0LnRvKHJvb20pO1xuICB9XG5cbiAgaW4oKSB7XG4gICAgcmV0dXJuIHRoaXMudG8uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfVxuXG4gIC8qXG4gICAqIEludm9rZXMgYWxsIGxpc3RlbmVyIGZ1bmN0aW9ucyB0aGF0IGFyZSBsaXN0ZW5pbmcgdG8gdGhlIGdpdmVuIGV2ZW50LnR5cGUgcHJvcGVydHkuIEVhY2hcbiAgICogbGlzdGVuZXIgd2lsbCBiZSBwYXNzZWQgdGhlIGV2ZW50IGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGV2ZW50IC0gZXZlbnQgb2JqZWN0IHdoaWNoIHdpbGwgYmUgcGFzc2VkIHRvIGFsbCBsaXN0ZW5lcnMgb2YgdGhlIGV2ZW50LnR5cGUgcHJvcGVydHlcbiAgICovXG4gIGRpc3BhdGNoRXZlbnQoZXZlbnQsIC4uLmN1c3RvbUFyZ3VtZW50cykge1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IGV2ZW50LnR5cGU7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheShsaXN0ZW5lcnMpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbGlzdGVuZXJzLmZvckVhY2gobGlzdGVuZXIgPT4ge1xuICAgICAgaWYgKGN1c3RvbUFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGN1c3RvbUFyZ3VtZW50cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZWd1bGFyIFdlYlNvY2tldHMgZXhwZWN0IGEgTWVzc2FnZUV2ZW50IGJ1dCBTb2NrZXRpby5pbyBqdXN0IHdhbnRzIHJhdyBkYXRhXG4gICAgICAgIC8vICBwYXlsb2FkIGluc3RhbmNlb2YgTWVzc2FnZUV2ZW50IHdvcmtzLCBidXQgeW91IGNhbid0IGlzbnRhbmNlIG9mIE5vZGVFdmVudFxuICAgICAgICAvLyAgZm9yIG5vdyB3ZSBkZXRlY3QgaWYgdGhlIG91dHB1dCBoYXMgZGF0YSBkZWZpbmVkIG9uIGl0XG4gICAgICAgIGxpc3RlbmVyLmNhbGwodGhpcywgZXZlbnQuZGF0YSA/IGV2ZW50LmRhdGEgOiBldmVudCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuU29ja2V0SU8uQ09OTkVDVElORyA9IDA7XG5Tb2NrZXRJTy5PUEVOID0gMTtcblNvY2tldElPLkNMT1NJTkcgPSAyO1xuU29ja2V0SU8uQ0xPU0VEID0gMztcblxuLypcbiAqIFN0YXRpYyBjb25zdHJ1Y3RvciBtZXRob2RzIGZvciB0aGUgSU8gU29ja2V0XG4gKi9cbmNvbnN0IElPID0gZnVuY3Rpb24gaW9Db25zdHJ1Y3Rvcih1cmwsIHByb3RvY29sKSB7XG4gIHJldHVybiBuZXcgU29ja2V0SU8odXJsLCBwcm90b2NvbCk7XG59O1xuXG4vKlxuICogQWxpYXMgdGhlIHJhdyBJTygpIGNvbnN0cnVjdG9yXG4gKi9cbklPLmNvbm5lY3QgPSBmdW5jdGlvbiBpb0Nvbm5lY3QodXJsLCBwcm90b2NvbCkge1xuICAvKiBlc2xpbnQtZGlzYWJsZSBuZXctY2FwICovXG4gIHJldHVybiBJTyh1cmwsIHByb3RvY29sKTtcbiAgLyogZXNsaW50LWVuYWJsZSBuZXctY2FwICovXG59O1xuXG5leHBvcnQgZGVmYXVsdCBJTztcbiIsImltcG9ydCBNb2NrU2VydmVyIGZyb20gJy4vc2VydmVyJztcbmltcG9ydCBNb2NrU29ja2V0SU8gZnJvbSAnLi9zb2NrZXQtaW8nO1xuaW1wb3J0IE1vY2tXZWJTb2NrZXQgZnJvbSAnLi93ZWJzb2NrZXQnO1xuXG5leHBvcnQgY29uc3QgU2VydmVyID0gTW9ja1NlcnZlcjtcbmV4cG9ydCBjb25zdCBXZWJTb2NrZXQgPSBNb2NrV2ViU29ja2V0O1xuZXhwb3J0IGNvbnN0IFNvY2tldElPID0gTW9ja1NvY2tldElPO1xuIl0sIm5hbWVzIjpbImdsb2JhbCIsInFzIiwicmVxdWlyZWQiLCJjb25zdCIsInRoaXMiLCJzdXBlciIsIldlYlNvY2tldCIsIlVSTCIsImxvZ2dlciIsIlNlcnZlciIsImdsb2JhbE9iamVjdCIsIlNvY2tldElPIiwiTW9ja1NlcnZlciIsIk1vY2tXZWJTb2NrZXQiLCJNb2NrU29ja2V0SU8iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBV0EsZ0JBQWMsR0FBRyxTQUFTLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO0VBQ2pELFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLEdB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
