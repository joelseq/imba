
var isClient = (typeof window == 'object' and typeof document == 'object')

if isClient
	ENV_TARGET = 'web'
	ENV_WEB = true
	ENV_NODE = false
	window:global ||= window
else
	ENV_TARGET = 'node'
	ENV_WEB = false
	ENV_NODE = true

###
Imba is the namespace for all runtime related utilities
@namespace
###
Imba = {
	VERSION: '0.15.0-alpha.2'
	CLIENT: isClient
	SERVER: !isClient
	DEBUG: no
}

###
True if running in client environment.
@return {bool}
###
def Imba.isClient
	Imba.CLIENT == yes

###
True if running in server environment.
@return {bool}
###
def Imba.isServer
	!Imba.CLIENT

def Imba.subclass obj, sup
	for k,v of sup
		obj[k] = v if sup.hasOwnProperty(k)

	obj:prototype = Object.create(sup:prototype)
	obj:__super__ = obj:prototype:__super__ = sup:prototype
	obj:prototype:initialize = obj:prototype:constructor = obj
	return obj

###
Lightweight method for making an object iterable in imbas for/in loops.
If the compiler cannot say for certain that a target in a for loop is an
array, it will cache the iterable version before looping.

```imba
# this is the whole method
def Imba.iterable o
	return o ? (o:toArray ? o.toArray : o) : []

class CustomIterable
	def toArray
		[1,2,3]

# will return [2,4,6]
for x in CustomIterable.new
	x * 2

```
###
def Imba.iterable o
	return o ? (o:toArray ? o.toArray : o) : []

###
Coerces a value into a promise. If value is array it will
call `Promise.all(value)`, or if it is not a promise it will
wrap the value in `Promise.resolve(value)`. Used for experimental
await syntax.
@return {Promise}
###
def Imba.await value
	if value isa Array
		Promise.all(value)
	elif value and value:then
		value
	else
		Promise.resolve(value)

var dashRegex = /-./g

def Imba.toCamelCase str
	if str.indexOf('-') >= 0
		str.replace(dashRegex) do |m| m.charAt(1).toUpperCase
	else
		str

def Imba.indexOf a,b
	return (b && b:indexOf) ? b.indexOf(a) : []:indexOf.call(a,b)

def Imba.prop scope, name, opts
	if scope:defineProperty
		return scope.defineProperty(name,opts)
	return

def Imba.attr scope, name, opts
	if scope:defineAttribute
		return scope.defineAttribute(name,opts)

	let getName = Imba.toCamelCase(name)
	let setName = Imba.toCamelCase('set-' + name)

	scope:prototype[getName] = do
		return this.getAttribute(name)

	scope:prototype[setName] = do |value|
		this.setAttribute(name,value)
		return this
	return

def Imba.propDidSet object, property, val, prev
	let fn = property:watch
	if fn isa Function
		fn.call(object,val,prev,property)
	elif fn isa String and object[fn]
		object[fn](val,prev,property)
	return


# Basic events
def emit__ event, args, node
	# var node = cbs[event]
	var prev, cb, ret

	while (prev = node) and (node = node:next)
		if cb = node:listener
			if node:path and cb[node:path]
				ret = args ? cb[node:path].apply(cb,args) : cb[node:path]()
			else
				# check if it is a method?
				ret = args ? cb.apply(node, args) : cb.call(node)

		if node:times && --node:times <= 0
			prev:next = node:next
			node:listener = null
	return

# method for registering a listener on object
def Imba.listen obj, event, listener, path
	var cbs, list, tail
	cbs = obj:__listeners__ ||= {}
	list = cbs[event] ||= {}
	tail = list:tail || (list:tail = (list:next = {}))
	tail:listener = listener
	tail:path = path
	list:tail = tail:next = {}
	return tail

# register a listener once
def Imba.once obj, event, listener
	var tail = Imba.listen(obj,event,listener)
	tail:times = 1
	return tail

# remove a listener
def Imba.unlisten obj, event, cb, meth
	var node, prev
	var meta = obj:__listeners__
	return unless meta

	if node = meta[event]
		while (prev = node) and (node = node:next)
			if node == cb || node:listener == cb
				prev:next = node:next
				# check for correct path as well?
				node:listener = null
				break
	return

# emit event
def Imba.emit obj, event, params
	if var cb = obj:__listeners__
		emit__(event,params,cb[event]) if cb[event]
		emit__(event,[event,params],cb:all) if cb:all # and event != 'all'
	return

def Imba.observeProperty observer, key, trigger, target, prev
	if prev and typeof prev == 'object'
		Imba.unlisten(prev,'all',observer,trigger)
	if target and typeof target == 'object'
		Imba.listen(target,'all',observer,trigger)
	self

Imba
