'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _unknown = require('./unknown');

var _unknown2 = _interopRequireDefault(_unknown);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function createDocument(tagName, _ref, children) {
    var key = _ref.key,
        data = _objectWithoutProperties(_ref, ['key']);

    return (0, _unknown2.default)(tagName, {
        kind: 'document',
        key: key,
        data: data
    }, children);
}

exports.default = createDocument;