
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Wrapper for WebXR-Polyfill that adds geographic support to anchors
/// Given a map and one anchor on that map at a known gps location - provide gps coordinates for other anchors on the same map
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class XRAnchorCartography extends XRExampleBase {

	constructor(args) {
        super(
        	args.domElement,
        	args.createVirtualReality,
        	args.shouldStartPresenting,
        	args.useComputerVision,
        	args.worldSensing,
        	args.alignEUS
        	)
		this.tempMat = new THREE.Matrix4()
		this.tempScale = new THREE.Vector3()
		this.tempPos = new THREE.Vector3()
		this.tempQuaternion = new THREE.Quaternion()
	}

	gpsPromise() {

	    return new Promise((resolve, reject)=>{

			if (!("geolocation" in navigator)) {
				// fake it for now
				let gps = { latitude: 0, longitude: 0, altitude: 0 }
				resolve(gps)
			}

			function success(pos) {
				var crd = pos.coords;
				resolve(crd)
			}

			function error(err) {
				// fake it
				let gps = { latitude: 0, longitude: 0, altitude: 0 }
				resolve(gps)
				//reject(err)
			}

			try {
				let options = {
				  enableHighAccuracy: true,
				  timeout: 5000,
				  maximumAge: 0
				};
				navigator.geolocation.getCurrentPosition(success, error, options);
			} catch(err) {
				// unusual error - just return it
				reject(err)
			}
		})
	}

	async featureAtPose(frame) {
		// TODO does the final anchor that is created end up with XRCoordinateSystem.TRACKER??
		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
		let anchorUID = frame.addAnchor(headCoordinateSystem,[0,0,0])
		return {
			  anchorUID: anchorUID,
			       kind: "local",
			  transform: 0,
		    translation: 0,
			orientation: 0,
			relocalized: false
		}
	}

	async featureAtIntersection(frame,x=0.5,y=0.5) {

		//let anchorOffset = await frame.findAnchor(x,y) // this way is broken and both seem similar - whats what? TODO
		let anchorOffset = await this.session.hitTest(x,y)
		if(!anchorOffset) {
			return 0
		}

		let anchor = frame.getAnchor(anchorOffset.anchorUID)
		if(!anchor) {
			console.error("featureAtIntersection: just had an anchor but no longer? " + anchorUID )
			return 0
		}

		// get a new anchor without the offset
		this.tempMat.fromArray(anchorOffset.getOffsetTransform(anchor.coordinateSystem))
		this.tempMat.decompose(this.tempPos,this.tempQuaternion, this.tempScale);
		const worldCoordinates = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
		const anchorUID = frame.addAnchor(worldCoordinates, [this.tempPos.x, this.tempPos.y, this.tempPos.z], [this.tempQuaternion.x, this.tempQuaternion.y, this.tempQuaternion.z, this.tempQuaternion.w])

		// TODO is it ok to to delete unused anchor? does it make sense / save any memory / have any impact?
		// delete the anchor that had the offset
		// frame.removeAnchor(anchor); anchor = 0
		return {
			  anchorUID: anchorUID,
			       kind: "local",
			  transform: 0,
		    translation: 0,
			orientation: 0,
			relocalized: false
		}
	}

	async featureAtGPS(frame) {
		let gps = await this.gpsPromise()
		if(!gps) {
			return 0
		}
		let feature = await this.featureAtPose(frame)
		feature.gps = gps
		return feature
	}

	featureRelocalize(frame,feature,gpsfeature=0) {
		if(feature.kind == "gps") {
			if(!feature.gps) {
				console.error("featureRelocalize: corrupt feature")
				return
			}
			feature.cartesian = Cesium.Cartesian3.fromDegrees(feature.gps.longitude, feature.gps.latitude, feature.gps.altitude)
			feature.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(feature.cartesian)
			feature.inverse = Cesium.Matrix4.inverseTransformation(feature.fixed, new Cesium.Matrix4())
			feature.anchor = frame.getAnchor(feature.anchorUID)
			if(feature.anchor) {
				// this can change every frame
				feature.offset = new XRAnchorOffset(feature.anchorUID)
				feature.transform = feature.offset.getOffsetTransform(feature.anchor.coordinateSystem)
				// only mark as relocalized after an anchor appears since there's a higher expectation on an initial gpsfeature to have an anchor AND a gps
				feature.pose = this._toLocal(feature.cartesian,feature.inverse,feature.transform) // kind of redundant way to achieve this but...
				feature.relocalized = true
				return
			}
		} else {
			// cannot do much with other features if there is no context
			if(!gpsfeature || !gpsfeature.relocalized) {
				console.error("featureRelocalize: invalid gps feature passed")
				return
			}
			feature.anchor = frame.getAnchor(feature.anchorUID)
			if(feature.anchor) {
				// although some features may have anchors, it's arguable if these should be used or if the system should just use cartesian at some point
				feature.offset = new XRAnchorOffset(feature.anchorUID)
				feature.transform = feature.offset.getOffsetTransform(feature.anchor.coordinateSystem)
				feature.cartesian = this._toCartesian(feature.transform,gpsfeature.transform,gpsfeature.fixed)
				feature.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(feature.cartesian)
				feature.inverse = Cesium.Matrix4.inverseTransformation(feature.fixed, new Cesium.Matrix4())
			}
		}
		// can compute screen pose of any feature (gps or otherwise) that has cartesian coordinates (if there is a local gps+anchor available as a reference)
		if(feature.cartesian && gpsfeature && gpsfeature.relocalized) {
			feature.pose = this._toLocal(feature.cartesian,gpsfeature.inverse,gpsfeature.transform)
			feature.relocalized = true
		}
	}

	///
	/// Generate cartesian coordinates from relative transforms
	/// TODO could preserve rotation also
	///

	_toCartesian(et,wt,gpsFixed) {

		// if a gps coordinate is supplied then this is a gps related anchor and it's a good time to save a few properties

		// where is the gps point?
		//console.log("toCartesian: we believe the arkit pose for the gps anchor is at: ")
		//console.log(wt)

		// where is the feature?
		//console.log("toCartesian: point in arkit frame of reference is at : ")
		//console.log(et)

		// relative to gps anchor?
		// (subtract rather than transform because as far as concerned is in EUS and do not want any orientation to mar that)
		let ev = { x: et[12]-wt[12], y: et[13]-wt[13], z: et[14]-wt[14] }
		//console.log("toCartesian: relative to gps anchor in arkit is at ")
		//console.log(ev)

		//
		// form a relative vector to the gps anchor - in cartesian coordinates - this only works for points "NEAR" the gps anchor
		//
		// https://developer.apple.com/documentation/arkit/arsessionconfiguration/worldalignment/gravityandheading
		// ARKit relative EUS coordinates are "kinda like" polar coordinates with +x to the right, +y towards space, -z towards the north pole
		//
		// ECEF is a cartesian space centered on the earth with +x pointing towards 0,0 long,lat and +y coming out in china, and +z pointing north
		// https://en.wikipedia.org/wiki/ECEF
		//
		// Cesium is default ENU so we have to swap axes (or else order Cesium around a bit more)
		// https://groups.google.com/forum/#!topic/cesium-dev/NSen9Z04NEo
		//

		let ev2 = new Cesium.Cartesian3(
			ev.x,							// in ARKit, ECEF and Cesium smaller X values are to the east.
			-ev.z,							// in ARKit smaller Z values are to the north... and in Cesium by default vertices are East, North, Up
			ev.y 							// in ARKit larger Y values point into space... and in Cesium "up" is the third field by default
			)

		// Get a matrix that describes the orientation and displacement of a place on earth and multiply the relative cartesian ray by it
		let cartesian = Cesium.Matrix4.multiplyByPoint( gpsFixed, ev2, new Cesium.Cartesian3() )

		//console.log("debug - absolutely in ecef at")
		//console.log(cartesian)
		//console.log(ev2)

		if(false) {
			// debug
			let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
			let lon = Cesium.Math.toDegrees(carto.longitude);
			let lat = Cesium.Math.toDegrees(carto.latitude);
			console.log("toCartesian: lon="+lon + " lat="+lat)
		}

		return cartesian
	}

	_toLocal(cartesian,inv,wt) {

		// TODO full orientation

		// transform from ECEF to be relative to gps anchor
		let v = Cesium.Matrix4.multiplyByPoint(inv, cartesian, new Cesium.Cartesian3());

		// although is now in arkit relative space, there is still a displacement to correct relative to the actual arkit origin, also fix axes
		v = {
			x:    v.x + wt[12],
			y:    v.z + wt[13],
			z:  -(v.y + wt[14]),
		}

		return v
	}

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// An event bus to help decouple components
/// Supports an idea of event callbacks or just shared variable storage
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
class EventBus {
	constructor(){
		this.messages = {} // holds labels and associated arrays of messages pending
		this.listeners = {} // holds labels and associated arrays of unique listeners (which will all be triggered in order if matching a message label)
	}
	listen(label,listener) {
		let listeners = this.listeners[label]
		if(!listeners) {
			listeners = this.listeners[label] = []
		}
		for(let i = 0; i < listeners.length;i++) {
			if(listener === listener[i]) return
		}
		listeners.push(listener)
	}
	unlisten(label,listener) {
		let listeners = this.listeners[label]
		if(!listeners) {
			listeners = this.listeners[label] = []
		}
		for(let i = 0; i < listeners.length;i++) {
			if(listener === listener[i]) listeners.splice(i,1) // TODO may be better to return a unique id on listen() instead of === test here
		}
	}
	set(label,...args) {
		// call listeners if any
		let listeners = this.listeners[label]
		if(listeners) {
			listeners.map((listener)=>{
				listener(args)
			})
		}
		// save value also - always as an array of values
		this.messages[label] = args
	}
	push(label,...args) {
		let m = this.messages[label]
		if(!m) m = this.messages[label] = []
		m.concat(args)
		return m
	}
	get(label,flush=true){
		let args = this.messages[label] || []
		if(flush) this.messages[label]=[]
		return args
	}
	log(message) {
		push("log","log",message)
	}
	err(message) {
		push("log","err",message)
	}
}
const eventbus = window.eventbus = new EventBus();
Object.freeze(eventbus);
*/

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// ARPersistComponent
///
/// Manages a concept of 'entities' which are networkable collections of art and gps locations
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class ARPersistComponent extends XRAnchorCartography {

	constructor(element,zone,party) {

        super({
            domElement:element,
        	createVirtualReality:false,
        	shouldStartPresenting:true,
        	useComputerVision:false,
        	worldSensing:true,
        	alignEUS:true
	        })

		// zone concept - TODO this may go away or be improved
		this.zone = zone

		// party - this may be improved - used to distinguish players right now but is not non-collidant
		this.party = party

		// tags - default props per entity
		this.tags = "aesthetic"
	}

	///////////////////////////////////////////////
	// support for externally driven command messages
	///////////////////////////////////////////////

	action(command,args) {
		// some commands can be done now... of which none exist at the moment in the current app design
		// some must be deferred
		this.command = command
	}

	async actionResolve(frame) {
		// resolve frame related chores synchronously with access to 'frame'
		// TODO I'm not happy with this approach - see EventBus above for something more flexible
		let command = this.command
		this.command = 0
		if(!command) return 0
		console.log("doing command="+command)
		switch(command) {
			case "gps": await this.entityAddGPS(frame); break
			case "make": await this.entityAddArt(frame); break
			case "move": await this.entityAddParty(frame); break
			case "save": await this.mapSave(frame); break
			default: break
		}
		return 1
	}

	///////////////////////////////////////////////
	// scene geometry and update callback helpers
	///////////////////////////////////////////////

	initializeScene() {
		this.listenerSetup = false

		// add some light
		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)

		// attach something to 0,0,0 (although 0,0,0 doesn't mean a lot since arkit can update anchor positions)
        this.scene.add( this.AxesHelper( 0.2 ) );
	}

	///
	/// Called once per frame by base class, before render, to give the app a chance to update this.scene
	///

	async updateScene(frame) {
		await this.actionResolve(frame)
		this.entityUpdateAll(frame)
	}

	AxesHelper( size ) {
		size = size || 1;
			var vertices = [
			0, 0, 0,	size, 0, 0,
			0, 0, 0,	0, size, 0,
			0, 0, 0,	0, 0, size
		];
			var colors = [
			1, 0, 0,	1, 0.6, 0,
			0, 1, 0,	0.6, 1, 0,
			0, 0, 1,	0, 0.6, 1
		];
		var geometry = new THREE.BufferGeometry();
		geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
		var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
		return new THREE.LineSegments(geometry, material);
	}

	createSceneGraphNode(args = 0) {
		let geometry = 0

		// test

		if(args.startsWith("duck")) {
			let group = new THREE.Group()
			let path = "/raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
			loadGLTF(path).then(gltf => {
				group.add(gltf.scene)
			}).catch((...params) =>{
				console.error('could not load gltf', ...params)
			})
			return group
		}

		// examine the string and decide what the content is - TODO this needs a real proxy such as moz hubs

		if(args.startsWith("http")) {
			let group = new THREE.Group()
			let path = args // "/raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
			loadGLTF(path).then(gltf => {
				group.add(gltf.scene)
			}).catch((...params) =>{
				console.error('could not load gltf', ...params)
			})
			return group
		}

		switch(args) {
			default: geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
			case "cylinder": geometry = new THREE.CylinderGeometry( 0.1, 0.1, 0.1, 32 ); break;
			case "sphere":   geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); break;
			case "box":      geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
		}
		let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
		let mesh = new THREE.Mesh(geometry, material)
		return mesh
	}

	//////////////////////////////////////////////////////////
	/// entities - a wrapper for a concept of a game object
	//////////////////////////////////////////////////////////

	entityUUID(id) {
		// uuid has to be deterministic yet unique for all client instances so build it out of known parts and hope for best
		return this.zone + "_" + this.party + "_" + id
	}

	entitySystemReset() {
		// local flush - not network
		this.entitySelected = 0
		if(this.entities) {
			for(let uuid in this.entities) {
				let entity = this.entities[uuid]
				if(entity.node) {
					this.scene.remove(entity.node)
					entity.node = 0
				}
				// TODO delete anchors?
			}
		}
		this.entities = {}
	}

	entityQuery(args) {
		// local query only - not network
		let results = []
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			if(args.kind && entity.kind == args.kind) results.push(entity)
			// TODO add gps filtering
		}
		return results
	}

	entityUpdateAll(frame) {
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			this.entityUpdateOne(frame,entity)
			this.entityDebugging(entity)
		}
	}

	entityUpdateOne(frame,entity) {

		// ignore maps for now
		if(entity.kind=="map") return

		// ignore things that are not gps until a entityGPS exists
		if(entity.kind != "gps" && !this.entityGPS) {
			return
		}

		// attempt to relocalize
		this.featureRelocalize(frame,entity,this.entityGPS)

		// attempt to set an entityGPS
		if(entity.kind == "gps" && entity.relocalized && !this.entityGPS) {
			this.entityGPS = entity
		}

		// update art
		this.entityArt(entity)

		// publish changes?
		if(!entity.published) {
			this.entityPublish(entity)
			entity.published = 1
		}
	}

	entityArt(entity) {

		if(!entity.pose) {
			//console.error("entityArt: no pose " + entity.uuid)
			return
		}

		// add art to entities if needed
		if(!entity.node) {
			entity.node = this.createSceneGraphNode(entity.art)
			this.scene.add(entity.node)
		}

		// given an anchor it is possible to directly set the node from that
		//	entity.node.matrixAutoUpdate = false
		//	entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchorCoordinateSystem))
		//	entity.node.updateMatrixWorld(true)

		// update entity rendering position (every frame)
		// TODO deal with orientation
		entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)		
	}

	///
	/// Make a gps entity - at the moment multiple of these are allowed - note that this.entityGPS is not set here (since it could arrive over network)
	///

	async entityAddGPS(frame) {
		let feature = await this.featureAtGPS(frame)
		if(!feature || !feature.gps) {
			console.error("UX entityAddGPS: could not make gps anchor!")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(feature.anchorUID),
			     anchor: feature.anchor,
			  anchorUID: feature.anchorUID,
			        gps: feature.gps || 0,
			  transform: feature.transform || 0,
		    translation: feature.translation || 0,
			orientation: feature.orientation || 0,
			relocalized: feature.relocalized || 0,
			  cartesian: feature.cartesian || 0,
			       name: "a gps anchor at " + feature.gps.latitude + " " + feature.gps.longitude,
			      descr: "a gps anchor at " + feature.gps.latitude + " " + feature.gps.longitude,
			       kind: "gps",
			        art: "cylinder",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  published: 0,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	///
	/// Create an entity as per the users request - it is ok to make these before gps anchors show up
	///

	async entityAddArt(frame) {

		let feature = await this.featureAtIntersection(frame,0.5,0.5)
		if(!feature) {
			console.error("UX entityAddArt: anchor failed")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(feature.anchorUID),
			  anchorUID: feature.anchorUID,
			     anchor: feature.anchor,
			        gps: feature.gps || 0,
			  transform: feature.transform || 0,
		    translation: feature.translation || 0,
			orientation: feature.orientation || 0,
			relocalized: feature.relocalized || 0,
			  cartesian: feature.cartesian || 0,
			       name: "art",
			      descr: "some user art",
			       kind: "content",
			        art: "box",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  published: 0,
			     remote: 0,
			      dirty: 1
		}
		this.entitySelected = entity
		this.entities[entity.uuid] = entity
		return entity
	}

	///
	/// Create or update a partys position
	///

	async entityAddParty(frame) {

		let feature = await this.featureAtPose(frame)
		if(!feature) {
			console.error("entityAddParty: anchor failed")
			return 0
		}
		if(this.entityParty) {
			// TODO - should I throw away the previous anchor?
			this.entityParty.anchorUID = feature.anchorUID
			this.entityParty.cartesian = 0
			this.entityParty.published = 0
			this.entityParty.dirty = 0
			return this.entityParty
		}
		let entity = this.entityParty = {
			       uuid: this.entityUUID(feature.anchorUID),
			  anchorUID: feature.anchorUID,
			        gps: feature.gps || 0,
			  transform: feature.transform || 0,
		    translation: feature.translation || 0,
			orientation: feature.orientation || 0,
			relocalized: feature.relocalized || 0,
			  cartesian: feature.cartesian || 0,
			       name: this.party,
			      descr: "a representation for a person named " + this.party,
			       kind: "party",
			        art: "cylinder",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  published: 0,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	async mapSave(frame) {

		// a slight hack - make and fully prep a gps anchor if one is not made yet

		let entity = this.entityGPS
		if(!entity) {
			// if no gps entity was added then force add one now
			entity = await this.entityAddGPS(frame)
			if(!entity) {
				console.error("UX map save - failed to add gps entity - no gps yet?")
				return
			}
			// force promote the entity to the gps entity
			this.featureRelocalize(frame, entity)
			if(!entity.relocalized) {
				console.error("UX map save - failed to relocalize entity - which is odd")
				return
			}
			this.entityGPS = entity
		}

		// for now the entity is also written into the map - it's arguable if this is needed - will likely remove since it's mostly just extraneous TODO
		// the idea was that I could search for maps, but if I assume each map has one and only one gps anchor entity then I know what maps exist based on entities whose kind is == gps

		console.log("UX saving map")

		let results = await this.session.getWorldMap()
		if(!results) {
			console.error("UX save: this engine does not have a good map from arkit yet")
			return 0
		}
		const data = new FormData()
		// TODO - this kind of mixes concerns badly - if I pick a single anchor to associate the map with then this is not needed
		data.append('blob',        new Blob([results.worldMap], { type: "text/html"} ) )
		data.append('uuid',        "MAP" + entity.uuid )
		data.append('anchorUID',   entity.anchorUID )
		data.append('name',        entity.name)
		data.append('descr',       entity.descr)
		data.append('kind',        "map" )
		data.append('art',         entity.art )
		data.append('zone',        entity.zone )
		data.append('tags',        entity.tags )
		data.append('party',       entity.party )
		data.append('relocalized', 0)
		data.append('latitude',    entity.gps.latitude )
		data.append('longitide',   entity.gps.longitude )
		data.append('altitude',    entity.gps.altitude )
		let response = await fetch('/api/map/save', { method: 'POST', body: data })
		let json = await response.json()
		console.log("UX mapSave: succeeded")
		return json		
	}

	async  mapLoad(filename) {

		// observe anchors showing up again - this code doesn't have to do any work since update loop will busy poll till it rebinds anchors to maps
		if (!this.listenerSetup) {
			this.listenerSetup = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
				console.log("UX mapLoad callback - saw an anchor re-appear uid=" + event.detail.uid )
			})
		}

		// fetch map itself - which will eventually resolve the anchor loaded above
		let response = await fetch("uploads/"+filename)
		let data = await response.text()
		let results = await this.session.setWorldMap({worldMap:data})
		console.log("UX load: a fresh map file arrived " + filename )
		console.log(results)
	}


	//////////////////////////////////////////////////////////////////////////////////
	// network
	//////////////////////////////////////////////////////////////////////////////////

	async entityNetworkRestart(args) {
		// flush local entities
		this.entitySystemReset()
		if(!this.socket) {
			// TODO somehow tell network where we are!!! - it needs some way to filter traffic to us intelligently
			// start network if needed
			this.socket = io()
			this.socket.on('publish', this.entityReceive.bind(this) )
		}
		// reload or load everything (typically AFTER the network is started to avoid missing chatter)
		await this.entityLoadAll(args.gps)
	}

	///
	/// Get everything near player gps from server (typically AFTER starting to listen to ongoing chatter due to possibility of a gap)
	///

	async entityLoadAll(gps) {
		// load all the entities from the server in one go - and rebinding/gluing state back together will happen later on in update()
		if(!gps) {
			console.error("UX load: this engine needs a gps location before loading maps")
			return 0
		}
		console.log("UX load: getting all entities near latitude="+gps.latitude+" longitude="+gps.longitude)

		let response = await fetch("/api/entity/query",{ method: 'POST', body: this.zone })
		let json = await response.json()

		let count = 0
		for(let uuid in json) {
			count = count + 1
			let entity = json[uuid]
			this.entities[entity.uuid]=entity
			entity.published=1
			entity.remote=1
			entity.dirty=1
			entity.relocalized=0
			console.log("UX load: made entity kind="+entity.kind+" uuid="+entity.uuid+" anchor="+entity.anchorUID)
		}
		console.log("UX load: loading done - entities in total is " + count )
		return 1
	}

	///
	/// Receive an entity over network - may Create/Revise/Update/Delete an entity
	/// TODO deletion events
	///

	entityReceive(entity) {
		// TODO rebuild trans/rot
		entity.cartesian = entity.cartesian ? new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z) : 0
		entity.published = 1
		entity.remote = 1
		entity.dirty = 1
		entity.relocalized = 0
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			console.log("UX entityReceive: saving new remote entity")
			console.log(entity)
		} else {
			// scavenge choice morsels from the network traffic and throw network traffic away
			previous.cartesian = entity.cartesian
			previous.art = entity.art
			previous.tags = entity.tags
			console.log("UX entityReceive: remote entity found again and updated")
			console.log(entity)
		}
	}

	///
	/// Publish an entity to network
	/// I prefer to publish an extract because there may be other state stored in entity locally that I don't want to publish
	/// TODO when publishing an update there's no point in sending all the fields
	///

	entityPublish(entity) {

		if(!entity.cartesian) {
			console.warning("publish: entity has no cartesian " + entity.uuid )
			return
		}

		entity.published = 1

		if(!this.socket) {
			return
		}

		let blob = {
			       uuid: entity.uuid,
			  anchorUID: entity.anchorUID,
			        gps: entity.gps || 0,
			  transform: entity.transform || 0,
		    translation: entity.translation || 0,
			orientation: entity.orientation || 0,
			relocalized: entity.relocalized || 0,
			  cartesian: entity.cartesian || 0,
			       name: entity.name,
			      descr: entity.descr,
			       kind: entity.kind,
			        art: entity.art,
			       zone: entity.zone,
			       tags: entity.tags,
			      party: entity.party,
			  published: entity.published || 0,
			     remote: entity.remote || 0,
			      dirty: entity.dirty || 0
		}

		this.socket.emit('publish',blob);
	}

	/* TODO - I need some kind of admin flush mode
	async flushServer() {

		// flush server
		let response = await fetch("/api/entity/flush",{ method: 'POST', body: this.zone })
		console.log("server state after flush")
		console.log(response)

		this.flushClient()
	}
	*/

	entityDebugging(entity) {
		if(entity.debugged) return
		if(!entity.pose) return
		entity.debugged = 1
		console.log("UX *********************** entity status " + entity.anchorUID + " relocalized="+entity.relocalized)
		if(entity.pose) console.log("UX entity=" + entity.anchorUID + " is at x=" + entity.pose.x + " y="+entity.pose.y+" z="+entity.pose.z)
		if(entity.gps) console.log("UX entity=" + entity.anchorUID + " latitude="+entity.gps.latitude+" longitude="+entity.gps.longitude+" accuracy="+entity.gps.accuracy)
		if(entity.cartesian) console.log("UX entity cartesian x=" + entity.cartesian.x + " y=" + entity.cartesian.y + " z="+entity.cartesian.z)
		console.log(entity)
	}

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// UXMapController
///
/// Controls the view for the map page
/// This is a google maps page used in several ways
/// One way it is used is to help fine tine the position of an arkit anchor
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

