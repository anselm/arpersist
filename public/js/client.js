

///////////////////////////////////////////////
///
/// Utilities
///
///////////////////////////////////////////////

function gpsPromise() {

    return new Promise((resolve, reject)=>{

		if (!("geolocation" in navigator)) {
			console.log("GPS: not found - faking it 1")
			let gps = { latitude: 0, longitude: 0, altitude: 0 }
			resolve(gps)
		}

		let options = {
		  enableHighAccuracy: true,
		  timeout: 5000,
		  maximumAge: 0
		};

		function success(pos) {
			var crd = pos.coords;
			console.log("GPS: Your current position is:")
			console.log("GPS:  Latitude: "+crd.latitude)
			console.log("GPS: Longitude: "+crd.longitude)
			console.log("GPS:  Altitude: "+crd.altitude)
			console.log("GPS:  Accuracy: "+crd.accuracy + " meters")
			resolve(crd)
		}

		function error(err) {
			console.warn("GPS: ERROR 1 "+err.code+" "+ err.message)
			console.log("GPS: not found - faking it 2")
			let gps = { latitude: 0, longitude: 0, altitude: 0 }
			resolve(gps)
			//reject("failed")
		}

		try {
			console.log("GPS: attempting to get current position once")
			navigator.geolocation.getCurrentPosition(success, error, options);
		} catch(err) {
			console.warn("GPS: ERROR 2 "+err.code+" "+ err.message)
			reject("failed")
		}
	})
}

function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
///
/// ARPersistComponent
///
/// Manages a concept of 'entities' which are networkable collections of art and gps locations
///
////////////////////////////////////////////////////////////////////////////////////////////////

class ARPersistComponent extends XRExampleBase {

	constructor(element,zone,party) {

		// init parent
        super(element, false, true, false, true)

		// zone concept - TODO this may go away or be improved
		this.zone = zone

		// party - this may be improved - used to distinguish players right now but is not non-collidant
		this.party = party

		// tags - default props per entity
		this.tags = "aesthetic"
	}

