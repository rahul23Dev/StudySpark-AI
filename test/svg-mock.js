// Jest stand-in for SVG imports (Metro turns them into components at runtime).
const React = require('react');
const { View } = require('react-native');

function SvgMock(props) {
  return React.createElement(View, { testID: props.testID ?? 'svg' });
}

module.exports = SvgMock;
module.exports.default = SvgMock;
