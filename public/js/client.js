


//////////////////////////////////////////////////////////////////////////////
// map correction widget

var map
var infoWindow
var markerCenter

function mapMarker(pos) {
  let c = map.getCenter()
   if(!markerCenter) {
    markerCenter = new google.maps.Marker({position: pos, map: map});
  } else {
    markerCenter.setPosition( pos );
  }
}

function mapError(message, infoWindow, pos) {
  infoWindow.setPosition(pos)
  infoWindow.setContent(message)
  infoWindow.open(map)
}

function mapInit() {
  
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 45.397, lng: 120.644},
    zoom: 23,
    mapTypeId: 'satellite'
  })

  infoWindow = new google.maps.InfoWindow

  map.addListener('center_changed', function(e) {
    mapMarker(map.getCenter())
  })

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      let pos = { lat: position.coords.latitude, lng: position.coords.longitude }
      map.setCenter(pos)
      mapMarker(pos)
    }, function() {
      mapError('Error: The Geolocation service failed.', infoWindow, map.getCenter())
    })
  } else {
    mapError('Error: Your browser does not support geolocation.', infoWindow, map.getCenter())
  }
}

//////////////////////////////////////////////////////////////////////////////


class ARAnchorGPSTest extends XRExampleBase {

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
	}

	///
	/// Called once per frame by base class, before render, to give the app a chance to update this.scene
	///

	updateScene(frame) {

		if (!this.listenerSetup) {

			// Add an anchor listener for any new anchors
			this.listenerSetup = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR, this.mapCallbackAnchor.bind(this))

			// add some light
			this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
			let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
			directionalLight.position.set(0, 10, 0)
			this.scene.add(directionalLight)

			// attach something to 0,0,0 (although 0,0,0 doesn't mean a lot since arkit can update anchor positions)
	        this.scene.add( this.AxesHelper( 0.2 ) );
		}

		// resolve frame related chores synchronously with access to 'frame'
		let command = this.command
		this.command = 0
		if(command)	this.msg("updateScene: command="+command)
		switch(command) {
			case "ux_save": this.mapSave(this.zone); break
			case "ux_load": this.mapLoad(this.zone); break
			case "ux_wipe": break
			case  "ux_gps": this.entityAddGPS(frame); break
			case "ux_make": this.entityAddArt(frame); break
			case "ux_self": this.entityAddParticipant(frame); break
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
		this.gpsEnabled = 0
		if ("geolocation" in navigator) {
			try {
				navigator.geolocation.watchPosition((position) => {
					this.gps = position.coords;
					this.gpsEnabled = 1
					this.msg("gps: latitude="+position.latitude+" longitude="+position.longitude)
					console.log(position)

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
			this.addAnchoredNode(new XRAnchorOffset(anchor.uid), this.createSceneGraphNode())
			console.log("Handle Anchor callback : saw an anchor again named " + anchor.uid )
		}
	}

	mapLoad(zone) {
		try {
			fetch("uploads/"+zone).then((response) => { return response.text() }).then( (data) => {
				this.session.setWorldMap({worldMap:data}).then(results => {
					this.msg("mapLoad: succeeded")
					console.log(results)
				})
			})
		} catch(err) {
			this.msg(err)
		}
	}

	mapSave(zone) {
		try {
			this.session.getWorldMap().then(results => {
				const data = new FormData()
				let blob = new Blob([results.worldMap], { type: "text/html"} );
				data.append('blob',blob)
				data.append('zone',zone)
				fetch('/api/map/save', { method: 'POST', body: data }).then(r => r.json()).then(results2 => {
					this.msg("mapSave: succeeded")
				})
			})
		} catch(err) {
			this.msg(err)
		}
	}

	///
	/// Generate or regenerate an ARKit Anchor (forward of the current head pose)
	///
	/// TODO allow custom setting fo the anchorUID
	///

	anchorFromOffset(frame,anchorOffset) {
		// get an anchor at the target position that is indicated by a given anchor+anchorOffset
		var anchor = frame.getAnchor(anchorOffset.anchorUID)
		this.tempMat = new THREE.Matrix4();
		this.tempScale = new THREE.Vector3();
		this.tempPos = new THREE.Vector3();
		this.tempQuaternion = new THREE.Quaternion();
		this.tempMat.fromArray(anchorOffset.getOffsetTransform(anchor.coordinateSystem))
		this.tempMat.decompose(this.tempPos,this.tempQuaternion, this.tempScale); 
		const worldCoordinates = frame.getCoordinateSystem(XRCoordinateSystem.TRACKER)
		const anchorUID = frame.addAnchor(worldCoordinates, [this.tempPos.x, this.tempPos.y, this.tempPos.z], [this.tempQuaternion.x, this.tempQuaternion.y, this.tempQuaternion.z, this.tempQuaternion.w])
		this.addAnchoredNode(new XRAnchorOffset(anchorUID), this.createSceneGraphNode() )
		console.log("test: created anchor with uid=", anchorUID)
		let newAnchorOffset = new XRAnchorOffset(anchorUID)
		return newAnchorOffset
	}

	//////////////////////////////////////////////////////////
	/// entities - a wrapper for a concept of a game object
	//////////////////////////////////////////////////////////

	entityInitialize() {
		this.entities = {}
		this.socket = io()
		this.socket.on('publish', this.entityCRUD.bind(this) )
	}

	entityPublish(entity) {

		console.log("entityCRUD: created entity and published to net")
		console.log(entity)
return

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
			art: (entity.art || 0),
			zone: (entity.zone || this.zone || 0 ),
			participant: (entity.participant || this.participant || 0 ),
			act: (entity.act || 0)
		}
		this.socket.emit('publish',blob);
	}

	entityVisitAll(frame) {

		for(let uuid in this.entities) {
			let entity = this.entities[uuid]

			// wire up visual representation
			if(!entity.node) {
				entity.node = this.createSceneGraphNode(entity.art)
				this.scene.add(entity.node)
				// test
				// if(entity.anchorOffset) this.addAnchoredNode(entity.anchorOffset, entity.node )
			}

			// re-transform an entity to the local coordinate system
			this.entityToLocal(frame,entity)

			// don't do this anymore - detach entities from anchors ... used to wire the scene graph node to the entity arkit anchor if any
			//if(entity.anchor) {
			//	entity.node.matrixAutoUpdate = false
			//	entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchorCoordinateSystem))
			//	entity.node.updateMatrixWorld(true)
			//} else

			// if there is a position rather than an anchor then use that
			if(entity.pose && entity.node) {
				entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)
			}
		}
	}


	///
	/// Make a gps entity from an anchor with various hints
	///
	/// NOTE A plurality of these is allowed for now (later will probably only allow one)
	/// NOTE These are networked for now as well (later will probably not network these)
	/// NOTE The first one acts as an anchor to contextually geo-locate non geo-located entities
	///

	async entityAddGPS(frame) {
		let gps = this.gpsGet();
		if(!gps) {
			this.msg("entityAddGSP: no gps")
			return 0
		}
		//	const anchorUID = frame.addAnchor(headCoordinateSystem, [0,-1,0]) <- should actually do this instead
		let anchorOffsetProbe = await frame.findAnchor(0.5,0.5)
		if(!anchorOffsetProbe) {
			this.msg("entityAddGPS: anchor failed")
			return 0
		}
		let anchorOffset = this.anchorFromOffset(frame,anchorOffsetProbe)
		let anchorUID = anchorOffset.anchorUID
		let anchor = frame.getAnchor(anchorUID)
		let anchorCoordinateSystem = anchor.coordinateSystem
		let anchorTransform = anchorOffset.getOffsetTransform(anchorCoordinateSystem)
		let entity = this.entityCRUD({
			uuid: 0,
			name: "gps",
			art: "cylinder",
			anchorOffset: anchorOffset, // may as well hold onto this to regenerate transform on demand more easily
			anchorCoordinateSystem: anchorCoordinateSystem,
			gps: gps
		})
		this.entityToCartesian(entity,0,0)
		this.entityGPS = entity
		return entity
	}

	///
	/// Create an entity as per the users request
	///

	async entityAddArt(frame) {
		if(!this.entityGPS) {
			this.msg("entityAdd: failed due to gps anchor yet")
			return 0
		}
		let anchorOffsetProbe = await frame.findAnchor(0.5,0.5)
		if(!anchorOffsetProbe) {
			this.msg("entityAddArt: anchor failed")
			return 0
		}
		let anchorOffset = this.anchorFromOffset(frame,anchorOffsetProbe)
		let anchorUID = anchorOffset.anchorUID
		let anchor = frame.getAnchor(anchorUID)
		let anchorCoordinateSystem = anchor.coordinateSystem
		let anchorTransform = anchorOffset.getOffsetTransform(anchorCoordinateSystem)
		let entity = this.entityCRUD({
			uuid: 0,
			name: "box",
			art: "box",
			anchorUID: anchorUID,
			gps: 0
		})
		let gpsTransform = this.entityGPS.anchorOffset.getOffsetTransform(this.entityGPS.anchorCoordinateSystem)
		this.entityToCartesian(entity,gpsTransform,anchorTransform)
		return entity
	}

	///
	/// Create or update a participants position
	///

	async entityParticipantUpdate(frame) {
		if(!this.entityGPS) {
			this.msg("entityParticipantUpdate: failed due to no gps anchor yet")
			return 0
		}
		if(this.entityParticipant) {
			// TODO does not move it - fix
			return this.entityParticipant
		}
		let anchorOffsetProbe = await frame.findAnchor(0.5,0.5)
		if(!anchorOffsetProbe) {
			this.msg("entityAddArt: anchor failed")
			return 0
		}
		let anchorOffset = this.anchorFromOffset(frame,anchorOffsetProbe)
		let anchorUID = anchorOffset.anchorUID
		let anchor = frame.getAnchor(anchorUID)
		let anchorCoordinateSystem = anchor.coordinateSystem
		let anchorTransform = anchorOffset.getOffsetTransform(anchorCoordinateSystem)
		let entity = this.entityCRUD({
			uuid: 0,
			name: "participant",
			art: "cylinder",
			anchorUID: anchorUID,
			gps: 0
		})
		let gpsTransform = this.entityGPS.anchorOffset.getOffsetTransform(this.entityGPS.anchorCoordinateSystem)
		this.entityToCartesian(entity,gpsTransform,anchorTransform)
		this.entityParticipant = entity
		return entity
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

			// saving locally isn't strictly necessary because network will echo this back - but if doing so then so do before publishing
			this.entities[entity.uuid] = entity

			// publish entity to network - network will also echo this back to us shortly as well (and echo will be largely ignored atm)
			this.entityPublish(entity)
		}

		else {

			// it may be a remote entity - carefully update local state from the remote data and throw away remote copy

			let previous = this.entities[entity.uuid]
			if(previous) {
///				previous.cartesian = entity.cartesian
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
	/// Generate cartesian coordinates from relative transforms
	/// TODO isolate as a standalone method without dependencies on entity
	///

	entityToCartesian(entity,gpsTransform=0,entityTransform=0) {

		// if the anchor has a gps location then go directly to cartesian and get out now - this supercedes any other evaluation
		if(entity.gps) {
			entity.cartesian = Cesium.Cartesian3.fromDegrees(entity.gps.longitude, entity.gps.latitude, entity.gps.altitude )
			return
		}

		// inverse notes
		//		let wti = MatrixMath.mat4_generateIdentity()
		//		MatrixMath.mat4_invert(wt,wit)

		// where is the gps anchor right now in arkit coords?
		let wt = gpsTransform
		console.log("entityToCartesian: we believe the arkit pose for the gps anchor is at: ")
		console.log(wt)

		// where is the entity in arkit coords?
		// entities don't keep their anchors in the current design so do not do entity.anchorOffset.getOffsetTransform(entity.anchor.coordinateSystem)
		let et = entityTransform
		console.log("entityToCartesian: entity in arkit frame of reference is at : ")
		console.log(et)

		// where is entity relative to gps anchor?
		// (subtract rather than transform because as far as concerned is in EUS and do not want any orientation to mar that)
		let ev = { x: et[12]-wt[12], y: et[13]-wt[13], z: et[14]-wt[14] }
		console.log("entityToCartesian: relative to gps anchor in arkit is at ")
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

		// Get a matrix that describes the orientation and displacement of a place on earth and multiply the relative cartesian by it

		let gpsMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(this.entityGPS.cartesian)
		entity.cartesian = Cesium.Matrix4.multiplyByPoint( gpsMatrix, ev2, new Cesium.Cartesian3() )

		console.log("debug - absolutely in ecef at")
		console.log(this.entityGPS.cartesian)
		console.log(gpsMatrix)
		console.log(entity.cartesian)
		console.log(ev2)

		if(true) {
			// debug
			let carto  = Cesium.Ellipsoid.WGS84.cartesianToCartographic(entity.cartesian);
			let lon = Cesium.Math.toDegrees(carto.longitude);
			let lat = Cesium.Math.toDegrees(carto.latitude);
			this.msg("entityAdd: gps entity is at lon="+this.entityGPS.gps.longitude+" lat="+this.entityGPS.gps.latitude );
			this.msg("entityAdd: Entity="+entity.uuid+" lon"+lon + " lat"+lat)
		}
	}

	entityToLocal(frame,entity) {

		if(!this.entityGPS) {
			this.msg("entityToLocal: don't know where we are yet")
			return
		}

		// where is the gps anchor right now?
		let wt = this.entityGPS.anchorOffset.getOffsetTransform(this.entityGPS.anchorCoordinateSystem)

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
			this.msg("entityToLocal: new entity="+entity.uuid+" is at arkit pose x="+v.x+" y="+v.y+" z="+v.z)
		}

		entity.pose = v
	}

	async test(frame) {

		// add test gps anchor
		let gps = { longitude:0, latitude:0, altitude:0 }
		let gpsAnchor = await this.entityAddGPS(frame,gps)

	}

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


/*

test suite

	- make a gps anchor 
	- await the result

	- make an ordinary entity
	- check displacement


chores
	- startup time needs to ask server for entities in zone
	- truly transform; may want to just rewrite not using cesium for clarity; hard to grok cesium reference frames

	- general comments on anchors

		- translation
		- if we place an anchor then that indicates a computed position relative to a local world origin
		- it's possible that arkit could say rotate the frame of reference; in which case the anchor would move
		- if the anchor that was placed was a gps anchor then it's possible that the gps anchor translation could change
		- so, when estimating where anchors are absolutely, it's important to know if an anchor position has changed, or the gps anchor
		- and overall it may be best to compute where an anchor is in cartesian coordinates every frame and publish any changes
		- also a philosophy around 'letting go' of an anchor may be needed; or philosophically we should immediately 'let go' of an anchor
		- if we immediately 'let go' then we don't need anchors - we just use the cartesian coordinates to reconstitute the local position

		- orientation
		- we're always definitely going to want to render in a local frame of reference so that 0,0,0 is near us
		- features should be rotated as a function of their relative orientation and absolute longitude and latitude to ECEF coordinates
		- any feature I wish to paint should always be transformed from world coordinates back to local coordinates
		- as a test i would like a tiny earth

	- user experience improvement for placement
		* small map shows where it thinks you are - works well
		* you can slide the map around and a little marker stays centered; this indicates where you actually are
		* i could instead make it that you drag the marker to where you want it to be
		- so now, there is a mode that you can go to, and adjust the gps location of any gps point
		- and i would like you to be able to add gps points at random as you wish

- user experience

	+ currently you can startup the app
	+ currently you can place a single map anchor - I would like to let you place multiple of them
	- I would like a concept of selecting an object on the screen and then fiddling with it
	- I would like to have a page where you can adjust your map position of the currently selected map anchor
	- when I save a world map to the server I would like to ALSO let you save the gps associated with the anchors that you chose


*/





