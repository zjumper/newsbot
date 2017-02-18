'use strict';

module.exports = {
  dist: {
    files: [{
      expand: true,
      dot: true,
      cwd: 'src',
      dest: 'build',
      src: [
        '*.js',
        'robots.txt',
        'scripts/**/*.js'
      ]
    }]
  }
};
