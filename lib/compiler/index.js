(function(){
	// everything should be moved to this file instead
	var fs = require('fs');
	var path = require('path');
	
	var compiler = require('./compiler');
	var parser = compiler.parser;
	
	function tokenize(code,o){
		if(o === undefined) o = {};
		return compiler.tokenize(code,o);
	}; exports.tokenize = tokenize;
	
	function rewrite(code,o){
		if(o === undefined) o = {};
		return compiler.rewrite(code,o);
	}; exports.rewrite = rewrite;
	
	function parse(code,o){
		return compiler.parse(code,o);
	}; exports.parse = parse;
	
	function compile(code,o){
		if(o === undefined) o = {};
		return compiler.compile(code,o);
	}; exports.compile = compile;
	
	function analyze(code,o){
		if(o === undefined) o = {};
		return compiler.analyze(code,o);
	}; exports.analyze = analyze;
	
	function run(code,pars){
		// console.log 'run code via run in index',filename
		var $1, $2;
		if(!pars||pars.constructor !== Object) pars = {};
		var filename = pars.filename !== undefined ? pars.filename : null;
		var main = require.main;
		main.filename = process.argv[1] = (filename ? (fs.realpathSync(filename)) : ('.'));
		main.moduleCache && (main.moduleCache = {}); // removing all cache?!?
		
		var Module = require('module').Module;
		main.paths = Module._nodeModulePaths(path.dirname(filename));
		
		if (path.extname(main.filename) != '.imba' || require.extensions) {
			arguments[($1 = 1)].target || (arguments[$1].target = 'node');
			var content = compiler.compile(code,arguments[1]);
			return main._compile((content.js || content),main.filename);
		} else {
			return main._compile(code,main.filename);
		};
	}; exports.run = run;
	
	if (require.extensions) {
		return require.extensions['.imba'] = function(mod,filename) {
			// console.log 'run code via require extensions in index',filename
			var content = compiler.compile(fs.readFileSync(filename,'utf8'),{filename: filename,target: 'node'});
			return mod._compile((content.js || content),filename);
		};
	};

})();