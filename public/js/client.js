


//////////////////////////////////////////////////////////////////////////////
// AR View, peristance and networking
//////////////////////////////////////////////////////////////////////////////

class ARPersistComponent extends XRExampleBase {

	constructor(element,zone,participant) {

		// init parent
        super(element, false, true, false, true)

		// zone concept - this may go away or be improved
		this.zone = zone

		// participant - this may be improved - used to distinguish players right now but is not non-collidant
		this.participant = participant
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
	// scene geometry and update callback
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

	updateScene(frame) {
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
		switch(args) {
			default: geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
			case "cylinder": geometry = new THREE.CylinderGeometry( 0.1, 0.1, 0.1, 32 ); break;
			case "sphere":   geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); break;
			case "box":      geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;
		}
		let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
		let mesh = new THREE.Mesh(geometry, material)
		let group = new THREE.Group()
		group.add(mesh)
		return group
	}

	//////////////////////////////////////////////////
	// utils
	/////////////////////////////////////////////////

	async saveMap(args) {
		let results = await this.session.getWorldMap()
		if(!results) {
			this.msg("save: this engine does not have a good map from arkit yet")
			return 0
		}
		const data = new FormData()
		data.append('blob',        new Blob([results.worldMap], { type: "text/html"} ) )
		data.append('anchorUID',   args.anchorUID )
		data.append('name',        args.name)
		data.append('descr',       args.descr)
		data.append('kind',        "map" )
		data.append('art',         args.art )
		data.append('zone',        args.zone )
		data.append('participant', args.participant )
		data.append('latitude',    args.gps.latitude )
		data.append('longitide',   args.gps.longitude )
		data.append('altitude',    args.gps.altitude )
		let response = await fetch('/api/map/save', { method: 'POST', body: data })
		let json = await response.json()
		this.msg("mapSave: succeeded")
		return json		
	}

	async loadMap(filename) {

		// observe anchors showing up again
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
	}

	///
	/// Get an anchor
	///

	async mapAnchor(frame,x=0.5,y=0.5) {

		// If no screen space position supplied then return an anchor at the head
x=y=0
		if(!x && !y) {
			// TODO verify that the anchor that is created ends up with XRCoordinateSystem.TRACKER
			let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
			let anchorUID = frame.addAnchor(headCoordinateSystem,[0,0,0])
			return anchorUID
		}

		// Otherwise probe for an anchor

		// TODO are these both the same?
		let anchorOffset = await frame.findAnchor(x,y)

		//let anchorOffset = await this.session.hitTest(x,y)
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

		// TODO is this ok? does it make sense / save any memory / have any impact?
		// delete the anchor that had the offset
		frame.removeAnchor(anchor); anchor = 0

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

	async entityListen(args) {
		this.entityFlush()
		await this.entityLoad(args.gps)
		this.entityNetwork(args.gps)
	}

	entityQuery(args) {
		let results = []
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			if(args.kind && entity.kind == args.kind) results.push(entity)
			// TODO add gps filtering
		}
		return results
	}

