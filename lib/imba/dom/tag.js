(function(){
	function idx$(a,b){
		return (b && b.indexOf) ? b.indexOf(a) : [].indexOf.call(a,b);
	};
	
	function iter$(a){ return a ? (a.toArray ? a.toArray() : a) : []; };
	
	Imba.CSSKeyMap = {};
	
	/*
	Get the current document
	*/
	
	Imba.document = function (){
		if (ENV_WEB) {
			return window.document;
		} else {
			return this._document || (this._document = new ImbaServerDocument());
		};
	};
	
	/*
	Get the body element wrapped in an Imba.Tag
	*/
	
	Imba.root = function (){
		return tag$wrap(Imba.document().body);
	};
	
	
	Imba.static = function (items,nr){
		items.static = nr;
		return items;
	};
	
	
	
	/*
	This is the baseclass that all tags in imba inherit from.
	@iname node
	*/
	
	Imba.Tag = function Tag(dom){
		this.setDom(dom);
		this.__ = {};
		this;
	};
	
	Imba.Tag.buildNode = function (){
		var dom = Imba.document().createElement(this._nodeType || 'div');
		if (this._classes) {
			var cls = this._classes.join(" ");
			if (cls) { dom.className = cls };
		};
		return dom;
	};
	
	Imba.Tag.createNode = function (){
		var proto = (this._protoDom || (this._protoDom = this.buildNode()));
		return proto.cloneNode(false);
	};
	
	Imba.Tag.build = function (){
		return new this(this.createNode());
	};
	
	Imba.Tag.dom = function (){
		return this._protoDom || (this._protoDom = this.buildNode());
	};
	
	/*
		Called when a tag type is being subclassed.
		*/
	
	Imba.Tag.inherit = function (child){
		child.prototype._empty = true;
		child._protoDom = null;
		
		if (this._nodeType) {
			child._nodeType = this._nodeType;
			child._classes = this._classes.slice();
			
			if (child._flagName) {
				return child._classes.push(child._flagName);
			};
		} else {
			child._nodeType = child._name;
			child._flagName = null;
			return child._classes = [];
		};
	};
	
	/*
		Internal method called after a tag class has
		been declared or extended.
		*/
	
	Imba.Tag.prototype.optimizeTagStructure = function (){
		var base = Imba.Tag.prototype;
		// var has = do |k| self:hasOwnProperty(k)
		// if has(:commit) or has(:render) or has(:mount) or has(:build)
		
		var hasBuild = this.build != base.build;
		var hasCommit = this.commit != base.commit;
		var hasRender = this.render != base.render;
		var hasMount = this.mount;
		
		if (hasCommit || hasRender || hasBuild || hasMount) {
			
			this.end = function() {
				if (this.mount && !this._mounted) {
					Imba.TagManager.mount(this);
				};
				
				if (!this._built) {
					this._built = true;
					this.build();
				} else {
					this.commit();
				};
				
				return this;
			};
		};
		return this;
	};
	
	
	Imba.Tag.prototype.tabindex = function(v){ return this.getAttribute('tabindex'); }
	Imba.Tag.prototype.setTabindex = function(v){ this.setAttribute('tabindex',v); return this; };
	Imba.Tag.prototype.title = function(v){ return this.getAttribute('title'); }
	Imba.Tag.prototype.setTitle = function(v){ this.setAttribute('title',v); return this; };
	Imba.Tag.prototype.role = function(v){ return this.getAttribute('role'); }
	Imba.Tag.prototype.setRole = function(v){ this.setAttribute('role',v); return this; };
	Imba.Tag.prototype.name = function(v){ return this.getAttribute('name'); }
	Imba.Tag.prototype.setName = function(v){ this.setAttribute('name',v); return this; };
	
	Imba.Tag.prototype.object = function(v){ return this._object; }
	Imba.Tag.prototype.setObject = function(v){ this._object = v; return this; };
	
	Imba.Tag.prototype.dom = function (){
		return this._dom;
	};
	
	Imba.Tag.prototype.setDom = function (dom){
		dom._tag = this;
		this._dom = dom;
		return this;
	};
	
	/*
		Setting references for tags like
		`<div@header>` will compile to `tag('div').setRef('header',this).end()`
		By default it adds the reference as a className to the tag.
		@return {self}
		*/
	
	Imba.Tag.prototype.setRef = function (ref,ctx){
		this.flag(this._ref = ref);
		return this;
	};
	
	Imba.Tag.prototype.ref = function (){
		return this._ref;
	};
	
	Imba.Tag.prototype.__ref = function (ref,ctx){
		ctx['_' + ref] = this;
		this.flag(this._ref = ref);
		this._owner = ctx;
		return this;
	};
	
	/*
		Set inner html of node
		*/
	
	Imba.Tag.prototype.setHtml = function (html){
		this._dom.innerHTML = html;
		return this;
	};
	
	/*
		Get inner html of node
		*/
	
	Imba.Tag.prototype.html = function (){
		return this._dom.innerHTML;
	};
	
	
	/*
		Get width of node (offsetWidth)
		@return {number}
		*/
	
	Imba.Tag.prototype.width = function (){
		return this._dom.offsetWidth;
	};
	
	/*
		Get height of node (offsetHeight)
		@return {number}
		*/
	
	Imba.Tag.prototype.height = function (){
		return this._dom.offsetHeight;
	};
	
	/*
		Method that is called by the compiled tag-chains, for
		binding events on tags to methods etc.
		`<a :tap=fn>` compiles to `tag('a').setHandler('tap',fn,this).end()`
		where this refers to the context in which the tag is created.
		@return {self}
		*/
	
	Imba.Tag.prototype.setHandler = function (event,handler,ctx){
		var key = 'on' + event;
		
		if (handler instanceof Function) {
			this[key] = handler;
		} else if (handler instanceof Array) {
			var fn = handler.shift();
			this[key] = function(e) { return ctx[fn].apply(ctx,handler.concat(e)); };
		} else {
			this[key] = function(e) { return ctx[handler](e); };
		};
		return this;
	};
	
	Imba.Tag.prototype.setId = function (id){
		this.dom().id = id;
		return this;
	};
	
	Imba.Tag.prototype.id = function (){
		return this.dom().id;
	};
	
	/*
		Adds a new attribute or changes the value of an existing attribute
		on the specified tag. If the value is null or false, the attribute
		will be removed.
		@return {self}
		*/
	
	Imba.Tag.prototype.setAttribute = function (name,value){
		// should this not return self?
		var old = this.dom().getAttribute(name);
		
		if (old == value) {
			return value;
		} else if (value != null && value !== false) {
			return this.dom().setAttribute(name,value);
		} else {
			return this.dom().removeAttribute(name);
		};
	};
	
	/*
		removes an attribute from the specified tag
		*/
	
	Imba.Tag.prototype.removeAttribute = function (name){
		return this.dom().removeAttribute(name);
	};
	
	/*
		returns the value of an attribute on the tag.
		If the given attribute does not exist, the value returned
		will either be null or "" (the empty string)
		*/
	
	Imba.Tag.prototype.getAttribute = function (name){
		return this.dom().getAttribute(name);
	};
	
	/*
		Override this to provide special wrapping etc.
		@return {self}
		*/
	
	Imba.Tag.prototype.setContent = function (content,type){
		this.setChildren(content,type);
		return this;
	};
	
	/*
		Set the children of node. type param is optional,
		and should only be used by Imba when compiling tag trees. 
		@return {self}
		*/
	
	Imba.Tag.prototype.setChildren = function (nodes,type){
		this._empty ? (this.append(nodes)) : (this.empty().append(nodes));
		this._children = null;
		return this;
	};
	
	/*
		@deprecated
		Remove specified child from current node.
		*/
	
	Imba.Tag.prototype.remove = function (child){
		return this.removeChild(child);
	};
	
	/*
		Remove specified child from current node.
		@return {self}
		*/
	
	Imba.Tag.prototype.removeChild = function (child){
		var par = this.dom();
		var el = child instanceof Imba.Tag ? (child.dom()) : (child);
		
		if (el && el.parentNode == par) {
			par.removeChild(el);
			if (el._tag) { Imba.TagManager.remove(el._tag,this) };
		};
		return this;
	};
	
	
	/*
		Append a single item (node or string) to the current node.
		If supplied item is a string it will automatically. This is used
		by Imba internally, but will practically never be used explicitly.
		@return {self}
		*/
	
	Imba.Tag.prototype.appendChild = function (node){
		if ((typeof node=='string'||node instanceof String)) {
			this.dom().appendChild(Imba.document().createTextNode(node));
		} else if (node) {
			this.dom().appendChild(node._dom || node);
			Imba.TagManager.insert(node._tag || node,this);
			// FIXME ensure these are not called for text nodes
		};
		return this;
	};
	
	/*
		Insert a node into the current node (self), before another.
		The relative node must be a child of current node. 
		*/
	
	Imba.Tag.prototype.insertBefore = function (node,rel){
		if ((typeof node=='string'||node instanceof String)) {
			node = Imba.document().createTextNode(node);
		};
		
		if (node && rel) {
			this.dom().insertBefore((node._dom || node),(rel._dom || rel));
			Imba.TagManager.insert(node._tag || node,this);
			// FIXME ensure these are not called for text nodes
		};
		return this;
	};
	
	/*
		The .append method inserts the specified content as the last child
		of the target node. If the content is already a child of node it
		will be moved to the end.
		
		    var root = <div.root>
		    var item = <div.item> "This is an item"
		    root.append item # appends item to the end of root
	
		    root.prepend "some text" # append text
		    root.prepend [<ul>,<ul>] # append array
		*/
	
	Imba.Tag.prototype.append = function (item){
		// possible to append blank
		// possible to simplify on server?
		if (!item) { return this };
		
		if (item instanceof Array) {
			for (var i = 0, ary = iter$(item), len = ary.length, member; i < len; i++) {
				member = ary[i];
				member && this.append(member);
			};
		} else if ((typeof item=='string'||item instanceof String) || (typeof item=='number'||item instanceof Number)) {
			var node = Imba.document().createTextNode(item);
			this._dom.appendChild(node);
			if (this._empty) { this._empty = false };
		} else {
			// should delegate to self.appendChild
			this.appendChild(item);
			if (this._empty) { this._empty = false };
		};
		
		return this;
	};
	
	/*
		@deprecated
		*/
	
	Imba.Tag.prototype.insert = function (node,pars){
		if(!pars||pars.constructor !== Object) pars = {};
		var before = pars.before !== undefined ? pars.before : null;
		var after = pars.after !== undefined ? pars.after : null;
		if (after) { before = after.next() };
		if (node instanceof Array) {
			node = (tag$.$fragment().setContent(node,0).end());
		};
		if (before) {
			this.insertBefore(node,before.dom());
		} else {
			this.appendChild(node);
		};
		return this;
	};
	
	/*
		@todo Should support multiple arguments like append
	
		The .prepend method inserts the specified content as the first
		child of the target node. If the content is already a child of 
		node it will be moved to the start.
		
	    	node.prepend <div.top> # prepend node
	    	node.prepend "some text" # prepend text
	    	node.prepend [<ul>,<ul>] # prepend array
	
		*/
	
	Imba.Tag.prototype.prepend = function (item){
		var first = this._dom.childNodes[0];
		first ? (this.insertBefore(item,first)) : (this.appendChild(item));
		return this;
	};
	
	
	/*
		Remove node from the dom tree
		@return {self}
		*/
	
	Imba.Tag.prototype.orphanize = function (){
		var par;
		if (par = this.parent()) { par.removeChild(this) };
		return this;
	};
	
	/*
		Get text of node. Uses textContent behind the scenes (not innerText)
		[https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent]()
		@return {string} inner text of node
		*/
	
	Imba.Tag.prototype.text = function (v){
		return this._dom.textContent;
	};
	
	/*
		Set text of node. Uses textContent behind the scenes (not innerText)
		[https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent]()
		*/
	
	Imba.Tag.prototype.setText = function (txt){
		this._empty = false;
		this._dom.textContent = txt == null ? (txt = "") : (txt);
		this;
		return this;
	};
	
	
	/*
		Method for getting and setting data-attributes. When called with zero
		arguments it will return the actual dataset for the tag.
	
			var node = <div data-name='hello'>
			# get the whole dataset
			node.dataset # {name: 'hello'}
			# get a single value
			node.dataset('name') # 'hello'
			# set a single value
			node.dataset('name','newname') # self
	
	
		*/
	
	Imba.Tag.prototype.dataset = function (key,val){
		if (key instanceof Object) {
			for (var i = 0, keys = Object.keys(key), l = keys.length; i < l; i++){
				this.dataset(keys[i],key[keys[i]]);
			};
			return this;
		};
		
		if (arguments.length == 2) {
			this.setAttribute(("data-" + key),val);
			return this;
		};
		
		if (key) {
			return this.getAttribute(("data-" + key));
		};
		
		var dataset = this.dom().dataset;
		
		if (!dataset) {
			dataset = {};
			for (var i = 0, ary = iter$(this.dom().attributes), len = ary.length, atr; i < len; i++) {
				atr = ary[i];
				if (atr.name.substr(0,5) == 'data-') {
					dataset[Imba.toCamelCase(atr.name.slice(5))] = atr.value;
				};
			};
		};
		
		return dataset;
	};
	
	
	/*
		Remove all content inside node
		*/
	
	Imba.Tag.prototype.empty = function (){
		if (this._dom.firstChild) {
			while (this._dom.firstChild){
				this._dom.removeChild(this._dom.firstChild);
			};
			Imba.TagManager.remove(null,this);
		};
		
		this._children = null;
		this._empty = true;
		return this;
	};
	
	/*
		Empty placeholder. Override to implement custom render behaviour.
		Works much like the familiar render-method in React.
		@return {self}
		*/
	
	Imba.Tag.prototype.render = function (){
		return this;
	};
	
	/*
		Called implicitly through Imba.Tag#end, upon creating a tag. All
		properties will have been set before build is called, including
		setContent.
		@return {self}
		*/
	
	Imba.Tag.prototype.build = function (){
		this.render();
		return this;
	};
	
	/*
		Called implicitly through Imba.Tag#end, for tags that are part of
		a tag tree (that are rendered several times).
		@return {self}
		*/
	
	Imba.Tag.prototype.commit = function (){
		this.render();
		return this;
	};
	
	/*
	
		Called by the tag-scheduler (if this tag is scheduled)
		By default it will call this.render. Do not override unless
		you really understand it.
	
		*/
	
	Imba.Tag.prototype.tick = function (){
		this.render();
		return this;
	};
	
	/*
		
		A very important method that you will practically never manually.
		The tag syntax of Imba compiles to a chain of setters, which always
		ends with .end. `<a.large>` compiles to `tag('a').flag('large').end()`
		
		You are highly adviced to not override its behaviour. The first time
		end is called it will mark the tag as built and call Imba.Tag#build,
		and call Imba.Tag#commit on subsequent calls.
		@return {self}
		*/
	
	Imba.Tag.prototype.end = function (){
		return this;
	};
	
	/*
		This is called instead of Imba.Tag#end for `<self>` tag chains.
		Defaults to noop
		@return {self}
		*/
	
	Imba.Tag.prototype.synced = function (){
		return this;
	};
	
	// called when the node is awakened in the dom - either automatically
	// upon attachment to the dom-tree, or the first time imba needs the
	// tag for a domnode that has been rendered on the server
	Imba.Tag.prototype.awaken = function (){
		return this;
	};
	
	
	
	/*
		List of flags for this node. 
		*/
	
	Imba.Tag.prototype.flags = function (){
		return this._dom.classList;
	};
	
	/*
		@deprecated
		*/
	
	Imba.Tag.prototype.classes = function (){
		throw "Imba.Tag#classes is removed. Use Imba.Tag#flags";
	};
	
	/*
		Add speficied flag to current node.
		If a second argument is supplied, it will be coerced into a Boolean,
		and used to indicate whether we should remove the flag instead.
		@return {self}
		*/
	
	Imba.Tag.prototype.flag = function (name,toggler){
		// it is most natural to treat a second undefined argument as a no-switch
		// so we need to check the arguments-length
		if (arguments.length == 2) {
			if (this._dom.classList.contains(name) != !!toggler) {
				this._dom.classList.toggle(name);
			};
		} else {
			this._dom.classList.add(name);
		};
		return this;
	};
	
	/*
		Remove specified flag from node
		@return {self}
		*/
	
	Imba.Tag.prototype.unflag = function (name){
		this._dom.classList.remove(name);
		return this;
	};
	
	/*
		Toggle specified flag on node
		@return {self}
		*/
	
	Imba.Tag.prototype.toggleFlag = function (name){
		this._dom.classList.toggle(name);
		return this;
	};
	
	/*
		Check whether current node has specified flag
		@return {bool}
		*/
	
	Imba.Tag.prototype.hasFlag = function (name){
		return this._dom.classList.contains(name);
	};
	
	
	/*
		Set/update a named flag. It remembers the previous
		value of the flag, and removes it before setting the new value.
	
			node.setFlag('type','todo')
			node.setFlag('type','project')
			# todo is removed, project is added.
	
		@return {self}
		*/
	
	Imba.Tag.prototype.setFlag = function (name,value){
		this._namedFlags || (this._namedFlags = []);
		var prev = this._namedFlags[name];
		if (prev != value) {
			if (prev) { this.unflag(prev) };
			if (value) { this.flag(value) };
			this._namedFlags[name] = value;
		};
		return this;
	};
	
	
	/*
		Get the scheduler for this node. A new scheduler will be created
		if it does not already exist.
	
		@return {Imba.Scheduler}
		*/
	
	Imba.Tag.prototype.scheduler = function (){
		return this._scheduler == null ? (this._scheduler = new Imba.Scheduler(this)) : (this._scheduler);
	};
	
	/*
	
		Shorthand to start scheduling a node. The method will basically
		proxy the arguments through to scheduler.configure, and then
		activate the scheduler.
		
		@return {self}
		*/
	
	Imba.Tag.prototype.schedule = function (options){
		if(options === undefined) options = {events: true};
		this.scheduler().configure(options).activate();
		return this;
	};
	
	/*
		Shorthand for deactivating scheduler (if tag has one).
		@deprecated
		*/
	
	Imba.Tag.prototype.unschedule = function (){
		if (this._scheduler) { this.scheduler().deactivate() };
		return this;
	};
	
	
	/*
		Get the parent of current node
		@return {Imba.Tag} 
		*/
	
	Imba.Tag.prototype.parent = function (){
		return tag$wrap(this.dom().parentNode);
	};
	
	/*
		Get the child at index
		*/
	
	Imba.Tag.prototype.child = function (i){
		return tag$wrap(this.dom().children[i || 0]);
	};
	
	
	/*
		Get the children of node
		@return {Imba.Selector}
		*/
	
	Imba.Tag.prototype.children = function (sel){
		var nodes = new Imba.Selector(null,this,this._dom.children);
		return sel ? (nodes.filter(sel)) : (nodes);
	};
	
	/*
		Get the siblings of node
		@return {Imba.Selector}
		*/
	
	Imba.Tag.prototype.siblings = function (sel){
		var par, self = this;
		if (!(par = this.parent())) { return [] }; // FIXME
		var ary = this.dom().parentNode.children;
		var nodes = new Imba.Selector(null,this,ary);
		return nodes.filter(function(n) { return n != self && (!sel || n.matches(sel)); });
	};
	
	/*
		Get node and its ascendents
		@return {Array}
		*/
	
	Imba.Tag.prototype.path = function (sel){
		var node = this;
		var nodes = [];
		if (sel && sel.query) { sel = sel.query() };
		
		while (node){
			if (!sel || node.matches(sel)) { nodes.push(node) };
			node = node.parent();
		};
		return nodes;
	};
	
	/*
		Get ascendents of node
		@return {Array}
		*/
	
	Imba.Tag.prototype.parents = function (sel){
		var par = this.parent();
		return par ? (par.path(sel)) : ([]);
	};
	
	/*
		Get the immediately following sibling of node.
		*/
	
	Imba.Tag.prototype.next = function (sel){
		if (sel) {
			var el = this;
			while (el = el.next()){
				if (el.matches(sel)) { return el };
			};
			return null;
		};
		return tag$wrap(this.dom().nextElementSibling);
	};
	
	/*
		Get the immediately preceeding sibling of node.
		*/
	
	Imba.Tag.prototype.prev = function (sel){
		if (sel) {
			var el = this;
			while (el = el.prev()){
				if (el.matches(sel)) { return el };
			};
			return null;
		};
		return tag$wrap(this.dom().previousElementSibling);
	};
	
	/*
		Get descendants of current node, optionally matching selector
		@return {Imba.Selector}
		*/
	
	Imba.Tag.prototype.find = function (sel){
		return new Imba.Selector(sel,this);
	};
	
	/*
		Get the first matching child of node
	
		@return {Imba.Tag}
		*/
	
	Imba.Tag.prototype.first = function (sel){
		return sel ? (this.find(sel).first()) : (tag$wrap(this.dom().firstElementChild));
	};
	
	/*
		Get the last matching child of node
	
			node.last # returns the last child of node
			node.last %span # returns the last span inside node
			node.last do |el| el.text == 'Hi' # return last node with text Hi
	
		@return {Imba.Tag}
		*/
	
	Imba.Tag.prototype.last = function (sel){
		return sel ? (this.find(sel).last()) : (tag$wrap(this.dom().lastElementChild));
	};
	
	/*
		Check if this node matches a selector
		@return {Boolean}
		*/
	
	Imba.Tag.prototype.matches = function (sel){
		var fn;
		if (sel instanceof Function) {
			return sel(this);
		};
		
		if (sel.query) { sel = sel.query() };
		if (fn = (this._dom.matches || this._dom.matchesSelector || this._dom.webkitMatchesSelector || this._dom.msMatchesSelector || this._dom.mozMatchesSelector)) {
			return fn.call(this._dom,sel);
		};
	};
	
	/*
		Get the first element matching supplied selector / filter
		traversing upwards, but including the node itself.
		@return {Imba.Tag}
		*/
	
	Imba.Tag.prototype.closest = function (sel){
		if (!sel) { return this.parent() }; // should return self?!
		var node = this;
		if (sel.query) { sel = sel.query() };
		
		while (node){
			if (node.matches(sel)) { return node };
			node = node.parent();
		};
		return null;
	};
	
	/*
		Get the closest ancestor of node that matches
		specified selector / matcher.
	
		@return {Imba.Tag}
		*/
	
	Imba.Tag.prototype.up = function (sel){
		if (!sel) { return this.parent() };
		return this.parent() && this.parent().closest(sel);
	};
	
	/*
		Get the index of node.
		@return {Number}
		*/
	
	Imba.Tag.prototype.index = function (){
		var i = 0;
		var el = this.dom();
		while (el.previousSibling){
			el = el.previousSibling;
			i++;
		};
		return i;
	};
	
	/*
		Check if node contains other node
		@return {Boolean} 
		*/
	
	Imba.Tag.prototype.contains = function (node){
		return this.dom().contains(node && node._dom || node);
	};
	
	
	/*
		Shorthand for console.log on elements
		@return {self}
		*/
	
	Imba.Tag.prototype.log = function (){
		var $0 = arguments, i = $0.length;
		var args = new Array(i>0 ? i : 0);
		while(i>0) args[i-1] = $0[--i];
		args.unshift(console);
		Function.prototype.call.apply(console.log,args);
		return this;
	};
	
	Imba.Tag.prototype.css = function (key,val){
		if (key instanceof Object) {
			for (var i = 0, keys = Object.keys(key), l = keys.length; i < l; i++){
				this.css(keys[i],key[keys[i]]);
			};
			return this;
		};
		
		key = Imba.CSSKeyMap[key] || key;
		
		if (val == null) {
			this.dom().style.removeProperty(key);
		} else if (val == undefined) {
			return this.dom().style[key];
		} else {
			if ((typeof val=='number'||val instanceof Number) && key.match(/width|height|left|right|top|bottom/)) {
				val = val + "px";
			};
			this.dom().style[key] = val;
		};
		return this;
	};
	
	Imba.Tag.prototype.trigger = function (event,data){
		if(data === undefined) data = {};
		return Imba.Events.trigger(event,this,{data: data});
	};
	
	Imba.Tag.prototype.emit = function (name,pars){
		if(!pars||pars.constructor !== Object) pars = {};
		var data = pars.data !== undefined ? pars.data : null;
		var bubble = pars.bubble !== undefined ? pars.bubble : true;
		console.warn('tag#emit is deprecated -> use tag#trigger');
		Imba.Events.trigger(name,this,{data: data,bubble: bubble});
		return this;
	};
	
	Imba.Tag.prototype.setTransform = function (value){
		this.css('transform',value);
		this;
		return this;
	};
	
	Imba.Tag.prototype.transform = function (){
		return this.css('transform');
	};
	
	Imba.Tag.prototype.setStyle = function (style){
		this.setAttribute('style',style);
		this;
		return this;
	};
	
	Imba.Tag.prototype.style = function (){
		return this.getAttribute('style');
	};
	
	/*
		Focus on current node
		@return {self}
		*/
	
	Imba.Tag.prototype.focus = function (){
		this.dom().focus();
		return this;
	};
	
	/*
		Remove focus from current node
		@return {self}
		*/
	
	Imba.Tag.prototype.blur = function (){
		this.dom().blur();
		return this;
	};
	
	Imba.Tag.prototype.toString = function (){
		return this.dom().outerHTML;
	};
	
	
	Imba.Tag.prototype.initialize = Imba.Tag;
	
	HTML_TAGS = "a abbr address area article aside audio b base bdi bdo big blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hr html i iframe img input ins kbd keygen label legend li link main map mark menu menuitem meta meter nav noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td textarea tfoot th thead time title tr track u ul var video wbr".split(" ");
	HTML_TAGS_UNSAFE = "article aside header section".split(" ");
	SVG_TAGS = "circle defs ellipse g line linearGradient mask path pattern polygon polyline radialGradient rect stop svg text tspan".split(" ");
	
	
	function extender(obj,sup){
		for (var i = 0, keys = Object.keys(sup), l = keys.length; i < l; i++){
			obj[($1 = keys[i])] == null ? (obj[$1] = sup[keys[i]]) : (obj[$1]);
		};
		
		obj.prototype = Object.create(sup.prototype);
		obj.__super__ = obj.prototype.__super__ = sup.prototype;
		obj.prototype.constructor = obj;
		if (sup.inherit) { sup.inherit(obj) };
		return obj;
	};
	
	function Tag(){
		return function(dom) {
			this.initialize(dom);
			return this;
		};
	};
	
	function TagSpawner(type){
		return function() { return type.build(); };
	};
	
	Imba.Tags = function Tags(){
		this;
	};
	
	Imba.Tags.prototype.__clone = function (ns){
		var clone = Object.create(this);
		clone._parent = this;
		return clone;
	};
	
	Imba.Tags.prototype.ns = function (name){
		return this[name.toUpperCase()] || this.defineNamespace(name);
	};
	
	Imba.Tags.prototype.defineNamespace = function (name){
		var clone = Object.create(this);
		clone._parent = this;
		clone._ns = name;
		this[name.toUpperCase()] = clone;
		return clone;
	};
	
	Imba.Tags.prototype.baseType = function (name){
		return idx$(name,HTML_TAGS) >= 0 ? ('element') : ('div');
	};
	
	Imba.Tags.prototype.defineTag = function (name,supr,body){
		if(body==undefined && typeof supr == 'function') body = supr,supr = '';
		if(supr==undefined) supr = '';
		if (body && body._nodeType) {
			supr = body;
			body = null;
		};
		
		supr || (supr = this.baseType(name));
		
		var supertype = (typeof supr=='string'||supr instanceof String) ? (this[supr]) : (supr);
		var tagtype = Tag();
		var norm = name.replace(/\-/g,'_');
		
		tagtype._name = name;
		tagtype._flagName = null;
		
		if (name[0] == '#') {
			this[name] = tagtype;
			Imba.SINGLETONS[name.slice(1)] = tagtype;
		} else if (name[0] == name[0].toUpperCase()) {
			true;
		} else {
			tagtype._flagName = "_" + name.replace(/_/g,'-');
			this[name] = tagtype;
			this['$' + norm] = TagSpawner(tagtype);
		};
		
		
		extender(tagtype,supertype);
		
		if (body) {
			if (body.length == 2) {
				// create clone
				if (!tagtype.hasOwnProperty('TAGS')) {
					tagtype.TAGS = (supertype.TAGS || this).__clone();
				};
			};
			
			body.call(tagtype,tagtype,tagtype.TAGS || this);
			if (tagtype.defined) { tagtype.defined() };
			this.optimizeTag(tagtype);
		};
		return tagtype;
	};
	
	Imba.Tags.prototype.defineSingleton = function (name,supr,body){
		return this.defineTag(name,supr,body);
	};
	
	Imba.Tags.prototype.extendTag = function (name,supr,body){
		if(body==undefined && typeof supr == 'function') body = supr,supr = '';
		if(supr==undefined) supr = '';
		var klass = ((typeof name=='string'||name instanceof String) ? (this[name]) : (name));
		// allow for private tags here as well?
		if (body) { body && body.call(klass,klass,klass.prototype) };
		if (klass.extended) { klass.extended() };
		this.optimizeTag(klass);
		return klass;
	};
	
	Imba.Tags.prototype.optimizeTag = function (tagtype){
		var prototype_;
		(prototype_ = tagtype.prototype) && prototype_.optimizeTagStructure  &&  prototype_.optimizeTagStructure();
		return this;
	};
	
	
	Imba.SINGLETONS = {};
	Imba.TAGS = new Imba.Tags();
	Imba.TAGS.element = Imba.TAGS.htmlelement = Imba.Tag;
	
	
	var html = Imba.TAGS.defineNamespace('html');
	var svg = Imba.TAGS.defineNamespace('svg');
	Imba.TAGS = html; // make the html namespace the root
	
	svg.baseType = function (name){
		return 'element';
	};
	
	Imba.defineTag = function (name,supr,body){
		if(body==undefined && typeof supr == 'function') body = supr,supr = '';
		if(supr==undefined) supr = '';
		return Imba.TAGS.defineTag(name,supr,body);
	};
	
	Imba.defineSingletonTag = function (id,supr,body){
		if(body==undefined && typeof supr == 'function') body = supr,supr = 'div';
		if(supr==undefined) supr = 'div';
		return Imba.TAGS.defineTag(this.name(),supr,body);
	};
	
	Imba.extendTag = function (name,body){
		return Imba.TAGS.extendTag(name,body);
	};
	
	Imba.tag = function (name){
		var typ = Imba.TAGS[name];
		if (!typ) { throw new Error(("tag " + name + " is not defined")) };
		return new typ(typ.createNode());
	};
	
	Imba.tagWithId = function (name,id){
		var typ = Imba.TAGS[name];
		if (!typ) { throw new Error(("tag " + name + " is not defined")) };
		var dom = typ.createNode();
		dom.id = id;
		return new typ(dom);
	};
	
	// TODO: Can we move these out and into dom.imba in a clean way?
	// These methods depends on Imba.document.getElementById
	
	Imba.getTagSingleton = function (id){
		var klass;
		var dom,node;
		
		if (klass = Imba.SINGLETONS[id]) {
			if (klass && klass.Instance) { return klass.Instance };
			
			// no instance - check for element
			if (dom = Imba.document().getElementById(id)) {
				// we have a live instance - when finding it through a selector we should awake it, no?
				// console.log('creating the singleton from existing node in dom?',id,type)
				node = klass.Instance = new klass(dom);
				node.awaken(dom); // should only awaken
				return node;
			};
			
			dom = klass.createNode();
			dom.id = id;
			node = klass.Instance = new klass(dom);
			node.end().awaken(dom);
			return node;
		} else if (dom = Imba.document().getElementById(id)) {
			return Imba.getTagForDom(dom);
		};
	};
	
	var svgSupport = typeof SVGElement !== 'undefined';
	
	Imba.getTagForDom = function (dom){
		var m;
		if (!dom) { return null };
		if (dom._dom) { return dom }; // could use inheritance instead
		if (dom._tag) { return dom._tag };
		if (!dom.nodeName) { return null };
		
		var ns = null;
		var id = dom.id;
		var type = dom.nodeName.toLowerCase();
		var tags = Imba.TAGS;
		var native$ = type;
		var cls = dom.className;
		
		if (id && Imba.SINGLETONS[id]) {
			// FIXME control that it is the same singleton?
			// might collide -- not good?
			return Imba.getTagSingleton(id);
		};
		// look for id - singleton
		
		// need better test here
		if (svgSupport && (dom instanceof SVGElement)) {
			ns = "svg";
			cls = dom.className.baseVal;
			tags = tags.SVG;
		};
		
		var spawner;
		
		if (cls) {
			// there can be several matches here - should choose the last
			// should fall back to less specific later? - otherwise things may fail
			// TODO rework this
			var flags = cls.split(' ');
			var nr = flags.length;
			
			while (--nr >= 0){
				var flag = flags[nr];
				if (flag[0] == '_') {
					if (spawner = tags[flag.slice(1)]) {
						break;
					};
				};
			};
			
			// if var m = cls.match(/\b_([a-z\-]+)\b(?!\s*_[a-z\-]+)/)
			// 	type = m[1] # .replace(/-/g,'_')
			
			if (m = cls.match(/\b([A-Z\-]+)_\b/)) {
				ns = m[1];
			};
		};
		
		spawner || (spawner = tags[native$]);
		return spawner ? (new spawner(dom).awaken(dom)) : (null);
	};
	
	tag$ = Imba.TAGS;
	t$ = Imba.tag;
	tc$ = Imba.tagWithFlags;
	ti$ = Imba.tagWithId;
	tic$ = Imba.tagWithIdAndFlags;
	id$ = Imba.getTagSingleton;
	tag$wrap = Imba.getTagForDom;
	
	Imba.generateCSSPrefixes = function (){
		var styles = window.getComputedStyle(document.documentElement,'');
		
		for (var i = 0, ary = iter$(styles), len = ary.length, prefixed; i < len; i++) {
			prefixed = ary[i];
			var unprefixed = prefixed.replace(/^-(webkit|ms|moz|o|blink)-/,'');
			var camelCase = unprefixed.replace(/-(\w)/g,function(m,a) { return a.toUpperCase(); });
			
			// if there exists an unprefixed version -- always use this
			if (prefixed != unprefixed) {
				if (styles.hasOwnProperty(unprefixed)) { continue; };
			};
			
			// register the prefixes
			Imba.CSSKeyMap[unprefixed] = Imba.CSSKeyMap[camelCase] = prefixed;
		};
		return;
	};
	
	if (ENV_WEB) {
		if (document) { Imba.generateCSSPrefixes() };
		
		// Ovverride classList
		if (document && !document.documentElement.classList) {
			tag$.extendTag('element', function(tag){
				
				tag.prototype.hasFlag = function (ref){
					return new RegExp('(^|\\s)' + ref + '(\\s|$)').test(this._dom.className);
				};
				
				tag.prototype.addFlag = function (ref){
					if (this.hasFlag(ref)) { return this };
					this._dom.className += (this._dom.className ? (' ') : ('')) + ref;
					return this;
				};
				
				tag.prototype.unflag = function (ref){
					if (!this.hasFlag(ref)) { return this };
					var regex = new RegExp('(^|\\s)*' + ref + '(\\s|$)*','g');
					this._dom.className = this._dom.className.replace(regex,'');
					return this;
				};
				
				tag.prototype.toggleFlag = function (ref){
					return this.hasFlag(ref) ? (this.unflag(ref)) : (this.flag(ref));
				};
				
				tag.prototype.flag = function (ref,bool){
					if (arguments.length == 2 && !!bool === false) {
						return this.unflag(ref);
					};
					return this.addFlag(ref);
				};
			});
		};
	};
	
	return Imba.Tag;

})();