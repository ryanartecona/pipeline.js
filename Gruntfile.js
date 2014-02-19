/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
    test: {
      options: {
        reporter: 'dot',
        bail: true,
        ignoreLeaks: false
      },
      main: {
        src: ['test/main.js']
      },
      promise: {
        src: ['test/promise-a+.js']
      }
    },
    browserify: {
      dist: {
        src: ['src/pipeline.js'],
        dest: 'dist/pipeline.js',
        options: {
          standalone: 'PL',
          detectGlobals: false
        }
      },
      test: {
        src: ['test/main.js'],
        dest: 'test/browser/main.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        src: 'dist/pipeline.js',
        dest: 'dist/pipeline.min.js'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        browser: true,
        asi: true,
        laxcomma: true,
        node: true,
        globals: {
          jQuery: true
        }
      },
    },
    watch: {
      options: {
        atBegin: true
      },
      test: {
        files: ['src/*.js', 'test/*.js', '!test/browser.js'],
        tasks: ['test', 'browserify:test']
      },
      build: {
        files: ['src/*.js'],
        tasks: ['build']
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.task.renameTask('mochaTest', 'test');

  // Default task runs the main test suite, linter, then builds bundles
  grunt.registerTask('default', ['test:main', 'jshint', 'build']);
  // Task to run r.js optimizer, concat, and minify to a single file
  grunt.registerTask('build', ['browserify:dist', 'uglify:dist']);

};