	msg(msg) {
		if(!this.msgs) this.msgs = []
		console.log(msg)
		let div = document.getElementById("ux_help")
		if(!div) return
		this.msgs.unshift(msg)
		div.innerHTML = this.msgs.slice(0,5).join("<br/>")
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
		let command = this.command
		this.command = 0
		if(!command) return 0
		this.msg("doing command="+command)
		switch(command) {
			case "gps" : await this.entityAddGPS(frame); break
			case "make": await this.entityAddArtHelper(frame); break
			case "move": await this.entityAddPartyHelper(frame); break
			case "save": await this.entityAddMapHelper(frame); break
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

		// examine the string and decide what the content is

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

	//////////////////////////////////////////////////
	// arkit anchor math
	/////////////////////////////////////////////////

	///
	/// Get an anchor
	///

	async mapAnchor(frame,x=0.5,y=0.5) {

		// If no screen space position supplied then return an anchor at the head
x=y=-0.5 
		if(!x && !y) {
			// TODO verify that the anchor that is created ends up with XRCoordinateSystem.TRACKER
			let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
			let anchorUID = frame.addAnchor(headCoordinateSystem,[0,0,0])
			console.log("**** Made an arkit anchor " + anchorUID)
			return anchorUID
		}

		// Otherwise probe for an anchor
		// TODO This is broken why?

		// TODO are these both the same?
		//let anchorOffset = await frame.findAnchor(x,y)
		let anchorOffset = await this.session.hitTest(x,y)
		if(!anchorOffset) {
			return 0
		}

		let anchor = frame.getAnchor(anchorOffset.anchorUID)
		if(!anchor) {
			return 0
		}

		// get a new anchor without the offset
		this.tempMat = new THREE.Matrix4();
		this.tempScale = new THREE.Vector3();
		this.tempPos = new THREE.Vector3();
		this.tempQuaternion = new THREE.Quaternion();
		this.tempMat.fromArray(anchorOffset.getOffsetTransform(anchor.coordinateSystem))
		this.tempMat.decompose(this.tempPos,this.tempQuaternion, this.tempScale); 
		const worldCoordinates = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
		const anchorUID = frame.addAnchor(worldCoordinates, [this.tempPos.x, this.tempPos.y, this.tempPos.z], [this.tempQuaternion.x, this.tempQuaternion.y, this.tempQuaternion.z, this.tempQuaternion.w])

		console.log("**** Got an arkit anchor " + anchorUID)
		console.log("***** Not using " + anchorOffset.anchorUID )
		console.log(anchor)
		console.log(anchorUID)

		// TODO is this ok? does it make sense / save any memory / have any impact?
		// delete the anchor that had the offset
//		frame.removeAnchor(anchor); anchor = 0

		return anchorUID
	}

	///
	/// Generate cartesian coordinates from relative transforms
	/// TODO could preserve rotation also
	///

	toCartesian(et,wt,gpsFixed) {

		// if a gps coordinate is supplied then this is a gps related anchor and it's a good time to save a few properties


		// where is the gps point?
		console.log("toCartesian: we believe the arkit pose for the gps anchor is at: ")
		console.log(wt)

		// where is the feature?
		console.log("toCartesian: point in arkit frame of reference is at : ")
		console.log(et)

		// relative to gps anchor?
		// (subtract rather than transform because as far as concerned is in EUS and do not want any orientation to mar that)
		let ev = { x: et[12]-wt[12], y: et[13]-wt[13], z: et[14]-wt[14] }
		console.log("toCartesian: relative to gps anchor in arkit is at ")
		console.log(ev)

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

		console.log("debug - absolutely in ecef at")
		console.log(cartesian)
		console.log(ev2)

		if(true) {
			// debug
			let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
			let lon = Cesium.Math.toDegrees(carto.longitude);
			let lat = Cesium.Math.toDegrees(carto.latitude);
			this.msg("toCartesian: lon="+lon + " lat="+lat)
		}

		return cartesian
	}

	toLocal(cartesian,inv,wt) {

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

	//////////////////////////////////////////////////////////
	/// entities - a wrapper for a concept of a game object
	//////////////////////////////////////////////////////////

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
		// local update all
		for(let uuid in this.entities) {
			this.entityUpdateOne(frame,this.entities[uuid])
		}
	}

	entityUpdateOne(frame,entity) {

		// TODO may remove this type
		if(entity.kind=="map") return

		// busy poll till a gps and associated anchor show up and then build coordinate systems around it
		if(!this.entityGPS && entity.kind == "gps") {
			this.entityGPS = this.entityUpdateGPSEntity(frame,entity)
		}

		// not a lot to do before a gps anchor shows up
		if(!this.entityGPS) {
			return
		}

		this.entityGPS.transform = this.entityGPS.offset.getOffsetTransform(this.entityGPS.anchor.coordinateSystem)

		// busy poll till grant cartesian coordinates if none yet (these objects should be local and an anchor should eventually show up)
		// TODO this could be done over and over actually even after success... (but don't update the cartesian of the gpsEntity obviously)
		if(!entity.cartesian) {
			this.entityUpdateArt(frame,entity,this.entityGPS.transform)
		}

		// update pose
		entity.pose = this.toLocal(entity.cartesian,this.entityGPS.inverse,this.entityGPS.transform)

		// add art to entities if needed
		if(!entity.node) {
			entity.node = this.createSceneGraphNode(entity.art)
			this.scene.add(entity.node)
		}

		// update entity rendering position (every frame)
		entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)

		// given an anchor it is possible to directly set the node from that
		//	entity.node.matrixAutoUpdate = false
		//	entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchorCoordinateSystem))
		//	entity.node.updateMatrixWorld(true)

		// publish changes?
		if(entity.published == 0) {
			this.entityPublish(entity)
			entity.published = 1
		}
	}

	entityUpdateGPSEntity(frame,entity) {
		// flesh out a few details on the entity and mark it as the shared map gps anchor
		entity.anchor = frame.getAnchor(entity.anchorUID)
		if(!entity.anchor) {
			return 0
		}
		entity.offset = new XRAnchorOffset(entity.anchorUID)
		entity.cartesian = Cesium.Cartesian3.fromDegrees(entity.gps.longitude, entity.gps.latitude, entity.gps.altitude)
		entity.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(entity.cartesian)
		entity.inverse = Cesium.Matrix4.inverseTransformation(entity.fixed, new Cesium.Matrix4())
		entity.published = 0
		this.entityGPS = entity
		this.msg("map relocalized against gps entity")
		return entity
	}

	entityUpdateArt(frame,entity,worldTransform) {
		// this.gpsEntity must exist
		entity.anchor = frame.getAnchor(entity.anchorUID)
		if(!entity.anchor) {
			return 0
		}
		entity.offset = new XRAnchorOffset(entity.anchorUID)
		entity.transform = entity.offset.getOffsetTransform(entity.anchor.coordinateSystem)
		entity.cartesian = this.toCartesian(entity.transform,worldTransform,this.entityGPS.fixed)
		entity.published = 0
		return entity
	}

	///
	/// Every entity needs a uuid - right now that is ALWAYS generated from an anchor - even if entity loses anchor over network
	///

	entityUUID(id) {
		// uuid has to be deterministic yet unique for all client instances so build it out of known parts and hope for best
		return this.zone + "_" + this.party + "_" + id
	}

	///
	/// Make a gps entity from an anchor (is an ordinary entity that has a gps value)
	///
	/// NOTE A plurality of these is allowed for now (later will probably only allow one) - only the first one is used right now
	/// NOTE the anchor should be built implicitly at time of GPS - not 'whenever'
	///

	async entityAddGPS(frame) {
		let gps = await gpsPromise()
		if(!gps) {
			this.msg("entityAddGPS: no gps")
			return 0
		}
		this.msg("entityAddGPS: got gps " + gps.latitude + " " + gps.longitude )
		let anchorUID = await this.mapAnchor(frame,0,0)
		if(!anchorUID) {
			this.msg("entityAddGPS: anchor failed")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(anchorUID),
			  anchorUID: anchorUID,
			       name: "a gps anchor at " + gps.latitude + " " + gps.longitude,
			      descr: "a gps anchor at " + gps.latitude + " " + gps.longitude,
			       kind: "gps",
			        art: "cylinder",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			        gps: gps,
			  published: 1,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	///
	/// Create an entity as per the users request
	///

	async entityAddArt(frame) {
		let anchorUID = await this.mapAnchor(frame)
		if(!anchorUID) {
			this.msg("entityAddArt: anchor failed")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(anchorUID),
			  anchorUID: anchorUID,
			       name: "art",
			      descr: "some user art",
			       kind: "content",
			        art: "box",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  cartesian: 0,
			  published: 1,
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
		let anchorUID = await this.mapAnchor(frame)
		if(!anchorUID) {
			this.msg("entityAddParty: anchor failed")
			return 0
		}
		if(this.entityParty) {
			// TODO - should I throw away the previous anchor?
			this.entityParty.anchorUID = anchorUID
			this.entityParty.cartesian = 0
			this.entityParty.published = 0
			return this.entityParty
		}
		let entity = this.entityParty = {
			       uuid: this.entityUUID(anchorUID),
			  anchorUID: anchorUID,
			       name: this.party,
			      descr: "a representation for a person named " + this.party,
			       kind: "party",
			        art: "cylinder",
			       zone: this.zone,
			       tags: this.tags,
			      party: this.party,
			  cartesian: 0,
			  published: 1,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	async entityAddArtHelper(frame) {
		if(!this.entityGPS) {
			this.msg("save: this engine needs gps before doing other stuff")
			return
		}
		let status = await this.entityAddArt(frame)
		return status
	}

	async entityAddPartyHelper(frame) {
		// goes ahead and force makes a gps anchor if needed
		if(!this.entityGPS) {
			// if no gps entity was added then force add one now
			let entity = await this.entityAddGPS(frame)
			// force promote the entity to the gps entity
			if(entity) {
				this.entityUpdateGPSEntity(frame, entity)
			}
		}
		if(!this.entityGPS) {
			// it is possible that gps failed us - so this can happen
			this.msg("save: this engine needs gps before doing other stuff")
			return
		}
		let status = await this.entityAddParty(frame)
		return status
	}

	async entityAddMapHelper(frame) {
		// goes ahead and force makes a gps anchor if needed
		if(!this.entityGPS) {
			// if no gps entity was added then force add one now
			let entity = await this.entityAddGPS(frame)
			// force promote the entity to the gps entity
			if(entity) {
				this.entityUpdateGPSEntity(frame, entity)
			}
		}
		if(!this.entityGPS) {
			// it is possible that gps failed us - so this can happen
			this.msg("save: this engine needs gps before doing other stuff")
			return
		}

		// save
		let status = await this.mapSave(this.entityGPS)
		return status
	}

	async mapSave(args) {
		// must pass an entityGPS 
		let results = await this.session.getWorldMap()
		if(!results) {
			this.msg("save: this engine does not have a good map from arkit yet")
			return 0
		}
		const data = new FormData()
		// TODO - this kind of mixes concerns badly - if I pick a single anchor to associate the map with then this is not needed
		data.append('blob',        new Blob([results.worldMap], { type: "text/html"} ) )
		data.append('uuid',        "MAP" + args.uuid )
		data.append('anchorUID',   args.anchorUID )
		data.append('name',        args.name)
		data.append('descr',       args.descr)
		data.append('kind',        "map" )
		data.append('art',         args.art )
		data.append('zone',        args.zone )
		data.append('tags',        args.tags )
		data.append('party',       args.party )
		data.append('latitude',    args.gps.latitude )
		data.append('longitide',   args.gps.longitude )
		data.append('altitude',    args.gps.altitude )
		let response = await fetch('/api/map/save', { method: 'POST', body: data })
		let json = await response.json()
		this.msg("mapSave: succeeded")
		return json		
	}

	async  mapLoad(filename) {

		// observe anchors showing up again - this code doesn't have to do any work since update loop will busy poll till it rebinds anchors to maps
		if (!this.listenerSetup) {
			this.listenerSetup = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
				console.log("mapLoad callback - saw an anchor re-appear uid=" + event.detail.uid )
			})
		}

		// fetch map itself - which will eventually resolve the anchor loaded above
		let response = await fetch("uploads/"+filename)
		let data = await response.text()
		let results = await this.session.setWorldMap({worldMap:data})
		this.msg("load: a fresh map file arrived " + filename )
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
			this.msg("load: this engine needs a gps location before loading maps")
			return 0
		}
		this.msg("load: getting all entities near latitude="+gps.latitude+" longitude="+gps.longitude)

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
			this.msg("load: made entity kind="+entity.kind+" uuid="+entity.uuid+" anchor="+entity.anchorUID)
		}
		this.msg("load: loading done - entities in total is " + count )
		return 1
	}

	///
	/// Receive an entity over network - may Create/Revise/Update/Delete an entity
	/// TODO deletion events
	///

	entityReceive(entity) {
		entity.cartesian =  new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z)
		entity.published = 1
		entity.remote = 1
		entity.dirty = 1
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			console.log("entityReceive: saving new remote entity")
			console.log(entity)
		} else {
			// scavenge choice morsels from the network traffic and throw network traffic away
			previous.cartesian = entity.cartesian
			previous.art = entity.art
			previous.tags = entity.tags
			console.log("entityReceive: remote entity found again and updated")
			console.log(entity)
		}
	}

