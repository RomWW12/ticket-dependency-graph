var jQuery = require('jquery');
var opts = {
  version: 1,
  apiEndpoint: 'https://api.clubhouse.io/',
  authEndpoint: 'https://trello.com',
  intentEndpoint: 'https://trello.com',
  key: '9685b92ee42080b94102b49fe50d2bb1',
};

var deferred,
  isFunction,
  isReady,
  ready,
  waitUntil,
  wrapper,
  slice = [].slice;

wrapper = function(window, jQuery, opts) {
  var $,
    Trello,
    apiEndpoint,
    authEndpoint,
    authorizeURL,
    baseURL,
    collection,
    fn,
    fn1,
    i,
    intentEndpoint,
    j,
    key,
    len,
    len1,
    localStorage,
    location,
    parseRestArgs,
    readStorage,
    ref,
    ref1,
    storagePrefix,
    token,
    type,
    version,
    writeStorage;
  $ = jQuery;
  (key = opts.key),
    (token = opts.token),
    (apiEndpoint = opts.apiEndpoint),
    (authEndpoint = opts.authEndpoint),
    (intentEndpoint = opts.intentEndpoint),
    (version = opts.version);
  baseURL = apiEndpoint;
  location = window.location;
  Trello = {
    version: function() {
      return version;
    },
    key: function() {
      return key;
    },
    setKey: function(newKey) {
      key = newKey;
    },
    token: function() {
      return token;
    },
    setToken: function(newToken) {
      token = newToken;
    },
    getAjax: $.get,
    rest: function() {
      var args, error, method, params, path, ref, success;
      (method = arguments[0]),
        (args = 2 <= arguments.length ? slice.call(arguments, 1) : []);
      (ref = parseRestArgs(args)),
        (path = ref[0]),
        (params = ref[1]),
        (success = ref[2]),
        (error = ref[3]);
      opts = {
        url: '' + baseURL + path,
        type: method,
        data: {},
        dataType: 'json',
        success: success,
        error: error,
      };
      if (!$.support.cors) {
        opts.dataType = 'jsonp';
        if (method !== 'GET') {
          opts.type = 'GET';
          $.extend(opts.data, {
            _method: method,
          });
        }
      }
      if (key) {
        opts.data.key = key;
      }
      if (token) {
        opts.data.token = token;
      }
      if (params != null) {
        $.extend(opts.data, params);
      }
      return $.ajax(opts);
    },
    authorized: function() {
      return token != null;
    },
    deauthorize: function() {
      token = null;
      writeStorage('token', token);
    },
    authorize: function(userOpts) {
      var k, persistToken, ref, regexToken, scope, v;
      opts = $.extend(
        true,
        {
          type: 'redirect',
          persist: true,
          interactive: true,
          scope: {
            read: true,
            write: false,
            account: false,
          },
          expiration: '30days',
        },
        userOpts
      );
      regexToken = /[&#]?token=([0-9a-f]{64})/;
      persistToken = function() {
        if (opts.persist && token != null) {
          return writeStorage('token', token);
        }
      };
      if (opts.persist) {
        if (token == null) {
          token = readStorage('token');
        }
      }
      if (token == null) {
        token =
          (ref = regexToken.exec(location.hash)) != null ? ref[1] : void 0;
      }
      if (this.authorized()) {
        persistToken();
        location.hash = location.hash.replace(regexToken, '');
        return typeof opts.success === 'function' ? opts.success() : void 0;
      }
      if (!opts.interactive) {
        return typeof opts.error === 'function' ? opts.error() : void 0;
      }
      scope = (function() {
        var ref1, results;
        ref1 = opts.scope;
        results = [];
        for (k in ref1) {
          v = ref1[k];
          if (v) {
            results.push(k);
          }
        }
        return results;
      })().join(',');
      switch (opts.type) {
        case 'popup':
          (function() {
            var authWindow,
              height,
              left,
              origin,
              receiveMessage,
              ref1,
              top,
              width;
            waitUntil(
              'authorized',
              (function(_this) {
                return function(isAuthorized) {
                  if (isAuthorized) {
                    persistToken();
                    return typeof opts.success === 'function'
                      ? opts.success()
                      : void 0;
                  } else {
                    return typeof opts.error === 'function'
                      ? opts.error()
                      : void 0;
                  }
                };
              })(this)
            );
            width = 420;
            height = 470;
            left = window.screenX + (window.innerWidth - width) / 2;
            top = window.screenY + (window.innerHeight - height) / 2;
            origin =
              (ref1 = /^[a-z]+:\/\/[^\/]*/.exec(location)) != null
                ? ref1[0]
                : void 0;
            authWindow = window.open(
              authorizeURL({
                return_url: origin,
                callback_method: 'postMessage',
                scope: scope,
                expiration: opts.expiration,
                name: opts.name,
              }),
              'trello',
              'width=' +
                width +
                ',height=' +
                height +
                ',left=' +
                left +
                ',top=' +
                top
            );
            receiveMessage = function(event) {
              var ref2;
              if (
                event.origin !== authEndpoint ||
                event.source !== authWindow
              ) {
                return;
              }
              if ((ref2 = event.source) != null) {
                ref2.close();
              }
              if (event.data != null && /[0-9a-f]{64}/.test(event.data)) {
                token = event.data;
              } else {
                token = null;
              }
              if (typeof window.removeEventListener === 'function') {
                window.removeEventListener('message', receiveMessage, false);
              }
              isReady('authorized', Trello.authorized());
            };
            return typeof window.addEventListener === 'function'
              ? window.addEventListener('message', receiveMessage, false)
              : void 0;
          })();
          break;
        default:
          window.location = authorizeURL({
            redirect_uri: location.href,
            callback_method: 'fragment',
            scope: scope,
            expiration: opts.expiration,
            name: opts.name,
          });
      }
    },
    addCard: function(options, next) {
      var baseArgs, getCard;
      baseArgs = {
        mode: 'popup',
        source: key || window.location.host,
      };
      getCard = function(callback) {
        var height, left, returnUrl, top, width;
        returnUrl = function(e) {
          var data;
          window.removeEventListener('message', returnUrl);
          try {
            data = JSON.parse(e.data);
            if (data.success) {
              return callback(null, data.card);
            } else {
              return callback(new Error(data.error));
            }
          } catch (_error) {}
        };
        if (typeof window.addEventListener === 'function') {
          window.addEventListener('message', returnUrl, false);
        }
        width = 500;
        height = 600;
        left = window.screenX + (window.outerWidth - width) / 2;
        top = window.screenY + (window.outerHeight - height) / 2;
        return window.open(
          intentEndpoint + '/add-card?' + $.param($.extend(baseArgs, options)),
          'trello',
          'width=' +
            width +
            ',height=' +
            height +
            ',left=' +
            left +
            ',top=' +
            top
        );
      };
      if (next != null) {
        return getCard(next);
      } else if (window.Promise) {
        return new Promise(function(resolve, reject) {
          return getCard(function(err, card) {
            if (err) {
              return reject(err);
            } else {
              return resolve(card);
            }
          });
        });
      } else {
        return getCard(function() {});
      }
    },
  };
  ref = ['GET', 'PUT', 'POST', 'DELETE'];
  fn = function(type) {
    return (Trello[type.toLowerCase()] = function() {
      return this.rest.apply(this, [type].concat(slice.call(arguments)));
    });
  };
  for (i = 0, len = ref.length; i < len; i++) {
    type = ref[i];
    fn(type);
  }
  Trello.del = Trello['delete'];
  ref1 = [
    'actions',
    'cards',
    'checklists',
    'boards',
    'lists',
    'members',
    'organizations',
    'lists',
  ];
  fn1 = function(collection) {
    return (Trello[collection] = {
      get: function(id, params, success, error) {
        return Trello.get(collection + '/' + id, params, success, error);
      },
    });
  };
  for (j = 0, len1 = ref1.length; j < len1; j++) {
    collection = ref1[j];
    fn1(collection);
  }
  window.Trello = Trello;
  authorizeURL = function(args) {
    var baseArgs;
    baseArgs = {
      response_type: 'token',
      key: key,
    };
    return (
      authEndpoint +
      '/' +
      version +
      '/authorize?' +
      $.param($.extend(baseArgs, args))
    );
  };
  parseRestArgs = function(arg) {
    var error, params, path, success;
    (path = arg[0]), (params = arg[1]), (success = arg[2]), (error = arg[3]);
    if (isFunction(params)) {
      error = success;
      success = params;
      params = {};
    }
    path = path.replace(/^\/*/, '');
    return [path, params, success, error];
  };
  localStorage = window.localStorage;
  if (localStorage != null) {
    storagePrefix = 'trello_';
    readStorage = function(key) {
      return localStorage[storagePrefix + key];
    };
    writeStorage = function(key, value) {
      if (value === null) {
        return delete localStorage[storagePrefix + key];
      } else {
        return (localStorage[storagePrefix + key] = value);
      }
    };
  } else {
    readStorage = writeStorage = function() {};
  }
};

deferred = {};

ready = {};

waitUntil = function(name, fx) {
  if (ready[name] != null) {
    return fx(ready[name]);
  } else {
    return (deferred[name] != null
      ? deferred[name]
      : (deferred[name] = [])
    ).push(fx);
  }
};

isReady = function(name, value) {
  var fx, fxs, i, len;
  ready[name] = value;
  if (deferred[name]) {
    fxs = deferred[name];
    delete deferred[name];
    for (i = 0, len = fxs.length; i < len; i++) {
      fx = fxs[i];
      fx(value);
    }
  }
};

isFunction = function(val) {
  return typeof val === 'function';
};

wrapper(window, jQuery, opts);
