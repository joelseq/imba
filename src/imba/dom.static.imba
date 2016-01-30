var ImbaTag = Imba.Tag

def removeNested root, node, caret
	# if node/nodes isa String
	# 	we need to use the caret to remove elements
	# 	for now we will simply not support this
	if node isa ImbaTag
		root.removeChild(node)
	elif node isa Array
		removeNested(root,member,caret) for member in node
	else
		# what if this is not null?!?!?
		# take a chance and remove a text-elementng
		let next = caret ? caret:nextSibling : root.@dom:firstChild
		if next isa Text and next:textContent == node
			root.removeChild(next)
		else
			throw 'cannot remove string'

	return caret

def appendNested root, node
	if node isa ImbaTag
		root.appendChild(node)

	elif node isa Array
		appendNested(root,member) for member in node

	elif node != null and node !== false
		root.appendChild Imba.document.createTextNode(node)

	return


# insert nodes before a certain node
# does not need to return any tail, as before
# will still be correct there
# before must be an actual domnode
def insertNestedBefore root, node, before
	if node isa ImbaTag
		root.insertBefore(node,before)
	elif node isa Array
		insertNestedBefore(root,member,before) for member in node
	elif node != null and node !== false
		root.insertBefore(Imba.document.createTextNode(node),before)

	return before

# after must be an actual domnode
def insertNestedAfter root, node, after
	var before = after ? after:nextSibling : root.@dom:firstChild

	if before
		insertNestedBefore(root,node,before)
		return before:previousSibling
	else
		appendNested(root,node)
		return root.@dom:lastChild

def reconcileCollectionChanges root, new, old, caret

	var newLen = new:length
	var lastNew = new[newLen - 1]

	# This re-order algorithm is based on the following principle:
	# 
	# We build a "chain" which shows which items are already sorted.
	# If we're going from [1, 2, 3] -> [2, 1, 3], the tree looks like:
	#
	# 	3 ->  0 (idx)
	# 	2 -> -1 (idx)
	# 	1 -> -1 (idx)
	#
	# This tells us that we have two chains of ordered items:
	# 
	# 	(1, 3) and (2)
	# 
	# The optimal re-ordering then becomes two keep the longest chain intact,
	# and move all the other items.

	var newPosition = []

	# The tree/graph itself
	var prevChain = []
	# The length of the chain
	var lengthChain = []

	# Keep track of the longest chain
	var maxChainLength = 0
	var maxChainEnd = 0

	for node, idx in old
		var newPos = new.indexOf(node)
		newPosition.push(newPos)

		if newPos == -1
			root.removeChild(node)
			prevChain.push(-1)
			lengthChain.push(-1)
			continue

		var prevIdx = newPosition:length - 2

		# Build the chain:
		while prevIdx >= 0
			if newPosition[prevIdx] == -1
				prevIdx--
			elif newPos > newPosition[prevIdx]
				# Yay, we're bigger than the previous!
				break
			else
				# Nope, let's walk back the chain
				prevIdx = prevChain[prevIdx]

		prevChain.push(prevIdx)

		var currLength = (prevIdx == -1) ? 0 : lengthChain[prevIdx]+1

		if currLength > maxChainLength
			maxChainLength = currLength
			maxChainEnd = idx

		lengthChain.push(currLength)

	var stickyNodes = []

	# Now we can walk the longest chain backwards and mark them as "sticky",
	# which implies that they should not be moved
	var cursor = newPosition:length - 1
	while cursor >= 0
		if cursor == maxChainEnd and newPosition[cursor] != -1
			stickyNodes[newPosition[cursor]] = true
			maxChainEnd = prevChain[maxChainEnd]
		
		cursor -= 1

	# And let's iterate forward, but only move non-sticky nodes
	for node, idx in new
		if !stickyNodes[idx]
			var after = new[idx - 1]
			insertNestedAfter(root, node, (after and after.@dom) or caret)

	# should trust that the last item in new list is the caret
	return lastNew and lastNew.@dom or caret


# expects a flat non-sparse array of nodes in both new and old, always

###
We should optimize for the common cases:
 - node(s) inserted to top or bottom
 - node(s) removed from top or bottom
 - nodes pushed/popped - same order (ring)
 - many changes - opt out of smart algorithm

