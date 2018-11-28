
![Splash Image](public/art/splash.jpg?raw=true "Splash Art")

# About

An exploration of persistent AR in the browser leveraging ARKit to simulate centimeter accurate GPS. Uses webxr-ios to fetch arkit maps into the browser. In combination with a gps location, we can compute the gps location for other anchors that are placed in the environment.

A client/server architecture is used where maps associated with a gps location can be saved to the server and then fetched by clients at that gps location. In addition any user placed features can also be retrieved.

# Build

You need webxr-ios to view this page - build the develop branch at : https://github.com/mozilla-mobile/webxr-ios . Remember to build the develop branch...

This app itself is a nodejs app, it can be installed and run like so locally (although I recommend using glitch for https and geolocation support):

  npm install
  npm run
  (or node server.js)

It will print out an http:// address:port to go to (* using the webxr-ios browser above) and this will bring up a client ux.

# Usage

The client web app usage is as follows:

  0) Go to the web page above or if you're using glitch then goto that web page (* using the webxr-ios browser)
  1) Login Page: Pick a name for the shared server environment (which you are running above with npm)
  2) Map Picker Page: Pick a map or "a fresh map"
  3) Main Page Save Map Button: To make and save a map first scan your world carefully, place a gps anchor, then save the map (this is an admin power detected based on your webxr-ios build)
  4) Main Page Save Art Button: Place art objects in the world
  5) Main Page Edit Button: Edit selected art object properties such as the art assets they are associated with or their gps location.
  6) Main Page Participant location button: Updates your position over the network so that other players can see where you are.

# Future Ideas

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












