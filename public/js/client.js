


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

		if (!this.listenerSetup) {
			// Add an anchor listener for any new anchors
			this.listenerSetup = true
			this.session.addEventListener(XRSession.NEW_WORLD_ANCHOR, this.mapCallbackAnchor.bind(this))
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
					this.gps = position.coords;
					this.gpsDiscovered = 1
				});
			} catch(e) {
				console.error(e)
				this.gpsDiscovered = 0
			}
		}
	}

	gpsGetLatest() {
		if (this.gpsDiscovered) {
			let scratch = this.gps;
			this.gps = 0;
			return scratch;
		}
		return { latitude: 0, longitude: 0, altitude: 0 }
	}

	//////////////////////////////////////////////////
	// 3d reconstruction maps and anchors
	/////////////////////////////////////////////////

	mapCallbackAnchor(event) {
		let anchor = event.detail
		if (anchor.uid.startsWith('anchor-')) {
			// can basically ignore because anchor uids are loaded from our own persistence layer separate from this
			console.log("mapCallbackAnchor: saw anchor again named " + anchor.uid )
		}
	}

	mapLoad(zone) {
		try {
			// first fetch some extended info and make an entity that represents the gps location (it will not resolve its anchor yet)
			fetch("uploads/"+zone+".inf").then((response) => { return response.json() }).then( (json) => {
				console.log("mapLoad: got extra details")
				console.log(json)
				if(json.anchor) {
					let gps = { latitude: json.latitude, longitude: json.longitide, altitude: json.altitude }
					this.entityAdd(json.anchor,"gps","cylinder",gps)
				}

				// then fetch the map - TODO could combine these both into one file...
				fetch("uploads/"+zone).then((response) => { return response.text() }).then( (data) => {
					this.session.setWorldMap({worldMap:data}).then(results => {
						this.msg("mapLoad: succeeded")
						console.log(results)
					})
				})
			})
		} catch(err) {
			this.msg(err)
		}
	}

	mapSaveGPS(gps,anchorUID) {
		// test - save the gps to the map itself in a way that it can be recovered with the associated anchor
		this.mapGPS = gps
		this.mapUID = anchorUID
	}

	mapSave(zone) {
		try {
			this.session.getWorldMap().then(results => {
				const data = new FormData()
				let blob = new Blob([results.worldMap], { type: "text/html"} );
				data.append('blob',blob)
				data.append('zone',zone)
				data.append('participant',participant)
				if(this.mapGPS) {
					data.append('latitude',this.mapGPS.latitude)
					data.append('longitude',this.mapGPS.longitude)
					data.append('altitude',this.mapGPS.altitude)
					data.append('anchor',this.mapUID)
				}
				fetch('/api/map/save', { method: 'POST', body: data }).then(r => r.json()).then(results2 => {
					this.msg("mapSave: succeeded")
				})
			})
		} catch(err) {
			this.msg(err)
		}
	}

	///
	/// Get an anchor
	///

	async mapAnchor(frame,x=0.5,y=0.5) {

		// If no screen space position supplied then return an anchor at the head

		if(!x && !y) {
			// TODO verify that the anchor that is created ends up with XRCoordinateSystem.TRACKER
			let headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)
			let anchorUID = frame.addAnchor(headCoordinateSystem,[0,0,0])
			return anchorUID
		}

		// Otherwise probe for an anchor

		// TODO are these both the same?
		// let anchorOffset = await frame.findAnchor(x,y)

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

		// TODO is this ok? does it make sense / save any memory / have any impact?
		// delete the anchor that had the offset
		frame.removeAnchor(anchor); anchor = 0

		return anchorUID
	}

	///
	/// A cartesian point is used (in combination with an anchor) to position features globally
	///

	setCartesian(gps) {
		// get cartesian coordinates for current gps
		this.gpsCartesian = Cesium.Cartesian3.fromDegrees(gps.longitude, gps.latitude, gps.altitude )
		// get a matrix that can transform rays from local arkit space to ECEF world space cartesian coordinates
		this.gpsFixed = Cesium.Transforms.eastNorthUpToFixedFrame(this.gpsCartesian)
		// get an inverse matrix that can go from ECEF to arkit relative space
		this.gpsInverse = Cesium.Matrix4.inverseTransformation(this.gpsFixed, new Cesium.Matrix4())
		console.log("************** gps helpers are *********** ")
		console.log(this.gpsCartesian)
		console.log(this.gpsFixed)
		return this.gpsCartesian
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
			this.msg("toCartesian: lon"+lon + " lat"+lat)
		}

		return cartesian
	}

	toLocal(inv,wt) {

		// transform from ECEF to be relative to gps anchor
		let v = Cesium.Matrix4.multiplyByPoint(inv, new Cesium.Cartesian3(entity.cartesian.x,entity.cartesian.y,entity.cartesian.z), new Cesium.Cartesian3());

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
		//this.entityNetwork()
	}

	entityUpdateAll(frame) {
		for(let uuid in this.entities) {
			this.entityUpdate(this.entities[uuid])
		}
	}

	entityUpdate(entity) {

		// keep watching entities until one shows up with enough information to establish a gps anchor
		if(!this.gpsAnchor && entity.gps) {
			// has the map relocalized?
			this.gpsAnchor = frame.getAnchor(entity.anchorUID)
			if(this.gpsAnchor) {
				this.setCartesian(entity.gps)
				this.mapSaveGPS(entity.gps,entity.anchorUID)
				this.msg("map relocalized")
			}
		}

		// not a lot to do before a gps anchor shows up
		if(!this.gpsAnchor) {
			return
		}

		// where is the gpsAnchor in arkit space on this frame?
		// TODO this can't be right?
		let anchorOffsetTemp = new XRAnchorOffset(this.gpsAnchor.anchorUID)
		this.gpsTransform = anchorOffsetTemp.getOffsetTransform(this.gpsAnchor.CoordinateSystem)

		// get cartesian pose of locally created entities - do it once for now - basically could throw away the anchor now
		if(entity.remote == 0 && !entity.cartesian) {
			let anchor = frame.getAnchor(entity.anchorUID)
			if(anchor) {
				// TODO this can't be right?
				let anchorOffset = new XRAnchorOffset(entity.anchorUID)
				let anchorTransform = anchorOffset.getOffsetTransform(anchor.coordinateSystem)
				entity.cartesian = this.toCartesian(anchorTransform,this.gpsTransform,this.gpsFixed)
			}
		}

		// get render pose
		if(entity.cartesian) {
			entity.pose = this.toLocal(this.gpsInverse,this.gpsTransform)
		}

		// add art to entities if needed
		if(!entity.node) {
			entity.node = this.createSceneGraphNode(entity.art)
			this.scene.add(entity.node)
		}

		// update entity rendering position
		if(entity.pose && entity.node) {
			entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)
		}

		// given an anchor it is possible to directly set the node from that
		//	entity.node.matrixAutoUpdate = false
		//	entity.node.matrix.fromArray(entity.anchorOffset.getOffsetTransform(entity.anchorCoordinateSystem))
		//	entity.node.updateMatrixWorld(true)

		// publish to network if needed
		if(entity.cartesian && entity.remote == 0 && entity.published == 0) {
			entity.published = 1
			this.entityPublish(entity)
		}
	}

	///
	/// Make a gps entity from an anchor (is an ordinary entity that has a gps value)
	///
	/// Several issues to fix:
	/// NOTE A plurality of these is allowed for now (later will probably only allow one)
	/// NOTE These are networked for now as well (seems like this is required to share gps)
	/// NOTE The first one is the only one I care about
	/// NOTE the anchor should be built implicitly at time of GPS - not 'whenever'
	/// NOTE should not project but use actual location as anchor
	/// NOTE this should be saved and loaded with the map - including the gps value
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
		return this.entityAdd(anchorUID,"gps","cylinder",gps)
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
		return this.entityAdd(anchorUID,"content","box",0)
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
		} else {
			this.entityParticipant = this.entityAdd(anchorUID,"participant","cylinder",0)
		}
		return this.entityParticipant
	}

	///
	/// Add an entity to the local database
	/// Philosophically the system uses a multi-pass approach where details are refined afterwards
	///

	entityAdd(anchorUID,kind,art,gps=0) {

		// uuid has to be deterministic yet unique for all client instances so build it out of known parts and hope for best
		let uuid = this.zone + "_" + this.participant + "_" + anchorUID

		// entity to store
		let entity = {
			       uuid: uuid,
			       kind: kind,
			        art: art,
			       zone: this.zone,
			participant: this.particpant,
			        act: "exist",
			  cartesian: 0,
			        gps: gps,
			  anchorUID: anchorUID,
			  published: 0,
			     remote: 0,
		}

		this.entities[entity.uuid] = entity

		console.log("entityAdd: " + entity.uuid)
		console.log(entity)

		return entity
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
			       kind: entity.kind,
			        art: entity.art,
			       zone: entity.zone,
			participant: entity.participant,
			        act: entity.act,
			  cartesian: entity.cartesian,
			        gps: entity.gps,
			  anchorUID: entity.anchorUID,
			  published: 1,
			     remote: 1
		}

		this.socket.emit('publish',blob);
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