class UXMapController {

	constructor() {
		this.map = 0
		this.infoWindow = 0
		this.markerCenter = 0
		this.mapInit()
	}

	mapMarker(pos) {
		let c = this.map.getCenter()
		if(!this.markerCenter) {
			this.markerCenter = new google.maps.Marker({position: pos, map: this.map})
		} else {
			this.markerCenter.setPosition( pos )
		}
	}

	mapError(message, infoWindow, pos) {
		infoWindow.setPosition(pos)
		infoWindow.setContent(message)
		infoWindow.open(this.map)
	}

	mapInit() {

		let map = this.map = new google.maps.Map(document.getElementById('map'), {
			center: {lat: 45.397, lng: -120.644},
			zoom: 13,
			mapTypeId: 'satellite'
		})

		//### Add a button on Google Maps ...
		var home = document.createElement('button');
		home.className = "uxbutton"
		home.innerHTML = "back"
		home.onclick = function(e) { window.ux.pop() }
		map.controls[google.maps.ControlPosition.LEFT_TOP].push(home);

		let infoWindow = this.infoWindow = new google.maps.InfoWindow

		map.addListener('center_changed', (e) => {
			this.mapMarker(this.map.getCenter())
		})

		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition((position) => {
				let pos = { lat: position.coords.latitude, lng: position.coords.longitude }
				this.map.setCenter(pos)
				this.mapMarker(pos)
			}, function() {
				mapError('Error: The Geolocation service failed.', infoWindow, map.getCenter())
			})
		} else {
			mapError('Error: Your browser does not support geolocation.', infoWindow, map.getCenter())
		}
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// UXHelper
///
/// Provides general support for page management
/// In an engine like React pages would be implicitly associated with logic
/// In this case everything is baked by hand and flows are explicit.
/// Has specialized logic for this particular app to help manage flow
///
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class UXHelper {

	constructor(name) {
		this.zone = "azurevidian"
		this.party = "King Tut"
		this.push(name)

		window.onpopstate = (e) => {
			if(!e || !e.state) {
				console.error("popstate: bad input for popstate; or external push state?")
				console.log(e)
				return
			}
			console.log("popstate: user browser hit back button")
			console.log("popstate: location: " + document.location + ", state: " + JSON.stringify(event.state));
			this.show(e.state.name)
		}

		// start ar app in general in background for now
		if(!window.arapp) {
			let target = document.getElementById('main_arview_target')
			console.log(target)
			this.arapp = window.arapp = new ARPersistComponent(target,this.zone,this.party)
		}

	}

	push(name) {
		history.pushState({name:name},name,"#" + name );
		this.show(name)
	}

	pop() {
		console.log("some code has a back event")
		history.back()
	}

	hide(name) {
		if(!name) return
		document.getElementById(name).style.display = "none"
	}

	show(name) {
		if(this.current == name ) {
			return
		}
		this.hide(this.current)
		this.current = name
		let e = document.getElementById(name)
		e.style.display = "block"
	}

	//////////////////////////////////////////////////////////////////////////////////////////////
	// helpers for various control blocks - in some nicer framework like react these would be bound to the layout
	//////////////////////////////////////////////////////////////////////////////////////////////

	login(party) {
		this.party = party
		this.pick()
	}

	async pick() {

		// show picker page
		this.push("pick")


		// get a gps hopefully
		let gps = await window.arapp.gpsPromise()

		console.log("picker gps results")
		console.log(gps)
		if(!gps) {
			alert("Hmm no gps error")
			return 0
		}

		// reset the entity system (or set it up the first time)
		window.arapp.entitySystemReset()

		// allow the app to start listening for changes near an area (or restart listening)
		await window.arapp.entityNetworkRestart({kind:0,zone:this.zone,gps:gps})

		// are there any maps here?
		let results = window.arapp.entityQuery({kind:"map",gps:gps})

		// flush
		let dynamic_list = document.getElementById("picker_dynamic_list")
		while (dynamic_list.firstChild) dynamic_list.removeChild(dynamic_list.firstChild);

		// say "a fresh map"
		{
			let element = document.createElement("button")
			element.innerHTML = "a fresh map"
			element.onclick = (e) => {
				e.preventDefault()
				this.main()
				return 0
			}
			dynamic_list.appendChild(element)
		}

		// say other cases - could use a slider etc TODO
		for(let i = 0; i < results.length; i++) {
			let entity = results[i]
			let element = document.createElement("button")
			element.innerHTML = entity.anchorUID
			dynamic_list.appendChild(element)
			element.onclick = (e) => {
				let filename = e.srcElement.innerText
				window.arapp.mapLoad(filename)
				this.main()
				return 0
			}
			element = document.createElement("br")
			dynamic_list.appendChild(element)
		}

	}

	main() {

		// take this opportunity to hide 'save map' if your build does not have it
		if(window.arapp && (!window.arapp.session || !window.arapp.session.getWorldMap))
		{
			document.getElementById("page_main_save").style.display = "none"
		}

		// go to the main page
		this.push("main")
		return 0
	}

	map() {
		this.push("map")
		if(!this.uxmap) {
			this.uxmap = new UXMapController("map")
		}
		return 0
	}

	delete() {
		// TBD
		return 0
	}

	edit() {
		this.push("edit")
		let entity = this.arapp.entitySelected
		if(entity) {
			let elem = document.getElementById("edit_art")
			elem.value = entity.art
			elem = document.getElementById("edit_uuid")
			elem.innerHTML = entity.uuid

			// these are the tags - set all the checkboxes off - TODO could generate the entire checkbox system programmatically later
			let tags = "upright eyelevel billboard wall floor persist public priority"
			tags.split(" ").map(tag => {
				let e = document.getElementById("edit_"+tag)
				if(!e)return // weird
				e.checked = false				
				console.log("resettting " + tag)
			})

			// bust out the tags from entity and set those to true
			entity.tags.split(" ").map(tag => {
				let e = document.getElementById("edit_"+tag)
				if(!e)return // weird
				e.checked = true
				console.log("upsettting " + tag)
			})

		}
		return 0
	}

	editdone() {

		let entity = this.arapp.entitySelected
		if(entity) {

			entity.published = 0
			entity.dirty = 1

			// set art and force reload art
			// TODO sanitize
			entity.art = document.getElementById("edit_art").value
			if(entity.node) {
				this.arapp.scene.remove(entity.node)
				entity.node = 0;
			}
			console.log("entity has new art = " + entity.art )

			// set tags
			let buildset = []
			let tags = "upright eyelevel billboard wall floor persist public priority"
			tags.split(" ").map(tag => {
				let e = document.getElementById("edit_"+tag)
				if(!e)return // weird
				if(!e.checked) return
				buildset.push(tag)
			})
			console.log("entity tags set to " + buildset + " on " + entity.uuid )
			entity.tags = buildset.join(" ")
		}

		this.main() // TODO I should be able to pop... study
		return 0
	}

}

///////////////////////////////////////////////
///
/// A zero weight logger that stays out of the way - kind of hack
///
///////////////////////////////////////////////

/*
function uxlog(...args) {
	let scope = window.myglobalogger
	if(!scope) {
		scope = window.mygloballogger = {}
		window.mygloballogger.msgs = []
		window.mygloballogger.target = document.getElementById("ux_help")
	}
	if(!scope.target) return
	let blob = args.join(' ')
	scope.mygloballogger.msgs.unshift(blob)
	scope.target.innerHTML = scope.mygloballogger.msgs.slice(0,5).join("<br/>")
}

let previous_console = window.console
window.console = {
	log: function(...args) {
		//previous_console.log(args[0])
		//if(args.length > 0 && args[0].startsWith("UX")) {
			uxlog(args)
		//}
		previous_console.log(args)
	},
	warn: function(...args) {
		//if(args.length > 0 && args[0].startsWith("UX")) {
		//	uxlog(args)
		//}
		previous_console.warn(args)
	},
	error: function(...args) {
		//if(args.length > 0 && args[0].startsWith("UX")) {
		//	uxlog(args)
		//}
		previous_console.error(args)
	}
}
*/

//////////////////////////////////////////////////////////////////////////////
/// bootstrap
//////////////////////////////////////////////////////////////////////////////

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.ux = new UXHelper("login")
	}, 100)
})

//
// bugs
//
//  - validate that math is correct; i see recoveries that move things around
//  - i notice glitch is not saving maps - why

//	- i notice i get a lot of other maps and anchors that i am not actually that interested in... debate the wisdom of this or how to prune better...
//
///	- edit page to write
//		[done] populate based on current entity
//		[done] save changes
//		[done] mark as dirty and refetch art
//		- wire up map widget
//		- add a thing picker
//		- put a halo around current picked thing
//		- maybe support some built in primitives
//
//  - glitch support
//		- sqlite
//		- flush
//		- area constraints
//
// - prettier
//		- show a map of everything
//		- a globe or world map view or something
//




