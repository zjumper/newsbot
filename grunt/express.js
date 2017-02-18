'use strict';

module.exports = {
  options: {
    // Override defaults here
    background: false,
    port: 3000
  },
  dev: {
    options: {
      script: 'build/app.js'
    }
  },
  prod: {
    options: {
      script: 'build/app.js',
      node_env: 'production'
    }
  },
  test: {
    options: {
      script: 'build/app.js'
    }
  }
}