how does a full reverse / arbitrary sort work now?
how many changes?
what if there are 
###
def reconcileCollection root, new, old, caret, topLevel
	var l1 = new:length
	var l0 = old:length
	var ld = l1 - l0

	var i = l1

	var last = new[l1 - 1]

	# if l0 == l1
	# check for cycle change
	if ld == 0
		return caret if l0 == 0
		let offset = old.indexOf(new[0])
		let k = 0

		if offset >= 0
			while k < l1
				let el1 = new[k]
				let el0 = old[(k + offset) % l1]
				break if el1 != el0
				k++

			if k == l1 and topLevel
				k = 0

				# should go through and prepend instead
				if offset > (l1 / 2)
					while offset < l1
						# root.insertBefore(node,before)
						root.insertBefore(old[offset],old[0])
						offset++
				else
					while k < offset
						root.appendChild(old[k++])

				return last and last.@dom or caret

	
	elif ld > 0
		# now check for inserted elements
		# these are very similar - just mirrored. refactor
		if l0 == 0
			# console.log 'append everything'
			appendNested(root,new,caret)
			return last and last.@dom or caret

		# is it likely that the new nodes are appended?
		if old[0] == new[0] and old[l0 - 1] == new[l0 - 1]
			let k = 0
			while k < l0
				break if old[k] != new[k]
				k++

			if k == l0
				# console.log 'append to list',l0,l1,new.slice(l0),old[l0 - 1]
				insertNestedAfter(root,new.slice(l0),old[l0 - 1].@dom)
				return last and last.@dom or caret

		elif new[l1 - 1] == old[l0 - 1]
			# console.log 'last is the same'
			# the last items are the same -- likely added to top
			let start = new.indexOf(old[0])
			if start >= 0
				let k = 0
				while k < l0
					break if new[k + start] != old[k]
					k++

				if k == l0
					# console.log 'all are added top the top'
					insertNestedBefore(root,new.slice(0,start),old[0])
					return last and last.@dom or caret
	elif ld < 0
		if l1 == 0
			removeNested(root,old,caret)
			return caret

		# removals are likely at the end
		if old[0] == new[0] and old[l1 - 1] == new[l1 - 1]
			let k = 0
			while k < l1
				break if old[k] != new[k]
				k++
			if k == l1
				# console.log 'removal at the end',l0,l1
				if ld == -1
					root.removeChild(old[l1])
				else
					removeNested(root,old.slice(l1),caret)
				return last and last.@dom or caret

		elif new[l1 - 1] == old[l0 - 1]
			# probably from the start
			let start = old.indexOf(new[0])
			if start >= 0
				let k = 0
				while k < l1
					break if new[k] != old[k + start]
					k++

				if k == l1
					# console.log 'removal at the start',k,l1,l0
					while start > 0
						root.removeChild(old[--start])
					return last and last.@dom or caret


	if l0 >= l1 and new[0] === old[0]
		# running through to compare
		while i--
			break if new[i] !== old[i]

	if i == -1
		if l0 > l1
			while l0 > l1
				# does not work for text nodes
				root.removeChild(old[--l0])

		return last and last.@dom or caret
	else
		return reconcileCollectionChanges(root,new,old,caret)

# the general reconciler that respects conditions etc
# caret is the current node we want to insert things after
def reconcileNested root, new, old, caret

	# var skipnew = new == null or new === false or new === true
	var newIsNull = new == null or new === false
	var oldIsNull = old == null or old === false

	if new === old
		# remember that the caret must be an actual dom element
		# we should instead move the actual caret? - trust
		if newIsNull
			return caret
		elif new and new.@dom
			return new.@dom
		else
			return caret ? caret:nextSibling : root.@dom:firstChild

	elif new isa Array
		if old isa Array
			if new:static or old:static
				# if the static is not nested - we could get a hint from compiler
				# and just skip it
				if new:static == old:static
					for item,i in new
						# this is where we could do the triple equal directly
						caret = reconcileNested(root,item,old[i],caret)
					return caret
				else
					removeNested(root,old,caret)
					
				# if they are not the same we continue through to the default
			else
				return reconcileCollection(root,new,old,caret)

		elif old isa ImbaTag
			root.removeChild(old)
		elif !oldIsNull
			# old was a string-like object?
			root.removeChild(caret ? caret:nextSibling : root.@dom:firstChild)			

		return insertNestedAfter(root,new,caret)
		# remove old

	elif new isa ImbaTag
		removeNested(root,old,caret) unless oldIsNull
		insertNestedAfter(root,new,caret)
		return new

	elif newIsNull
		removeNested(root,old,caret) unless oldIsNull
		return caret
	else
		# if old did not exist we need to add a new directly
		let nextNode
		# if old was array or imbatag we need to remove it and then add
		if old isa Array
			removeNested(root,old,caret)
		elif old isa ImbaTag
			root.removeChild(old)
		elif !oldIsNull
			# ...
			nextNode = caret ? caret:nextSibling : root.@dom:firstChild
			if nextNode isa Text and nextNode:textContent != new
				nextNode:textContent = new
				return nextNode

		# now add the textnode
		return insertNestedAfter(root,new,caret)


extend tag htmlelement
	
	def setChildren new, typ
		var old = @children
		# var isArray = nodes isa Array
		if new === old
			return self

		if !old
			empty
			appendNested(self,new)

		elif typ == 2
			return self

		elif typ == 1
			# here we _know _that it is an array with the same shape
			# every time
			let caret = null
			for item,i in new
				# prev = old[i]
				caret = reconcileNested(self,item,old[i],caret)

		elif typ == 3
			# this is possibly fully dynamic. It often is
			# but the old or new could be static while the other is not
			# this is not handled now
			# what if it was previously a static array? edgecase - but must work
			if new isa ImbaTag
				empty
				appendChild(new)

			# check if old and new isa array
			elif new isa Array
				if old isa Array
					# is this not the same as setting staticChildren now but with the
					reconcileCollection(self,new,old,null,yes)
				else
					empty
					appendNested(self,new)
				
			else
				text = new
				return self

		elif new isa Array and old isa Array
			reconcileCollection(self,new,old,null,yes)
		else
			empty
			appendNested(self,new)

		@children = new
		return self


	# only ever called with array as argument
	def setStaticChildren new
		var old = @children

		let caret = null
		for item,i in new
			# prev = old[i]
			caret = reconcileNested(self,item,old[i],caret)

		@children = new
		return self

	def content
		@content or children.toArray

	def text= text
		if text != @children
			@children = text
			dom:textContent = text == null or text === false ? '' : text
		self