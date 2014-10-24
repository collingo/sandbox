module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    mochaTest: {
      test: {
        options: {
          reporter: 'dot'
        },
        src: ['test/**/*.js']
      }
    },
    watch: {
      js: {
        files: [
          'src/**/*.js',
          'test/**/*.js'
        ],
        tasks: ['test'],
        options: {
          spawn: true,
        }
      }
    }
  });

  grunt.registerTask('default', 'watch');
  grunt.registerTask('test', 'mochaTest');

};