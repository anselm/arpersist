


//////////////////////////////////////////////////////////////////////////////
// AR Anchor support
//////////////////////////////////////////////////////////////////////////////

class ARAnchors extends XRExampleBase {

	constructor(args,params) {

		// init parent
        super(args, false, true, false, true)

		// zone concept - this is a temporary hack to break traffic up into zones so that different developers can playtest against the same server
		this.zone = params.zone || "azurevidian"

		// participant - this is also something of a hack so that I can disambiguate identities per player
		this.participant = params.participant || ( "RoaldDahl" + Math.random() )

		// begin capturing gps information
		this.gpsInitialize();

		// begin a system for managing a concept of persistent entities / features / objects
		this.entityInitialize();

		// user input handlers
	    document.getElementById("ux_save").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_load").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_wipe").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_gps").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_make").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_self").onclick = (ev) => { this.command = ev.srcElement.id }

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

	///////////////////////////////////////////////
	// gps glue
	///////////////////////////////////////////////

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
		return { latitude: 0, longitude: 0, altitude: 0 }
	}

	//////////////////////////////////////////////////
	// utils
	/////////////////////////////////////////////////

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

	entityInitialize() {
		this.entities = {}
		this.entityNetwork()
	}

	entityUpdateAll(frame) {

		// resolve frame related chores synchronously with access to 'frame'
		let command = this.command
		this.command = 0
		if(command)	this.msg("updateScene: command="+command)
		switch(command) {
			case "ux_save": this.save(this.zone); break
			case "ux_load": this.load(this.zone); break
			case "ux_wipe": this.flushServer(this.zone); break
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

	async save(zone) {
		let results = await this.session.getWorldMap()
		if(results) {
			const data = new FormData()
			let blob = new Blob([results.worldMap], { type: "text/html"} );
			data.append('blob',blob)
			data.append('zone',zone)
			// associate the gps anchor with the map - this isn't really needed since it comes in via entities on a reload
			// TODO it would be slightly more consistent to save the cartesian rather than the gps
			if(this.entityGPS && this.entityGPS.cartesian) {
				data.append('cartesianx',this.entityGPS.cartesian.x)
				data.append('cartesiany',this.entityGPS.cartesian.y)
				data.append('cartesianz',this.entityGPS.cartesian.z)
				data.append('anchor',this.entityGPS.anchorUID)
			}
			fetch('/api/map/save', { method: 'POST', body: data }).then(r => r.json()).then(results2 => {
				this.msg("mapSave: succeeded")
			})
		}
	}

	async flushServer(zone) {

		// flush server
		let response = await fetch("/api/entity/flush",{ method: 'POST', body: zone })
		console.log("server state after flush")
		console.log(response)

		// flush all entities locally
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			if(entity.node) {
				this.scene.remove(entity.node)
				entity.node = 0
			}
		}
		this.entities = {}		
	}

	async load(zone) {

		// flush all entities
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]
			if(entity.node) {
				this.scene.remove(entity.node)
				entity.node = 0
			}
		}
		this.entities = {}

		// fetch all entities
		let response = await fetch("/api/entity/sync",{ method: 'POST', body: zone })
		let json = await response.json()
		for(let i = 0; i < json.length; i++) {
			let entity = json[i]
			this.entities[entity.uuid]=entity
			entity.remote=0 // TODO debate merits of this
		}

		// fetch extended anchor + gps information and force create this entity - not really needed since fetch all entities does this
		//response = await fetch("uploads/"+zone+".inf")
		//json = await response.json()
		//if(json.anchor) {
		//	let cartesian = new Cesium.Cartesian3(parseFloat(json.cartesianx), parseFloat(json.cartesiany), parseFloat(json.cartesianz) )
		//	this.entityAdd(
		//		{uuid:this.entityUUID(json.anchor),
		//		anchorUUID:json.anchor
		//		kind:"gps",
		//		art:"cylinder",
		//		cartesian:cartesian
		//		zone: this.zone,
		//		participant: this.participant,
		//		published:1,
		//		remote:0
		//  })
		//}

		// observe anchors showing up again
		if (!this.listenerSetup) {
			this.listenerSetup = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
				console.log("mapLoad callback - saw an anchor re-appear uid=" + event.detail.uid )
			})
		}

		// fetch map itself - which will eventually resolve the anchor loaded above
		response = await fetch("uploads/"+zone)
		let data = await response.text()
		let results = await this.session.setWorldMap({worldMap:data})
	}

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
			       kind: "gps",
			        art: "cylinder",
			       zone: this.zone,
			participant: this.participant,
			        gps: gps,
			  published: 1,
			     remote: 0
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
			       kind: "content",
			        art: "box",
			       zone: this.zone,
			participant: this.participant,
			  cartesian: 0,
			  published: 1,
			     remote: 0
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
			       kind: "participant",
			        art: "cylinder",
			       zone: this.zone,
			participant: this.participant,
			  cartesian: 0,
			  published: 1,
			     remote: 0
		}
		this.entities[entity.uuid] = entity
		return entity
	}

	entityUUID(id) {
		// uuid has to be deterministic yet unique for all client instances so build it out of known parts and hope for best
		return this.zone + "_" + this.participant + "_" + id
	}

	//////////////////////////////////////////////////////////
	/// network storage
	//////////////////////////////////////////////////////////

	entityNetwork() {
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
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			console.log("entityReceive: saving new remote entity")
			console.log(entity)
		} else {
			// TODO may wish to scavenge more properties from the inbound traffic
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
			     remote: entity.remote || 0
		}

		this.socket.emit('publish',blob);
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

function initMap() {
	console.log("weird")
}

//////////////////////////////////////////////////////////////////////////////
// UX controls for our specific app and some general purpose UX help
//////////////////////////////////////////////////////////////////////////////

class UX {

	constructor(name) {
		this.show(name)
		window.onpopstate = (e) => {
			this.pop()
			// console.log("location: " + document.location + ", state: " + JSON.stringify(event.state));
		}
	}

	show(name) {
		this.previous = this.current
		this.hide(this.current)
		this.current = name
		let e = document.getElementById(name)
		e.style.display = "block"
	}

	hide(name) {
		if(!name) return
		document.getElementById(name).style.display = "none"
	}

	event(event) {
		console.log(event)
		alert(event)
	}

	push(name) {
		history.pushState({name:name},name,"#" + name );
		this.show(name)
	}

	pop() {
		//history.popState()
		if(!this.previous) return
		this.show(this.previous)
		this.previous = 0
	}

	main() {
		// go to the main page
		this.push("main")
		if(!window.myapp) {
			window.myapp = new ARAnchors(document.getElementById('target'),getUrlParams())
		}
	}

	map() {
		// go to the map page
		this.show("map")
		if(!this.uxmap) this.uxmap = new UXMap("map")
	}

	login(email,password) {
		// deal with login
		console.log(email + " " + password)
		this.show("main")
	}
}

//////////////////////////////////////////////////////////////////////////////

function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.ux = new UX("login")
	}, 100)
})