	entityFlush() {
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

	async entityMapSave() {
		// actually the entities are already 'saved' - instead save the map using the gps anchors anchorUID
		if(!this.entityGPS || !this.entityGPS.cartesian || !this.entityGPS.gps) {
			this.msg("save: this engine needs a gps marker before saving maps")
			return 0
		}
		let status = await this.saveMap(this.entityGPS)
		return status
	}

	async entityLoad(gps) {
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

	entityNetwork(gps) {
		// TODO somehow tell network where we are!!!
		this.socket = io()
		this.socket.on('publish', this.entityReceive.bind(this) )
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
			// TODO may wish to scavenge more properties from the inbound traffic
			// TODO may wish to mark as dirty?
			previous.cartesian = entity.cartesian
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
			participant: entity.participant,
			  cartesian: entity.cartesian || 0,
			        gps: entity.gps || 0,
			  published: entity.published || 0,
			     remote: entity.remote || 0,
			      dirty: entity.dirty || 0
		}

		this.socket.emit('publish',blob);
	}

	entityUpdateAll(frame) {

		// resolve frame related chores synchronously with access to 'frame'
		let command = this.command
		this.command = 0
		if(command)	this.msg("updateScene: command="+command)
		switch(command) {
			case "ux_save": this.entityMapSave(); break
			//case "ux_load": this.entityLoad(); break
			//case "ux_wipe": //this.flushServer(); break
			case  "ux_gps": this.entityAddGPS(frame); break
			case "ux_make": this.entityAddArt(frame); break
			case "ux_self": this.entityAddParticipant(frame); break
			default: break
		}

		for(let uuid in this.entities) {
			this.entityUpdate(frame,this.entities[uuid])
		}
	}

	entityUpdate(frame,entity) {

		// busy poll till a gps and associated anchor show up and then build coordinate systems around it
		if(!this.entityGPS && entity.kind == "gps") {
			entity.anchor = frame.getAnchor(entity.anchorUID)
			if(!entity.anchor) {
				return
			}
			entity.offset = new XRAnchorOffset(entity.anchorUID)
			entity.cartesian = Cesium.Cartesian3.fromDegrees(entity.gps.longitude, entity.gps.latitude, entity.gps.altitude)
			entity.fixed = Cesium.Transforms.eastNorthUpToFixedFrame(entity.cartesian)
			entity.inverse = Cesium.Matrix4.inverseTransformation(entity.fixed, new Cesium.Matrix4())
			entity.published = 0
			this.entityGPS = entity
			this.msg("map relocalized")
		}

		// not a lot to do before a gps anchor shows up
		if(!this.entityGPS) {
			return
		}

		this.entityGPS.transform = this.entityGPS.offset.getOffsetTransform(this.entityGPS.anchor.coordinateSystem)

		// busy poll till grant cartesian coordinates if none yet (these objects should be local and an anchor should eventually show up)
		if(!entity.cartesian) {
			entity.anchor = frame.getAnchor(entity.anchorUID)
			if(!entity.anchor) {
				return
			}
			entity.offset = new XRAnchorOffset(entity.anchorUID)
			entity.transform = entity.offset.getOffsetTransform(entity.anchor.coordinateSystem)
			entity.cartesian = this.toCartesian(entity.transform,this.entityGPS.transform,this.entityGPS.fixed)
			entity.published = 0
		}

		// update pose
		entity.pose = this.toLocal(entity.cartesian,this.entityGPS.inverse,this.entityGPS.transform)

		// add art to entities if needed
		if(!entity.node) {
			entity.node = this.createSceneGraphNode(entity.art)
			this.scene.add(entity.node)
		}

		// update entity rendering position
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

	/*
	async flushServer() {

		// flush server
		let response = await fetch("/api/entity/flush",{ method: 'POST', body: this.zone })
		console.log("server state after flush")
		console.log(response)

		this.flushClient()
	}
	*/

	///
	/// Make a gps entity from an anchor (is an ordinary entity that has a gps value)
	///
	/// NOTE A plurality of these is allowed for now (later will probably only allow one) - only the first one is used right now
	/// NOTE the anchor should be built implicitly at time of GPS - not 'whenever'
	///

	async entityAddGPS(frame) {
		let gps = this.gpsGetLatest();
		if(!gps) {
			this.msg("entityAddGSP: no gps")
			return 0
		}
		let anchorUID = await this.mapAnchor(frame,0,0)
		if(!anchorUID) {
			this.msg("entityAddGPS: anchor failed")
			return 0
		}
		let entity = {
			       uuid: this.entityUUID(anchorUID),
			  anchorUID: anchorUID,
			       name: "gps anchor",
			      descr: "a gps anchor at " + gps.latitude + " " + gps.longitude,
			       kind: "gps",
			        art: "cylinder",
			       zone: this.zone,
			participant: this.participant,
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
			participant: this.participant,
			  cartesian: 0,
			  published: 1,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	///
	/// Create or update a participants position
	///

	async entityAddParticipant(frame) {
		let anchorUID = await this.mapAnchor(frame)
		if(!anchorUID) {
			this.msg("entityAddArt: anchor failed")
			return 0
		}
		if(this.entityParticipant) {
			// TODO - should I throw away the previous anchor?
			this.entityParticipant.anchorUID = anchorUID
			this.entityParticipant.cartesian = 0
			this.entityParticipant.published = 0
			return this.entityParticipant
		}
		let entity = this.entityParticipant = {
			       uuid: this.entityUUID(anchorUID),
			  anchorUID: anchorUID,
			       name: this.participant,
			      descr: "a representation for a person named " + this.participant,
			       kind: "participant",
			        art: "cylinder",
			       zone: this.zone,
			participant: this.participant,
			  cartesian: 0,
			  published: 1,
			     remote: 0,
			      dirty: 1
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	entityUUID(id) {
		// uuid has to be deterministic yet unique for all client instances so build it out of known parts and hope for best
		return this.zone + "_" + this.participant + "_" + id
	}

}

//////////////////////////////////////////////////////////////////////////////
// map correction widget
//////////////////////////////////////////////////////////////////////////////

class UXMap {

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
		home.innerHTML = "&larr;&larr;main"
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

///////////////////////////////////////////////
// gps glue
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


/*
		if ("geolocation" in navigator) {
			try {
				navigator.geolocation.watchPosition((position) => {
				});
			} catch(e) {
				console.error(e)
				this.gpsDiscovered = 0
			}
		}


	gpsInitialize() {
		this.gps = 0;
		this.gpsDiscovered = 0
		if ("geolocation" in navigator) {
			try {
				navigator.geolocation.watchPosition((position) => {
					this.msg(position.coords)
					this.gps = position.coords
					this.gpsDiscovered = 1
				});
			} catch(e) {
				console.error(e)
				this.gpsDiscovered = 0
			}
		}
	}

	gpsGetLatest() {
		if ("geolocation" in navigator) {
			if (this.gpsDiscovered) {
				let scratch = this.gps
				this.gps = 0
				return scratch
			}
			return 0
		}
		this.msg("gps: no gps due to no https probably")
		return { latitude: 0, longitude: 0, altitude: 0 }
	}
*/

function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

//////////////////////////////////////////////////////////////////////////////
// UX general support - and also consolidates some of the page associated work
//////////////////////////////////////////////////////////////////////////////

class UXHelper {

	constructor(name) {
		this.zone = "azurevidian"
		this.participant = "King Tut"
		this.push(name)

		window.onpopstate = (e) => {
			if(!e || !e.state) {
				console.error("popstate: bad input for popstate")
				console.log(e)
				return
			}
			console.log("popstate: user browser hit back button")
			console.log("popstate: location: " + document.location + ", state: " + JSON.stringify(event.state));
			this.show(e.state.name)
		}

		// start ar app in general in background
		if(!this.arapp) {
			let target = document.getElementById('main_arview_target')
			console.log(target)
			this.arapp = new ARPersistComponent(target,this.zone,this.participant)
		}

	}

	push(name) {
		history.pushState({name:name},name,"#" + name );
		this.show(name)
	}

	pop() {
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

	login(moniker) {
		console.log(moniker)
		this.participant = moniker
		this.pick()
	}

	async pick() {

		// show picker page
		this.push("pick")


		// get a gps hopefully
		let gps = await gpsPromise()

		console.log("picker gps results")
		console.log(gps)

		// allow the app to start listening for changes near an area
		await this.arapp.entityListen({kind:0,zone:this.zone,gps:gps})

		// are there any maps here?
		let results = this.arapp.entityQuery({kind:"map",gps:gps})

		// TODO flush

		// paint
		let dynamic_list = document.getElementById("picker_dynamic_list")
		while (dynamic_list.firstChild) dynamic_list.removeChild(myNode.firstChild);
		for(let i = 0; i < results.length; i++) {
			let entity = results[i]
			let element = document.createElement("button")
			element.innerHTML = entity.name
			dynamic_list.appendChild(element)
			element.onclick = (e) => {
				e.preventDefault()
				this.load(e.srcElement.innerText)
				return 0
			}
		}

		// a fresh map
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
	}

	load(filename) {
		this.arapp.loadMap(filename)
		main()
	}

	main() {
		// go to the main page
		this.push("main")

		// user input handlers
	    document.getElementById("ux_save").onclick = (ev) => { this.arapp.command = ev.srcElement.id }
	    document.getElementById("ux_load").onclick = (ev) => { this.arapp.command = ev.srcElement.id }
	    document.getElementById("ux_wipe").onclick = (ev) => { this.arapp.command = ev.srcElement.id }
	    document.getElementById("ux_gps").onclick = (ev) => { this.arapp.command = ev.srcElement.id }
	    document.getElementById("ux_make").onclick = (ev) => { this.arapp.command = ev.srcElement.id }
	    document.getElementById("ux_self").onclick = (ev) => { this.arapp.command = ev.srcElement.id }

	}

	map() {
		this.push("map")
		if(!this.uxmap) {
			this.uxmap = new UXMap("map")
		}
	}

	edit() {
		this.push("edit")
	}

}

/*
let goodwords = [
 "#blessed", "Barnacles", "Buttons", "Charity", "Daffodil", "Doodle", "Fiddlesticks", 
 "Fishsticks", "Foccacia", "Fudge", "Grace", "Grace", "Live Laugh Love", 
 "Periwinkle", "Serendipity", "Succotash", "Terwilliger", "Twinkle", "Wanderlust", 
 "Collywobble", "Dongle", "Sackbut"
];

//$.ajax({ type: "GET", url: "books/badwords.txt", dataType: "text", success: function(text)
{
  //let badwords = text.split("\n");
  for(let i = 0;i<badwords.length;i++) {
    let word = atob(badwords[i]);
    let parts = word.split(' ');
    if(parts.length > 1) {
      badwords_long.push(word);
    } else {
      badwords_short.push(word);
    }
  }
  badwords_short.push("kill");
  badwords_short.push("killed");
  badwords_short.push("killing");
} //});

function Badwords(parent,args) {
  for(let j = 1;j<args.length;j++) {
    let arg = args[j].toLowerCase();
    let tokenexists = -1;
    if(j < args.length - 1) {
      let concatenated = arg + " " + args[j+1]; // try get word pair
      tokenexists = badwords_long.indexOf(concatenated.toLowerCase()); // is it there?
    }
    if(tokenexists >= 0) {
      args[j] = "bad"; args[j+1] = "mule";
      j++;
    } else if(badwords_short.indexOf(arg) >= 0) {
      args[j] = goodwords[getRandomInt(0,goodwords.length)];
    }
  }
  return args.slice(1).join(" ");
*/

//////////////////////////////////////////////////////////////////////////////
// bootstrap
//////////////////////////////////////////////////////////////////////////////

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.ux = new UXHelper("login")
	}, 100)
})

//
// todo
//
// - nobody is telling the main arpersist layer about gps locations - that needs to be fixed urgently
// - test saving anchors and maps again
//
// - network doesn't really filter by location it needs to especially for fetching maps and entities
// - 
//




