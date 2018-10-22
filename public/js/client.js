
class ARAnchorGPSTest extends XRExampleBase {

	constructor(args,params) {

		super(args, false)

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
	    document.getElementById("ux_make").onclick = (ev) => { this.command = ev.srcElement.id }
	    document.getElementById("ux_self").onclick = (ev) => { this.command = ev.srcElement.id }

		// unused - tap to indicate that user wants to interact (make an object etc) - disabled for now - will reactivate with edit/manipulate operations
		// this._tapEventData = null 
		//	this.el.addEventListener('touchstart', this._onTouchStart.bind(this), false)
	}

	msg(msg) {
		if(!this.msgs) this.msgs = []
		console.log(msg)
		let div = document.getElementById("ux_help")
		if(!div) return
		this.msgs.unshift(msg)
		div.innerHTML = this.msgs.slice(0,5).join("<br/>")
	}

	/*
	_onTouchStart(ev){
		// Save screen taps as normalized coordinates for use in this.updateScene
		if (!ev.touches || ev.touches.length === 0) {
			console.error('No touches on touch event', ev)
			return
		}
		//save screen coordinates normalized to -1..1 (0,0 is at center and 1,1 is at top right)
		this._tapEventData = [
			ev.touches[0].clientX / window.innerWidth,
			ev.touches[0].clientY / window.innerHeight
		]
		console.log(ev.touches)
	}
	*/

	///////////////////////////////////////////////
	// scene geometry and update callback
	///////////////////////////////////////////////

