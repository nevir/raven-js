/*global ErrorUtils:false*/

/**
 * react-native plugin for Raven
 *
 * Usage:
 *   var Raven = require('raven-js');
 *   Raven.addPlugin(require('raven-js/plugins/react-native'));
 *
 * Options:
 *
 *   pathStrip: A RegExp that matches the portions of a file URI that should be
 *     removed from stacks prior to submission.
 *
 *   noRethrow: Pass true if you DO NOT wish for Raven to call the original
 *     global exception handler (e.g. don't crash the app).
 */
'use strict';

var PATH_STRIP_RE = /^\/var\/mobile\/Containers\/Bundle\/Application\/[^\/]+\/[^\.]+\.app/;

function reactNativePlugin(Raven, pluginOptions) {
    pluginOptions = pluginOptions || {};

    var pathStrip = pluginOptions.pathStrip || PATH_STRIP_RE;
    function normalizeUrl(url) {
        return url
            .replace(/^file\:\/\//, '')
            .replace(pathStrip, '');
    }

    function urlencode(obj) {
        var pairs = [];
        for (var key in obj) {
          if ({}.hasOwnProperty.call(obj, key))
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        }
        return pairs.join('&');
    }

    function xhrTransport(options) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function (e) {
            if (request.readyState !== 4) {
                return;
            }

            if (request.status === 200) {
                if (options.onSuccess) {
                    options.onSuccess();
                }
            } else {
                if (options.onError) {
                    options.onError();
                }
            }
        };

        request.open('POST', options.url + '?' + urlencode(options.auth));
        // Sentry expects an Origin header when using HTTP POST w/ public DSN.
        // Just set a phony Origin value; only matters if Sentry Project is configured
        // to whitelist specific origins.
        request.setRequestHeader('Origin', 'react-native://');
        request.send(JSON.stringify(options.data));
    }

    // react-native doesn't have a document, so can't use default Image
    // transport - use XMLHttpRequest instead
    Raven.setTransport(xhrTransport);


    // Use data callback to strip device-specific paths from stack traces
    Raven.setDataCallback(function (data) {
        if (data.culprit) {
          data.culprit = normalizeUrl(data.culprit);
        }

        if (data.exception) {
          // if data.exception exists, all of the other keys are guaranteed to exist
          data.exception.values[0].stacktrace.frames.forEach(function (frame) {
            frame.filename = normalizeUrl(frame.filename);
          });
        }
    });

    var defaultHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler() || ErrorUtils._globalHandler;

    ErrorUtils.setGlobalHandler(function(){
      var error = arguments[0];
      if (!pluginOptions.noRethrow) {
        defaultHandler.apply(this, arguments)
      }
      Raven.captureException(error);
    });
}

module.exports = reactNativePlugin;
