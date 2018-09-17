
////////////////////////////////////////////////////////////////////////
// client - Sep 11 2018
//
// - publishes entities to a server
// - busy polls server for updates
// - paints entities to display
// - uses xr ios extensions to anchor entities relative to an anchor
//
// - TODO generate a room UUID per session so that every client instance has its own room
// - TODO do not shovel everything back to client every update - only send back differences
//
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
// anchor example
////////////////////////////////////////////////////////////////////////

class ARAnchorGPSTest extends XRExampleBase {

	constructor(domElement) {

		// begin capturing gps information
		this.gpsInitialize();

		// begin a system for managing a concept of persistent entities / features / objects
		this.entityInitialize();

		// add a ux button for adding features
		super(domElement, false)
		this.addObjectButton = document.createElement('button')
		this.addObjectButton.setAttribute('class', 'add-object-button')
		this.addObjectButton.innerText = 'Add Box'
		this.el.appendChild(this.addObjectButton)
		this.addObjectButton.addEventListener('click', this.uxAdd );

	}

	///////////////////////////////////////////////
	// scene glue / callbacks
	///////////////////////////////////////////////

	// Called during construction by parent scope
	initializeScene() {
		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)
	}

	updateScene(frame) {
		this.uxUpdate(frame);
	}

	createSceneGraphNode(){
		let geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1)
		let material = new THREE.MeshPhongMaterial({ color: '#FF9999' })
		return new THREE.Mesh(geometry, material)
	}

	///////////////////////////////////////////////
	// ux glue
	///////////////////////////////////////////////

	uxAdd() {
		this.entityCreateOnePlease = 1;
	}

	uxUpdate(frame) {

		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

		if(this.entityCreateOnePlease) {
			this.entityCreateOnePlease = 0;
			this.entityAdd(frame,headCoordinateSystem)
		}

		this.entityUpdate(frame,headCoordinateSystem);
	}

	///////////////////////////////////////////////
	// gps glue
	///////////////////////////////////////////////

	gpsInitialize() {
		this.gps = 0;
		navigator.geolocation.watchPosition((position) => {
			this.gps = position;
		});
	}

	gpsGet() {
		let scratch = this.gps;
		this.gps = 0;
		return scratch;
	}

	////////////////////////////////////////////////////////////
	// geographic anchor concept - connects arkit pose + gps
	///////////////////////////////////////////////////////////

	gpsAnchorGet(frame,headCoordinateSystem) {

		// TODO some kind of better strategy should go here as to how frequently we update the anchors - for now always TRUE

		if(true) {

			// given a frame pose attempt to associate this with an anchor to bind an arkit pose to a gps coordinate

			let gps = this.gpsGet();

			if(gps) {

				console.log("gpsAnchorCapture: has a fresh GPS");
				console.log(gps);

				if(this.gpsAnchor && this.gpsAnchor.anchor) {
					// for now just remove it rather than having a queue
					frame.removeAnchor(this.gpsAnchor.anchor);
				}

				// add a new anchor which ostensibly binds the virtual to the real
				this.gpsAnchor = {}
				this.gpsAnchor.anchor = frame.addAnchor(this.headCoordinateSystem, [0,0,0])
				this.gpsAnchor.gps = gps;
			}
		}

		return this.gpsAnchor;
	}

	///////////////////////////////////////////////
	// entity concept of server managed entities
	///////////////////////////////////////////////

	entityInitialize() {
		this.entities = {}
		this.entityBusyPoll()
	}

	entityBusyPoll() {

		// for now we busy poll server and store anything new

		var d = new Date()
		var n = d.getTime()
		console.log("Busy polling server at time " + n )

		this.postDataHelper('/api/entity/sync',{time:n}).then(results => {

			for(let uuid in results) {
				let entity = results[uuid]
				if(entity.uuid && !this.entities[entity.uuid]) {
					this.entities[entity.uuid] = entity
					console.log("Added entity to local set")
					console.log(entity)
				}
			}

			setTimeout(this.entityBusyPoll,1000)

		})
	}

	entityUpdate(frame,headCoordinateSystem) {

		// Update entities we know of

		for(let uuid in entities) {
			if(!uuid) continue;
			let entity = entities[uuid]

			// give each entity some cpu time to do whatever it wishes
			if(!entity.node) {
				// ideally an entity would be responsible for itself - but for now let's hardcode a renderable for it
				entity.node = this.createSceneGraphNode()
				entity.anchorUID = frame.addAnchor(this.headCoordinateSystem, [entity.x, entity.y, entity.z])
				this.addAnchoredNode(new XRAnchorOffset(entity.anchorUID), entity.node)
			}

		}


		// now deal with the user choosing to place a new feature in space in front of them - in arkit coordinates
		// (In this case I place the anchor relative to the head a bit in front of the user)
		//
		// https://developer.apple.com/documentation/arkit/arsessionconfiguration/worldalignment/gravityandheading
		// The y-axis matches the direction of gravity as detected by the device's motion sensing hardware; that is,
		// the vector (0,-1,0) points downward.
		// The x- and z-axes match the longitude and latitude directions as measured by Location Services.
		// The vector (0,0,-1) points to true north and the vector (-1,0,0) points west.
		// (That is, the positive x-, y-, and z-axes point east, up, and south, respectively.)
		//

		// reconstituting the feature (after it was saved over a network or in a database) is something like this

		let reconstituted = {}
		let scratch = Cesium.Cartesian3.subtract(bridge.cartesian,feature.cartesian,new Cesium.Cartesian3(0,0,0))

		reconstituted.anchor = frame.addAnchor(this.headCoordinateSystem, [scratch.x, scratch.y, scratch.z])
	}

	entityAdd(frame,headCoordinateSystem) {

		// get a gps associated anchor or fail

		let gpsAnchor = this.gpsAnchorGet(frame,headCoordinateSystem);

		if(!gpsAnchor) {
			console.error("No camera pose + gps yet");
			// TODO be more helpful for end user
			return;
		}

		// Make a new entity to broadcast to network
		let entity = {}

		// Place in front of current actual camera (not in front of last captured world anchor)
		let anchor = frame.addAnchor(headCoordinateSystem, [0,0,-0.7777])

		// Get relative cartesian coordinates of new entity
		let local = new Cesium.Cartesian3(anchor.transform.x, anchor.transform.z, anchor.transform.y)

		// Get absolute cartesian coordinates of world associated anchor
		let world = Cesium.Cartesian3.fromDegrees(gpsAnchor.gps.longitude, gpsAnchor.gps.latitude, gpsAnchor.gps.elevation,  Ellipsoid.WGS84, new Cesium.Cartesian3(0,0,0) )

		// Actual position of feature is relative to world anchor (and recycle 'local' to store the result for a moment)
		entity.cartesian = Cesium.Cartesian3.subtract(local,world,local)

		// TODO throw away the anchor - or don't even make one

		// push to network

		this.entityBroadcast(entity);

	}


	entityBroadcast(entity) {
		this.postDataHelper('/api/entity/save',entity).then(result => {
			if(!result || !result.uuid) {
				console.error("failed to save to server")
			} else {
				// save locally if network returns it to us ( we don't need to do this here but can wait for busy poll for now )
				this.entities[result.uuid] = result
			}
		})
	}

	postDataHelper(url,data) {
	    return fetch(url, {
	        method: "POST",
	        mode: "cors", // no-cors, cors, *same-origin
	        cache: "no-cache",
	        credentials: "same-origin", // include, same-origin, *omit
	        headers: { "Content-Type": "application/json; charset=utf-8", },
	        referrer: "no-referrer", // no-referrer, *client
	        body: JSON.stringify(data),
	    }).then(response => response.json())
	}



}

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		try {
			window.pageApp = new ARAnchorGPSTest(document.getElementById('target'))
		} catch(e) {
			console.error('page error', e)
		}
	}, 1000)
})


