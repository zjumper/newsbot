'use strict';

module.exports = function(grunt) {
  require('load-grunt-config')(grunt);

  grunt.loadNpmTasks('grunt-express-server');

  grunt.registerTask('serve', function (target) {
    if (target === 'dist') {
      return grunt.task.run(['build',
        'express:prod'
        // 'connect:dist:keepalive'
      ]);
    }

    grunt.task.run([
      'clean:server',
      'copy:dist',
      'express:dev'
      // 'connect:livereload',
      // 'watch'
    ]);
  });

  grunt.registerTask('build', [
    'clean:dist',
    'copy:dist'
  ]);
}
