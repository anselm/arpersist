
![Splash Image](public/assets/splash.jpg?raw=true "Splash Art")

# About

See https://hacks.mozilla.org/2019/01/augmented-reality-and-the-browser%e2%80%8a-%e2%80%8aan-app-experiment/

Also here is a video: https://www.youtube.com/watch?v=rYxahAnz34g

This app is an exploration of persistent AR in the browser leveraging ARKit to simulate centimeter accurate GPS. Uses webxr-ios to fetch arkit maps into the browser. In combination with a gps location, we can compute the gps location for other anchors that are placed in the environment.

Persistence is supported using a client/server architecture where maps associated with a gps location can be saved to the server and then fetched by clients at that gps location. In addition any user placed features can also be retrieved.

Early explorations of multi-player support are also present. There are thoughts here about a larger richer social experience such as filtering posts based on if they are by parties that you have friended. This is ongoing however. As it stands you can see other players as a "heart" floating in space where their phone is, and you can see each other move and edit objects.

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

# Code Design

*2D Components*. Typically an application like this would be built using React. React is a component based framework that allows developers to consolidate UX elements into standalone blocks and allows for event propagation and url routing. Often developers will combine React with MobX or other state management schemes. Often React like frameworks focus on efficiently updating a shadow DOM. Often React apps are 'compiled' and there is a background 'build compile run' process.

In my application I'm exploring an idea of using pure HTMLComponent based objects with no compile phase. I don't worry about optimally regenerating the DOM based on state changes because the cost of that is low. I also have my own small router. It is some extra work to avoid having any kind of custom base class for my components to inherit, but the win at the end of the day is that pure HTMLComponents could be shared between various projects without any apriori agreement or base foundation.

*3D Components*. For 3d objects and behaviors I have some new work that is not merged in here yet. It sits below concepts like AFrame and above concepts like 3js.

*Geolocation*. ARKit lets us place objects persistently in scanned volume. This volume itself can be geolocated using a GPS. The combination of both gives us centimeter accurate geolocation even without GPS (once the volume is scanned). This app is based around that observation - that we can play with ideas of persistent AR even early in the technology curve.

# Future Ideas

Improving the user controls by introducing widgets and manipulators to select, scale, rotate, move, cut, paste, retexture and otherwise alter objects. There may be a property sheet editor and or a palette of some kind to allow rich property editing on objects. For now I've introduced an idea of using the phone itself as a 6dof controller to grab and move and stretch objects - but richer manipulations would be desired.

A formal grammer for describing objects on disk. This would be a text based grammar - and in some ways similar to AFrame but json and at a lower level.

Filters and searches on objects. If we imagine this application to be a social object placement tool then we can imagine filtering by topic, tags, sponsor, popularity and suchlike. It may make sense to prioritize what is rendered in general based on some kind of scoring as well.

Richer object relationships. Semantics around placement (pin to wall, pin to floor relate to another object and suchlike.

Richer object 'verbs' - animations, behaviors, triggers, sensors. This should fit within a document model philosophy where we can load up objects and collections of objects that are fairly rich. Scriptable objects would be nice as well.

Admin modes, or power modes for say correlating a point cloud with a GPS location. There may be a need to do some nudging or adjusting or loop closure for point clouds especially as correlated with GPS.

Improved privacy and clarity around privacy. Right now point clouds could leak some personal state, such as where walls or floors are in a personal space. It may be useful to mark out what is public or not and to think through privacy more.

A radar or birds eye view that shows a globe and objects on a globe. Arguably some of these display modes may be useful in a desktop environment, so the application could exist in two settings; in a desktop and in a local mobile setting.

Stronger social capabilities; to friend, filter by friends and suchlike. It's arguable that perhaps there are "layers" so that you can subscribe to a layer or join a layer. There are questions around how group conversations are formed; do you follow people, or do you follow rooms? I tend to dislike the individual centric philosophy of social networks and prefer the room based philosophy of services like IRC.

Formalization of basic properties of objects. Right now objects have properties such as a title, link, location, time, radius, priority, privacy, semantic hints (stick to floor etc), tags, a photo or image representation. There may be other properties as well. Ideally there would be kinds of objects and a schema editor per kind of object.

BIP39 could continue to be refined as a pattern for a zero server managed login philosophy which is aligned with my own values around breaking away from centralization.

https://www.mobilefish.com/developer/nodejs/nodejs_quickguide_browserify_bip39.html










