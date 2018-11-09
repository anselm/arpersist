
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

It will print out an http:// address to go to (* using the webxr-ios browser above) and this will bring up a client ux.

# Usage

![Login Image](public/art/login.jpg?raw=true "Login Page")
![Picker Image](public/art/picker.jpg?raw=true "Picker Page")
![Main Image](public/art/main.jpg?raw=true "Main Page")
![Edit Image](public/art/edit.jpg?raw=true "Edit Page")
![Map Image](public/art/map.jpg?raw=true "Map Page")

The client web app usage is as follows:

  0) Go to the web page above or if you're using glitch then goto that web page (* using the webxr-ios browser)
  1) Login Page: Pick a name for the shared server environment (which you are running above with npm)
  2) Map Picker Page: Pick a map or "a fresh map"
  3) Main Page Save Map Button: To make and save a map first scan your world carefully, place a gps anchor, then save the map (this is an admin power detected based on your webxr-ios build)
  4) Main Page Save Art Button: Place art objects in the world
  5) Main Page Edit Button: Edit selected art object properties such as the art assets they are associated with or their gps location.
  6) Main Page Participant location button: Updates your position over the network so that other players can see where you are.

# Technical Approach

1. slam maps
   when the system starts up it begins creating an arkit map immediately
   these maps can be loaded or saved along with associated anchors that were made at that time

2. arkit anchors in general
   the user can place arkit 'anchors' to mark a location in the space
   an arkit anchor encodes a full local transform (translation and orientation) in the arkit relative space
   and arkit is nice enough to try arrange space so that +X is EAST and +Y is towards space and +Z is towards the south pole
   however apparently sometimes these anchors can move occasionally as arkit fine-tunes what it thinks is north or suchlike

3. gps anchors
   at the same time gps events are coming in - which can be fairly inaccurate
   when a gps event arrives it's a good opportunity to place a "gps anchor" - an arkit anchor associated with a gps location
   however right now this is a manual process and somewhat clumsy; you should point the phone down and place a gps anchor
   you can also place more than one gps anchor because I'm playing with an idea of having multiple gps anchors to orient the map
   also since gps events are so erratic, i have a mode that shows you an ordinary map so you can at least correct the horizontal position

4. estimating cartesian coordinates of anchors
   given a gps associated anchor, it's possible to estimate a gps coordinate for any other point in the system
   a way to think about the transformation is to imagine an arkit local reference frame being a box on the earth at 0,0 latitude and longitude
   the origin of the box is the position of the gps anchor, and the orientation of the box is +X left, Y+ towards space, +Z towards south
   the cartesian coordinates of any anchor is (anchor xyz - gps anchor xyz), then rotated by the latitude and then longitude of the gps anchor
   there is a utility in cesium to do this; I form a ray of (anchor-gpsanchor) and then transform it by the longitude and latitude
   it's also easy to go the other way
   given a cartesian point in space it can be inverse transformed to the local coordinate system and then re-added to the arkit gps anchor xyz offset
   because any arkit anchor can move, including our special gps anchor, currently entity positions are recomputed every frame

5. loading and saving
   when arkit saves a map it also saves the anchors names, and this can be used to re-associate anchors with gps locations
   when the system starts up it inhales all known entities over the network - passing them to the local engine
   as well when a map is reloaded it also passes all re-discovered anchors to the local engine
   in either case anchors or entities coming in from anywhere are remembered locally and rebound to each other as soon as possible

6. user experience
   right now a participant indicates their unique name as an url parameter ?participant=george
   right now also there is a concept of a zone which saves me the hassle of filtering stuff... ?zone=myzone&participant=george
   right now the user can make any number of gps anchors, and these are networked between instances; later these may not be networked
   right now any user can make and save a map - I may hide that feature - it could ruin the experience for everybody and is a security issue

# TODO

- improve edit page
- test showing other players
- it would be nice to show a globe that shows where all the participants are
- network init and rebinding to anchors
- provide more notification on when gps is ready, when arkit is ready, when a good time to capture gps is
- may hide creating maps and placing gps anchors
- need to do full orientation transform 

# Future

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












