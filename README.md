#About

A persistent AR browser

#Usage

	npm install
	npm start
	Then goto url of the server instance with xrviewer-ios browser

#Current status and goals

bugs and issues oct 8 2018

	- rebuilt to latest
<<<	- reloading doesn't seem to spur anchor creation - whats up?

	- at startup should fetch all content of the zone - means telling server what zone you want
	- during normal synchronous update should filter by zone as well
	- re-examine the math and flow of creating entities; does it make sense to make anchors for network inbound entities?


bigger goals - an opportunity to play with ar authoring and fixing some design flaws with conventional social networks

	user experience

		- letting users select and scale, rotate, move, cut, paste, recolor, relabel objects with manipulators
		- group select
		- filter by topic, tags, sponsor etc, maybe filter by upvotes or score, maybe fade out old content
		- pin relative to other objects
		- animations and behaviors
		- triggers and sensors
		- admin mode or something for correctly placing point clouds at a gps?
		- some kind of nudging to let you fiddle with alignment issues
		- first person mode
		- a globe render mode or top view map mode
		- a list mode

	infrastructure
		- layers or rooms or some way to have game worlds separated into layers
		- automatically fetch maps by gps

	login and perms
		- some kind of login management or user identity - force to have mozillian accounts?
		- some kind of trust graph based filtering (to play with fixing the twitter problem which is even worse in ar)
		- mutiple identities?

	properties per thing
		- title
		- link
		- location
		- time
		- radius etc
		- kind? maybe or some way of saying if it is meant to be global or street level
		- score maybe; objective? over time? like is it good content or bad content
		- privacy
		- semantic hints
		- maybe even an associated photo hint
		- tagging, layering, or grouping
		- urgency; signaling
		- origin and anchor type - is the parent a location
		- we could send the planes themselves if we want; and even the features

	+ some kind of public channel - that we may curate by hand or that are scored up in some way
	+ i wonder if there are actual behaviors that i can render on objects