/*

NOTES

*


	let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

	// periodically build an anchor that glues an arkit coordinate to a world coordinate
	// TODO this could actually be a callback inside of getlocation

	let bridge = {}
	bridge.anchor = frame.addAnchor(this.headCoordinateSystem, [0,0,0])
	bridge.cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, elevation,  Ellipsoid.WGS84, new Cesium.Cartesian3(0,0,0) )

	// now deal with the user choosing to place a new feature in space in front of them - in arkit coordinates
	// (In this case I place the anchor relative to the head a bit in front of the user)
	//
	// https://developer.apple.com/documentation/arkit/arsessionconfiguration/worldalignment/gravityandheading
	// The y-axis matches the direction of gravity as detected by the device's motion sensing hardware; that is,
	// the vector (0,-1,0) points downward.
	// The x- and z-axes match the longitude and latitude directions as measured by Location Services.
	// The vector (0,0,-1) points to true north and the vector (-1,0,0) points west.
	// (That is, the positive x-, y-, and z-axes point east, up, and south, respectively.)
	//

	let feature = {}
	feature.anchor = frame.addAnchor(this.headCoordinateSystem, [0,0,-0.7777])
	let scratch = new Cesium.Cartesian3(feature.anchor.transform.x, feature.anchor.transform.z, feature.anchor.transform.y)
	feature.cartesian = Cesium.Cartesian3.add(bridge.cartesian, scratch, scratch)

	// reconstituting the feature (after it was saved over a network or in a database) is something like this

	let reconstituted = {}
	let scratch = Cesium.Cartesian3.subtract(bridge.cartesian,feature.cartesian,new Cesium.Cartesian3(0,0,0))

	reconstituted.anchor = frame.addAnchor(this.headCoordinateSystem, [scratch.x, scratch.y, scratch.z])

// TODO STILL
//	because ios can move the special camera+geolocation anchors that I am placing
//	I probably need to re-compute the position of any features that I place
//	If I were to associate any features I place with anchors this could happen automatically - but I prefer to do it myself
//

// Notes
// Given an LLA convert it to a fixed frame reference
// https://cesiumjs.org/Cesium/Build/Documentation/Transforms.html
//let result = new Matrix4()
//let origin = new Cesium.Cartesian3(longitude, latitude, elevation)
//Cesium.Transforms.eastNorthUpToFixedFrame(origin, Ellipsoid.WGS84, result)
// https://cesiumjs.org/Cesium/Build/Documentation/Transforms.html
// https://github.com/AnalyticalGraphicsInc/cesium/blob/1f330880bc4247d7c0eed9bf54da041b529e786b/Source/Core/Transforms.js#L123


*/



