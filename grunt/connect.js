'use strict';

var developmentPort = process.env.PORT || 3000;
var productionPort = 8080;

module.exports = {
  options: {
    port: developmentPort,
    hostname: 'localhost',
    livereload: 35729
  },
  livereload: {
    options: {
      open: 'http://localhost:' + developmentPort,
      base: [
        '.tmp',
        'build'
      ]
    }
  },
  test: {
    options: {
      port: 9001,
      base: [
        '.tmp',
        'test',
        'build'
      ]
    }
  },
  dist: {
    options: {
      keepalive: true,
      base: 'dist',
      port: productionPort,
      open: true,
      hostname: /^win/.test(process.platform) ? 'localhost' : '0.0.0.0',
      livereload: false
    }
  }
};