	initializeScene() {
		// called from parent scope - dress the stage

		let box = new THREE.Mesh(
			new THREE.BoxBufferGeometry(0.1, 0.1, 0.1),
			new THREE.MeshPhongMaterial({ color: '#DDFFDD' })
		)
		box.position.set(0, 0.05, 0)
        this.floorGroup.add( this.AxesHelper( 0.2 ) );
		this.floorGroup.add(box)

		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)
	}

	updateScene(frame) {

		// Called once per frame, before render, to give the app a chance to update this.scene

		// resolve frame related chores synchronously with access to 'frame'
		let command = this.command
		this.command = 0
		switch(command) {
			case "ux_save": this.mapSave(this.zone); break
			case "ux_load": this.mapLoad(this.zone); break
			case "ux_wipe": break
			case "ux_make": this.entityAuthor(frame); break
			case "ux_self": this.entityParticipantUpdate(frame); break
			default: break
		}

		// resolve any changes on a per frame basis that may be needed such as arkit anchors updating
		this.entityVisitAll(frame)
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
			case "sphere": geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); break;
			case "box": geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1); break;

		}
		let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
		return new THREE.Mesh(geometry, material)
	}

	///////////////////////////////////////////////
	// gps glue
	///////////////////////////////////////////////

	gpsInitialize() {
		this.gps = 0;
		this.gpsEnabled = 0
		if ("geolocation" in navigator) {
			try {
				navigator.geolocation.watchPosition((position) => {
					this.gps = position;
					this.gpsEnabled = 1
					this.msg("gps: latitude="+position.latitude+" longitude="+position.longitude)

				});
			} catch(e) {
				console.error(e)
				this.gpsEnabled = 0
			}
		}
	}

	gpsGet() {
		if (this.gpsEnabled && "geolocation" in navigator) {
			let scratch = this.gps;
			this.gps = 0;
			return scratch;
		}
		return { latitude: 0, longitude: 0, altitude: 0 }
	}

	//////////////////////////////////////////////////
	// 3d reconstruction maps
	/////////////////////////////////////////////////

	mapCallbackAnchor(event) {
		let anchor = event.detail
		this.msg("mapCallbackAnchor: uid=" + anchor.uid)
		if (anchor.uid.startsWith('anchor-')) {
			// it's an anchor we created last time
			//this.addAnchoredNode(new XRAnchorOffset(anchor.uid), this._createSceneGraphNode())
			console.log("Handle World Anchor callback : saw an anchor again named " + anchor.uid )
		}
	}

	mapLoad(zone) {

		//	const worldCoordinates = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)

		if (!this.mapListenerSetupLatched) {
			this.mapListenerSetupLatched = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR, this.mapCallbackAnchor.bind(this))
		}

		fetch("uploads/"+zone).then((response) => { return response.text() }).then( (data) => {
			this.session.setWorldMap({worldMap:data}).then(results => {
				this.msg("mapLoad: succeeded")
				console.log(results)
			})
		})
	}

	mapSave(zone) {

		this.session.getWorldMap().then(results => {
			const data = new FormData()
			let blob = new Blob([results.worldMap], { type: "text/html"} );
			data.append('blob',blob)
			data.append('zone',zone)
			fetch('/api/map/save', { method: 'POST', body: data }).then(r => r.json()).then(results2 => {
				this.msg("mapSave: succeeded")
				console.log(results2)
			})
		})

		/* async way
		(async () => {
		  const rawResponse = await fetch('/api/save', {
		    method: 'POST',
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
		    body: JSON.stringify(hash)
		  });
		  const content = await rawResponse.json();

		  console.log(content);
		})();
		*/

		/*
		// as a form field for multipart
		var data = new FormData();
		data.append( "json", JSON.stringify(json) );
		fetch("/api/save", {
		    method: "POST",
		    body: data
		})
		.then(function(res){ return res.json(); })
		.then(function(data){ alert( JSON.stringify( data ) ) })
		*/

		/*

		let data = JSON.stringify(hash)
		console.log("saving")
		console.log(data)
		postDataHelper('/api/map/save',data).then(result => {
			console.log("got result")
			console.log(result)
			if(!result || !result.uuid) {
				console.error("entityBroadcast: failed to save to server")
			} else {
				// could save locally if network returns it to us ( we don't need to do this here but can wait for busy poll for now )
				// this.entities[result.uuid] = result
			}
		})
		*/

	}

	///
	/// Generate or regenerate an ARKit Anchor (forward of the current head pose)
	///
	/// TODO allow custom setting fo the anchorUID
	///

	mapAnchor(frame,projection = [0,0,0],uid = 0) {
		let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
		let anchorUID = frame.addAnchor(headCoordinateSystem,projection)
		let anchorOffset = new XRAnchorOffset(anchorUID)
		let anchor = frame.getAnchor(anchorOffset.anchorUID)
		let thing = {
			anchorUID: anchorUID,
			anchorOffset: anchorOffset,
			anchor: anchor
		}
		this.msg("mapAnchor: created uid="+anchorUID)
		console.log(anchorUID)
		console.log(anchorOffset.anchorUID)
		console.log(thing)
		return thing
	}

	//////////////////////////////////////////////////////////
	/// entities - a wrapper for a concept of a game object
	//////////////////////////////////////////////////////////

	entityInitialize() {
		this.entities = {}
		this.socket = io()
		this.socket.on('publish', this.entityCRUD.bind(this) )
	}

	///
	/// Publish state change on an entity to network - acts may also include events like 'delete'
	/// TODO There is no concept of an access control list - anybody can change anything
	/// TODO There is no sanitization (server should do it anyway)
	///

	entityPublish(entity) {
		if(!entity.uuid) {
			this.msg("entityPublish: Invalid entity no uuid")
			return 0
		}
		if(!this.socket) {
			return;
		}
		// publish an extract of the entity
		let blob = {
			uuid:entity.uuid,
			anchorUID: ( entity.anchorUID || 0 ),
			cartesian: ( entity.cartesian || 0 ),
			style: (entity.style || 0),
			zone: (entity.zone || this.zone || 0 ),
			participant: (entity.participant || this.participant || 0 ),
			act: (entity.act || 0)
		}
		this.socket.emit('publish',blob);
	}


	///
	/// Iterate through all entities and do any per frame related work that may be required - such as associating art with network inbound entities
	///

	entityVisitAll(frame) {
		for(let uuid in this.entities) {
			let entity = this.entities[uuid]

			// add a visual scene node if needed and it doesn't have one
			if(!entity.node && this.scene) {
				entity.node = this.createSceneGraphNode(entity.style)
				this.scene.add(entity.node)
			}

			// re-transform an entity to the local coordinate system
			this.entityToLocal(frame,entity)

			// wire the scene graph node to the entity arkit anchor if any
			if(entity.anchor && entity.node) {
				entity.node.matrixAutoUpdate = false
				entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem))
				entity.node.updateMatrixWorld(true)
			}

			// if there is a position rather than an anchor then use that
			else if(entity.pose && entity.node) {
				entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)
			}
		}
	}

	///
	/// Create an entity as per the users request
	///

	entityAuthor(frame) {

		if(!this.entityGPSUpdate(frame)) {
			this.msg("entityAdd: No world anchor (camera pose + gps) yet")
			// TODO could provide better messaging such as on screen pop ups to be more helpful for end user
			return
		}

		let m = this.mapAnchor(frame)

		this.entityCRUD({
			uuid: 0,
			name: "box",
			style: "box",
			anchor: m.anchor,
			anchorUID: m.anchorUID,
			anchorOffset: m.anchorOffset,
			gps: 0
		})
	}

	///
	/// Create or update a participants position
	///

	entityParticipantUpdate(frame) {

		// get a special gps associated anchor or fail - this will be used as a starting point for all subsequent objects
		if(!this.entityGPSUpdate(frame)) {
			this.msg("entityAdd: No world anchor (camera pose + gps) yet")
			// TODO could provide better messaging such as on screen pop ups to be more helpful for end user
			return
		}

		if(!this.entityParticipant) {
			let m = this.mapAnchor(frame)
			this.entityParticipant = this.entityCRUD({
				uuid: 0,
				name: "participant",
				style: "cylinder",
				anchor: m.anchor,
				anchorUID: m.anchorUID,
				anchorOffset: m.anchorOffset,
				gps: 0
			})
		} else {
			// TODO actually moving isn't supported yet
			this.entityCRUD(this.entityParticipant)
		}

		return this.entityParticipant
	}

	///
	/// Get or create a handle on a special entity which marks a gps location and an associated arkit anchor
	/// TODO it may make sense to update this based on when a good gps reading shows up rather than once only
	///

	entityGPSUpdate(frame) {

		// for now just return any valid entityGPS I ever got - never try get it again - arguably this could be refetched if a nice gps reading flys past
		if(this.entityGPS) {
			return this.entityGPS
		}

		// given a frame pose attempt to associate this with an anchor to bind an arkit pose to a gps coordinate
		let gps = this.gpsGet();
		if(!gps) {
			return 0
		}

		if(!this.entityGPS) {
			let m = this.mapAnchor(frame)
			this.entityGPS = this.entityCRUD({
				uuid: 0,
				name: "world",
				style: "cylinder",
				anchor: m.anchor,
				anchorUID: m.anchorUID,
				anchorOffset: m.anchorOffset,
				gps: gps
			})
		} else {
			// TODO note this wouldn't actually update the GPS - needs work still
			this.entityCRUD(this.entityGPS)
		}

		return this.entityGPS
	}


	///
	/// Create/Revise/Update/Delete an entity
	///

	entityCRUD(entity) {

		let locally_new = 0

		if(!entity.uuid) {
			locally_new = 1
			this.UUIDCounter = this.UUIDCounter ? (this.UUIDCounter+1) : 1
			entity.uuid = this.zone + "-" + this.participant + "-" + this.UUIDCounter + "-" + entity.name
		}

		if(!entity.zone) {
			entity.zone = this.zone
		}

		if(!entity.participant) {
			entity.participant = this.participant
		}

		if(!entity.act) {
			entity.act = "exist"
		}

		if(locally_new) {

			// generate cartesian coordinates
			this.entityToCartesian(entity)

			// saving locally isn't strictly necessary because network will echo this back - but if doing so then so do before publishing
			this.entities[entity.uuid] = entity

			// publish entity to network - network will also echo this back to us shortly as well (and echo will be largely ignored atm)
			this.entityPublish(entity)

			console.log("entityCRUD: created entity and published to net")
			console.log(entity)
		}

		else {

			// it may be a remote entity - carefully update local state from the remote data and throw away remote copy

			let previous = this.entities[entity.uuid]
			if(previous) {
				previous.cartesian = entity.cartesian
				entity = previous
				console.log("entityCrud: remote entity found again and updated")
				console.log(entity)
			}

			// otherwise it is new to us (likely arrived via network)

			else {
				this.entities[entity.uuid] = entity
				console.log("entityCrud: saving new remote entity")
				console.log(entity)
			}

		}

		// return
		return entity
	}

	///
	/// Generate or regenerate cartesian coordinates relative to GPS Anchor (or in case of GPS Anchor simply use GPS coordinates)
	///

	entityToCartesian(entity) {

		// if the anchor has a gps location then go directly to cartesian and get out now - this supercedes any other evaluation
		if(entity.gps) {
			entity.cartesian = Cesium.Cartesian3.fromDegrees(entity.gps.longitude, entity.gps.latitude, entity.gps.altitude )
			return
		}

		if(!this.entityGPS) {
			this.msg("entityToCartesian: World Anchor not yet set")
			return
		}

		// all entities that intend to be promoted to cartesian coordinates should have anchors by now
		if(!entity.anchorOffset) {
			this.msg("entityToCartesian: Entity has no anchor")
			return
		}

		// inverse notes
		//		let wti = MatrixMath.mat4_generateIdentity()
		//		MatrixMath.mat4_invert(wt,wit)

		// where is the gps anchor right now?
		let wt = this.entityGPS.anchorOffset.getOffsetTransform(this.entityGPS.anchor.coordinateSystem)
		console.log("entityToCartesian: we believe the arkit pose for the gps anchor is at: ")
		console.log(wt)

		// where is the entity?
		let et = entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem)
		console.log("entityToCartesian: entity in arkit frame of reference is at : ")
		console.log(et)

		// where is entity relative to gps anchor?
		let ev = { x: et[12]-wt[12], y: et[13]-wt[13], z: et[14]-wt[14] }
		console.log("entityToCartesian: relative to world anchor in arkit is at ")
		console.log(ev)

		// TODO I could get the relative transformation of the entity in ARKit space (even by just subtracting the gps position)
		// and then concatenate that matrix onto the end of the worldMatrix ... 
		// arguably - I could even just ship both matrices...

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

		// Get a matrix that describes the orientation and displacement of a place on earth and multiply the relative cartesian by it

		let worldMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(this.entityGPS.cartesian)
		entity.cartesian = Cesium.Matrix4.multiplyByPoint( worldMatrix, ev2, new Cesium.Cartesian3() )

		console.log("absolutely in ecef at")
		console.log(entity.cartesian)
		console.log(ev2)

		if(true) {
			// debug
			let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(entity.cartesian);
			let lon = Cesium.Math.toDegrees(carto.longitude);
			let lat = Cesium.Math.toDegrees(carto.latitude);
			this.msg("entityAdd: World is at lon="+this.entityGPS.gps.longitude+" lat="+this.entityGPS.gps.latitude );
			this.msg("entityAdd: Entity="+entity.uuid+" lon"+lon + " lat"+lat)
		}
	}

	entityToLocal(frame,entity) {

		if(!this.entityGPS) {
			this.msg("entityToLocal: World Anchor not yet set")
			return
		}

		// where is the gps anchor right now?
		let wt = this.entityGPS.anchorOffset.getOffsetTransform(this.entityGPS.anchor.coordinateSystem)

		// make an inverse transform that will go from ECEF to be relative to the gps anchor
		let inv = Cesium.Matrix4.inverseTransformation(Cesium.Transforms.eastNorthUpToFixedFrame(this.entityGPS.cartesian), new Cesium.Matrix4())

		// transform the entity from ECEF to be relative to gps anchor
		let v = Cesium.Matrix4.multiplyByPoint(inv, new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z), new Cesium.Cartesian3());

		// although is now in arkit relative space, there is still a displacement to correct relative to the actual arkit origin, also fix axes
		v = {
			x:    v.x + wt[12],
			y:    v.z + wt[13],
			z:  -(v.y + wt[14]),
		}

		if(!entity.pose) {
			this.msg("entityToLocal: new entity="+entity.uuid+" x="+v.x+" y="+v.y+" z="+v.z)
		}

		entity.pose = v
	}

	/*
	///
	/// UNUSED - Remove sticky elements from an entity prior to being removed from local database
	///

	entityFlush(entity) {
		if(entity.anchor) {
			frame.removeAnchor(entity.anchor)
			entity.anchor = 0
		}
	}

	///
	/// UNUSED - for debugging
	///

	entityClone(entity) {
		// this is a hack
		// as a test the object can be made immediately - the approach is is to move it out of the colliding uuid
		// the network will return a second copy of the same object in a moment
		// (in the entitiesupdate this object will get a visible scene graph node if it doesn't have one yet)
		entity.uuid = this.entitycounter = this.entityCounter ? this.entityCounter + 1 : 1
		entity.style = "sphere"
		this.entityCRUD(entity)
	}

	entityBusyPoll() {

		function postDataHelper(url,data) {
		    return fetch(url, {
		        method: "POST",
		        mode: "cors", // no-cors, cors, *same-origin
		        cache: "no-cache",
		        credentials: "same-origin", // include, same-origin, *omit
		        headers: { "Content-Type": "application/json; charset=utf-8", },
		        referrer: "no-referrer", // no-referrer, *client
		        body: data,
		    }).then(response => response.json())
		}

		var d = new Date()
		var n = d.getTime()
		console.log("Busy polling server at time " + n )
		let scope = this
		let data = JSON.stringify({time:n})
		postDataHelper('/api/entity/sync',data).then(results => {
			for(let uuid in results) {
				let entity = results[uuid]
				if(entity.uuid && !scope.entities[entity.uuid]) {
					scope.entities[entity.uuid] = entity
				}
			}
			setTimeout( function() { scope.entityBusyPoll() },1000)
		})
	}

	*/

}

function getUrlParams(vars={}) {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) => { vars[key] = value })
    return vars;
}

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		window.myapp = new ARAnchorGPSTest(document.getElementById('target'),getUrlParams())
	}, 1000)
})

// todo
// 	- server - must ask server for all initial objects and must partition by zone
//	- server - server could actually grant a uuid root to me
//	- truly transform rather than translate