	///
	/// Publish an entity to network
	/// I prefer to publish an extract because there may be other state stored in entity locally that I don't want to publish
	/// TODO when publishing an update there's no point in sending all the fields
	///

	entityPublish(entity) {

		if(!entity.cartesian || entity.published || entity.remote) {
			return
		}

		entity.published = 1

		if(!this.socket) {
			return
		}

		let blob = {
			       uuid: entity.uuid,
			  anchorUID: entity.anchorUID,
			       kind: entity.kind,
			        art: entity.art,
			       zone: entity.zone,
			       tags: entity.tags,
			      party: entity.party,
			  cartesian: entity.cartesian || 0,
			        gps: entity.gps || 0,
			  published: entity.published || 0,
			     remote: entity.remote || 0,
			      dirty: entity.dirty || 0
		}

		this.socket.emit('publish',blob);
	}

	/*
	async flushServer() {

		// flush server
		let response = await fetch("/api/entity/flush",{ method: 'POST', body: this.zone })
		console.log("server state after flush")
		console.log(response)

		this.flushClient()
	}
	*/

}

//////////////////////////////////////////////////////////////////////////////
///
/// UXMapController
///
/// Controls the view for the map page
/// This is a google maps page used in several ways
/// One way it is used is to help fine tine the position of an arkit anchor
///
//////////////////////////////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////////////////////////////
///
/// UXHelper
///
/// Provides general support for page management
/// In an engine like React pages would be implicitly associated with logic
/// In this case everything is baked by hand and flows are explicit.
/// Has specialized logic for this particular app to help manage flow
///
///
//////////////////////////////////////////////////////////////////////////////

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
		let gps = await gpsPromise()

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
			element = document.createElement("<br/>")
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

//////////////////////////////////////////////////////////////////////////////
/// bootstrap
//////////////////////////////////////////////////////////////////////////////

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.ux = new UXHelper("login")
	}, 100)
})

//
// todo
//
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




