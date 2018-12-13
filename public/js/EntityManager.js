
// a helper to get gps location
import {XRAnchorCartography} from './XRAnchorCartography.js'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Client side entity state mirroring and networking
///
/// Manages a concept of 'entities' which are networkable collections of art and gps locations
///
/// TODO later have an Entity class that owns its own methods ... I want an ECS pattern for that
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class EntityManager {

	// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
	// each client locally generates guids - which are likely to be non-collidant; at some point I could implement a server side check TODO
	generateUUID() {
	  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
	    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	  )
	}

	constructor(log=0,err=0) {

		// debug output
		this.log = log || console.log
		this.err = err || console.error

		// tags - default props per entity
		this.tags = ""

		// globals
		this.entityParty = 0
		this.entityGPS = 0
		this.entitySelected = 0
		this.entityPartyUpdateCounter = 1

		// entities
		this.entities = {}

		// restart entities
        return (async () => {
			await this.entityNetworkRestart()
            return this;
        })();

    }

	///
	/// query remote (and adds to local)
	///

	async entityQueryRemote(query={}) {
		let response = await fetch("/api/entity/query", {
			method: 'POST',
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
    		body: JSON.stringify(query)
		})
		let json = await response.json()
		let results = []
		this.entityAll((entity)=>{
			this.entities[entity.uuid] = entity
			results.push(entity)
		})
	}

	///
	/// query locally
	///

	entityQuery(args={}) {
		// local query only - not network
		let results = []
		this.entityAll((entity)=>{
			if(args.kind && entity.kind != args.kind) return
			results.push(entity)
			// TODO add gps filtering
		})
		return results
	}

    ///
    /// convenience helper to iterate entities
    ///

	entityAll(callback) {
		for(let uuid in this.entities) {
			callback(this.entities[uuid])
		}
	}


	///
	/// update all - and then calls itself
	///

	entityUpdateAll(session,frame) {

		// tack on some debugging event observers if none yet to report on arkit status
		if(!this.debugging_setup) {
			this.debugging_setup = 1
			this.debugging(session)
		}

		// Save map?
		if(this.pleaseSaveMap == 1) {
			// block duplicate invocations
			this.pleaseSaveMap = 2
			try {
				this._mapSave(session,frame).then(results => {
					this.pleaseSaveMap = 0
					this.log("map save done with status " + results)
				})
			} catch(e) {
				this.pleaseSaveMap = 0
				this.err(e)
			}
		}

		// Load map?
		if(this.pleaseLoadMap && this.pleaseLoadMap != "loading") {
			let filename = this.pleaseLoadMap
			// block duplicate invocations
			this.pleaseLoadMap = "loading"
			try {
				this._mapLoad(session,frame,filename).then(results => {
					this.pleaseLoadMap = 0
					this.log("map loading done with status " + results)
				})
			} catch(e) {
				this.pleaseLoadMap = 0
				this.err(e)
			}
		}

		// periodically update entity party
		// TODO - if entity party then keep updating the party anchor!! and keep republishing
		if(this.entityPartyUpdateCounter && this.entityParty) {
			this.entityPartyUpdateCounter++
			if(this.entityPartyUpdateCounter > 60) {
				this.entityPartyUpdateCounter = 1
				if(!this.entityParty._attach) {
					this.entityParty._attach = "eye"
					this.entityParty.published = 0
				}
			}
		}

		// update all entities synchronously
		this.entityAll((entity)=>{
			this._entityUpdateOne(session,frame,entity)
		})

	}

	_entityUpdateOne(session,frame,entity) {

		// do not update anything else - unless either is a gps anchor or gps anchor exists already

		if(!this.entityGPS && entity.kind != "gps") {
			return
		}

		// debugging

		let relocalized_before = entity.relocalized

		// newly locally created entities specify how they would like to be anchored - here I avoid awaiting asynchronous events
		// will set relocalized to 0

		switch(entity._attach) {
			case "gps":
				entity._attach = "busy"
				XRAnchorCartography.attach(frame,entity,"gps").then(results => {
					if(results) {
						entity._attach = 0
					}
				})
				break
			case "project":
				entity._attach = "busy"
				// try shoot a ray intersection
				XRAnchorCartography.attach(frame,entity,"project").then(results => {
					if(results) {
						entity._attach = 0
					} else {
						// try as a fallback just attaching to the camera - this should never fail
						XRAnchorCartography.attach(frame,entity,"eye").then(results => {
							if(results) {
								entity._attach = 0
							}
						})
					}
				})
				break
			case "eye":
				entity._attach = "busy"
				XRAnchorCartography.attach(frame,entity,"eye").then(results => {
					if(results) {
						entity._attach = 0
					}
				})
				break
			default:
				break
		}

		// stop this thread from skipping ahead - due to the above asynchronous pattern

		if(entity._attach) {
			return
		}

		// mark and sweep - try relocalize any entity I can based on whatever data I can scavenge from it
		// will set relocalized to 1 - but will not set published state 

let fresh = entity.xyz ? 0 : 1

		XRAnchorCartography.relocalize(frame,entity,this.entityGPS)

if(fresh && entity.kind != "party" && entity.xyz && entity.anchor_xyz) {
	// looking to see how well the cartesian recovery matches the original inputs
	this.log("Fresh1 x=" + entity.anchor_xyz.x.toFixed(3) + " y=" + entity.anchor_xyz.y.toFixed(3) + " z=" + entity.anchor_xyz.z.toFixed(3) )
	this.log("Fresh2 x=" + entity.xyz.x.toFixed(3) + " y=" + entity.xyz.y.toFixed(3) + " z=" + entity.xyz.z.toFixed(3) )
}

		// set shared gps anchor if at all possible - this is used to anchor the entire scene and all other entities

		if(!this.entityGPS && entity && entity.kind == "gps" && entity.relocalized) {
			this.log("*** entityGPS found " + entity.uuid)
			this.entityGPS = entity
		}

		// debug - report on when things get relocalized once - except for the party because they move often - maybe a timer would be better? TODO

		if(!relocalized_before && entity.relocalized && entity.kind != "party" ) {
			this.log(entity.uuid + " relocalized kind="+entity.kind+" pub="+entity.published)
		}

		// until a gps anchor shows up do not network anything ever

		if(!this.entityGPS) {
			return
		}

		// publish anything once that is not published yet

		if(!entity.published && entity.relocalized) {
			this._entityPublish(entity)
			entity.published = 1
		}
	}

	entitySetSelectedByUUID(uuid) { this.entitySelected = this.entities[uuid]; return this.entitySelected }
	entitySetSelected(entity) { this.entitySelected = entity; return entity }
	entityGetSelected() { return this.entitySelected }

	///
	/// Make a gps entity
	/// * note that this.entityGPS is not set here - this system is a lazy loader (and these things can arrive over network also)
	///

	entityAddGPS() {
		let entity = {
			   uuid: this.generateUUID(),
		       name: "an area map",
		      descr: "an area map",
		       kind: "gps",
		        art: "/meshes/crow/scene.gltf",
		       tags: this.tags,
		      party: this.entityParty ? this.entityParty.uuid : 0,
		  cartesian: 0,
		 quaternion: 0,
		      euler: 0,
		      scale: 0,
		        xyz: 0,
		        gps: 0,
		relocalized: 0,
		  published: 1,  // don't publish gps anchors until an associated map is saved to a server
		    _attach: "gps"   // internal command to attach to world
		}
		this.entities[entity.uuid] = entity
		this.entitySetSelected(entity)
		return entity
	}

	///
	/// Create an entity as per the users request
	/// * it is ok to make these before gps anchors show up (this system uses a lazy loading philosophy)
	///

	entityAddArt() {
		let	entity = {
			   uuid: this.generateUUID(),
		       name: "art!",
		      descr: "user art!",
		       kind: "content",
		        art: "/meshes/hornet/scene.gltf",
		       tags: this.tags,
		      party: this.entityParty ? this.entityParty.uuid : 0,
		  cartesian: 0,
		 quaternion: 0,
		      euler: 0,
		      scale: 0,
		        xyz: 0,
		        gps: 0,
		relocalized: 0,
		  published: 0,
		    _attach: "project"
		}
		this.entities[entity.uuid] = entity
		this.entitySetSelected(entity)
		return entity
	}

	///
	/// Create player
	/// 

	entityAddParty(newname="") {
		let entity = {
			   uuid: this.generateUUID(),
		       name: newname,
		      descr: "a representation of a person",
		       kind: "party",
		        art: "/meshes/heart/scene.gltf",
		       tags: this.tags,
		      party: 0,
		  cartesian: 0,
		      euler: 0,
		      scale: 0,
		        xyz: 0,
		        gps: 0,
		relocalized: 0,
		  published: 0,
		    _attach: "eye"
		}
		this.entities[entity.uuid] = entity
		this.entitySetSelected(entity)
		return entity
	}

	mapSave() {
		if(!this.pleaseSaveMap) this.pleaseSaveMap = 1
		return
	}

	async _mapSave(session,frame) {

		// a slight hack/helper: force create a gps anchor right now if none yet - this reduces the hassle of having to make an anchor earlier
		let entity = this.entityGPS
		if(!entity) {
			// produce the shallow object
			entity = this.entityAddGPS()
			entity = await XRAnchorCartography.attach(frame,entity,true,false)
			if(entity) {
				XRAnchorCartography.relocalize(frame,entity,0)
				if(entity.relocalized) {
					this.entityGPS = entity
				} else {
					entity = 0
				}
			}
		}

		// generally speaking there's no point in saving a map without knowing the latitude/longitude

		if(!entity) {
			this.err("mapSave: failed to relocalize")
			return 0
		}

		this.log("entity mapSave: UX saving map")

		let results = 0
		try {
			results = await session.getWorldMap()
		} catch(e) {
			this.err(e)
			return 0
		}
		if(!results) {
			this.err("entity MapSave: [error] this engine does not have a good map from arkit yet")
			return 0
		}

		// save the map

		const data = new FormData()
		data.append('blob',        new Blob([results.worldMap], { type: "text/html"} ) )
		data.append('uuid',        entity.uuid )
		data.append('anchorUID',   entity.anchorUID )
		let response = await fetch('/api/map/save', { method: 'POST', body: data })
		let json = await response.json()
		this.log("entity mapSave: succeeded ")
		console.log(json)

		// normally the entity is marked as published already to prevent it from being published...
		// by marking it as not published the mark-and-sweep logic will re-publish it
		// (this engine avoids publishing gps anchors until associated with a saved map)

		entity.published = 0

		return 1
	}

	mapLoad(filename) {
		this.pleaseLoadMap = filename
	}

	async _mapLoad(session,frame,filename) {

		this.log("will try load map named " + filename )

		// let's just reset everything and reload the network - probably overkill but i want to clear any gps anchors
		await this.entityNetworkRestart()

		// fetch map itself - which will eventually resolve the anchor loaded above
		let response = await fetch("uploads/"+filename)
		let data = await response.text()
		let results = await session.setWorldMap({worldMap:data})
		this.log("fresh map file arrived " + filename + " results=" + results.loaded )
		console.log(results)

		return 1
	}

	//////////////////////////////////////////////////////////////////////////////////
	// network
	//////////////////////////////////////////////////////////////////////////////////

	async entityNetworkRestart() {

		// get a gps location hopefully
		this.gps = await XRAnchorCartography.gps()
		this.log("GPS is lat=" + this.gps.latitude + " lon=" + this.gps.longitude + " alt=" + this.gps.altitude )

		// local flush 
		this.entities = {}

		// unset anything selected
		this.entitySetSelected(0)

		// wipe other odds and ends
		this.entityGPS = 0
		this.entityParty = 0

		// open connection if none
		if(!this.socket) {
			this.socket = io()
			this.socket.on('publish', this._entityReceive.bind(this) )
			this.socket.emit('location',this.gps)
		}

		// periodically send location - TODO need to update gps itself!
		if(!this.gpsInterval) {
			this.gpsInterval = setInterval(()=>{
				if(this.socket) {
					this.socket.emit('location',this.gps )
				}
			},1000)
		}

		// reload or load everything (typically AFTER the network is started to avoid missing chatter) - can happen before map load - can be called over and over
		await this._entityLoadAll(this.gps)

		// also rebind to self if possible
		await this.entityRebindToParty()

	}

	///
	/// Get everything near player gps from server (typically AFTER starting to listen to ongoing chatter due to possibility of a gap)
	///

	async _entityLoadAll() {
		// load all the entities from the server in one go - and rebinding/gluing state back together will happen later on in update()
		if(!this.gps) {
			this.log("entityLoadAll: this engine needs a gps location before loading maps")
			return 0
		}

		let response = await fetch("/api/entity/query", {
			method: 'POST',
		    headers: {
		      'Accept': 'application/json',
		      'Content-Type': 'application/json'
		    },
    		body: JSON.stringify({gps:this.gps})
		})

		let json = await response.json()

		let count = 0
		for(let uuid in json) {
			count = count + 1
			let entity = json[uuid]
			this.entities[entity.uuid]=entity
			entity.published=1
			entity.relocalized=0
		}
		return 1
	}

	entityUpdateLatLng(entity,latitude,longitude,altitude) {
		// a helper to set the full gps and cartesian of a moved entity
		if(!entity || !entity.gps) return
		XRAnchorCartography.updateLatLng(entity,latitude,longitude,altitude)
	}

	///
	/// Receive an entity over network - may Create/Revise/Update/Delete an entity
	/// TODO deletion events
	///

	_entityReceive(entity) {
		entity.cartesian = new Cesium.Cartesian3(
			parseFloat(entity.cartesian.x),
			parseFloat(entity.cartesian.y),
			parseFloat(entity.cartesian.z)
			)
		entity.quaternion = entity.quaternion ? new THREE.Quaternion(
			parseFloat(entity.quaternion._x),
			parseFloat(entity.quaternion._y),
			parseFloat(entity.quaternion._z),
			parseFloat(entity.quaternion._w) ) : new THREE.Quaternion()
		entity.euler = entity.euler ? new THREE.Euler(
			parseFloat(entity.euler._x),
			parseFloat(entity.euler._y),
			parseFloat(entity.euler._z)) : new THREE.Euler()
		entity.published = 1
		entity.relocalized = 0
		entity._attach = 0 // paranoia
		let previous = this.entities[entity.uuid]
		if(!previous) {
			this.entities[entity.uuid] = entity
			this.log("entityReceive: saving new remote entity " + entity.uuid)
			console.log(entity)
		} else {
			// scavenge choice morsels from the network traffic and throw network traffic away
			previous.art = entity.art
			previous.tags = entity.tags
			previous.cartesian = entity.cartesian
			previous.quaternion = entity.quaternion
			previous.euler = entity.euler
			previous.scale = entity.scale
			previous.xyz = entity.xyz
			previous.gps = entity.gps
			previous.published = 1
			previous.relocalized = 0
			previous._attach = 0 // paranoia
			//this.log("entityReceive: remote entity found again and updated " + entity.uuid)
		}

		this.entityDebug(entity,"Network ")
	}

	entityDebug(entity, msg="Debug ") {
		if(entity.kind == "party") return // too noisy
		this.log(msg + " received id="+entity.uuid+ " kind="+entity.kind)
		//this.log("  x=" + entity.xyz.x.toFixed(3) + " y=" + entity.xyz.y.toFixed(3) + " z="+entity.xyz.z.toFixed(3) )
		let e = entity.euler || new THREE.Euler()
		this.log("  p=" + THREE.Math.radToDeg(e._x).toFixed(3)
			    + " y=" + THREE.Math.radToDeg(e._y).toFixed(3)
			    + " r=" + THREE.Math.radToDeg(e._z).toFixed(3) )
	}


	///
	/// Publish an entity to network
	/// I prefer to publish an extract because there may be other state stored in entity locally that I don't want to publish
	/// TODO when publishing an update there's no point in sending all the fields
	///

	_entityPublish(entity) {

		if(!entity.relocalized || !entity.cartesian) {
			this.log("entityPublish: [error] entity has no cartesian " + entity.uuid )
			return
		}

		entity.published = 1

		if(!this.socket) {
			return
		}

		let blob = {
			       uuid: entity.uuid,
			  anchorUID: entity.anchorUID,
			       name: entity.name,
			      descr: entity.descr,
			       kind: entity.kind,
			        art: entity.art,
			       tags: entity.tags,
			      party: entity.party,
			  cartesian: entity.cartesian || 0,
			 quaternion: entity.quaternion || 0,
			      euler: entity.euler || 0,
			      scale: entity.scale || 0,
			        //xyz: entity.xyz || 0, - don't publish this because it should be different per instance
			        gps: entity.gps || 0,
			//relocalized: entity.relocalized ? 1 : 0,
			  //published: entity.published ? 1 : 0
		}
		this.socket.emit('publish',blob);
	}

	debugging(session) {

		session.addEventListener(XRSession.NEW_WORLD_ANCHOR,(event) => {
			let entity = 0
			this.entityAll(e=>{ if(e.anchorUID == event.detail.uid) entity = e })
			if(entity) {
				if(entity.kind == "gps") this.log("<font color=green>debug: " + event.detail.uid + " *** ANCHOR GOOD</font>" )
			} else { // if (event.detail.uid.startsWith("anchor")) {
				this.err("debug: " + event.detail.uid + " *** ANCHOR BAD" )
			}
		})

        session.addEventListener(XRSession.REMOVE_WORLD_ANCHOR, (event) => {
        	this.log("debug: deleted " + event.detail.uid)
        })

        session.addEventListener(XRSession.TRACKING_CHANGED, (event) => {

	        // #define WEB_AR_TRACKING_STATE_NORMAL               @"ar_tracking_normal"
	        // #define WEB_AR_TRACKING_STATE_LIMITED              @"ar_tracking_limited"
	        // #define WEB_AR_TRACKING_STATE_LIMITED_INITIALIZING @"ar_tracking_limited_initializing"
	        // #define WEB_AR_TRACKING_STATE_LIMITED_MOTION       @"ar_tracking_limited_excessive_motion"
	        // #define WEB_AR_TRACKING_STATE_LIMITED_FEATURES     @"ar_tracking_limited_insufficient_features"
	        // #define WEB_AR_TRACKING_STATE_NOT_AVAILABLE        @"ar_tracking_not_available"
	        // #define WEB_AR_TRACKING_STATE_RELOCALIZING         @"ar_tracking_relocalizing"

	        let msgText = ""
	   
	        switch (event.detail) {
	            case "unknown": // the initial value
	            case "ar_tracking_normal":
	            break;

	            case "ar_tracking_limited":
	                msgText += "Spatial Tracking <em>Functionality is Limited<em>"
	            break;
	    
	            case "ar_tracking_limited_initializing":
	                msgText += "Spatial Tracking <em>Initializing</em>"
	            break;
	        
	            case "ar_tracking_limited_excessive_motion":
	                msgText += "Spatial Tracking <em>Too Much Motion</em>"
	            break;
	            
	            case "ar_tracking_limited_insufficient_features":
	                msgText += "Spatial Tracking <em>Too Much Motion</em>"
	            break;
	            
	            case "ar_tracking_not_available":
	                msgText += "Spatial Tracking <b>Unavailable</b>"        
	            break;

	            case "ar_tracking_relocalizing":
	                msgText += "Spatial Tracking <b>Relocalizing</b><br>If relocalization does not succeed,<br>reset tracking system from menu"        
	            break;
	        }
	        this.log(msgText)
	     })

     	let periodic = () => {
		    // possible values:
		    // #define WEB_AR_WORLDMAPPING_NOT_AVAILABLE   @"ar_worldmapping_not_available"
		    // #define WEB_AR_WORLDMAPPING_LIMITED         @"ar_worldmapping_limited"
		    // #define WEB_AR_WORLDMAPPING_EXTENDING       @"ar_worldmapping_extending"
		    // #define WEB_AR_WORLDMAPPING_MAPPED          @"ar_worldmapping_mapped"
		    var moreText = ""
		    switch (session.getWorldMappingStatus()) {
		        case "ar_worldmapping_not_available":
		        moreText += "<b>World Map Not Ready</b>, look around the room"
		        break;

		        case "ar_worldmapping_limited":
		        moreText += "<em>World Map of Limited Quality</em>, look around the room"
		        break;

		        case "ar_worldmapping_extending":
		        moreText += "<em>World Map Ready</em>, extending..."
		        break;

		        case "ar_worldmapping_mapped":
		        moreText += "<em>World Map Ready</em>"
		        break;
		    }
		    if(moreText != this.previousMoreText) {
		    	this.previousMoreText = moreText
		    	this.log(moreText)
		    }
		}

		setInterval(periodic,1000)
	}

	//////////////////////////////////////////////////////
	// sovereign self identity

	entityLogout() {
		this.entityParty = 0
		window.localStorage.setItem("priv","")
		window.localStorage.setItem("pub","")
		window.localStorage.setItem("master","")
	}

	async entityRebindToParty(name=0,mnemonic=0,force=0) {

		// store new login or signup keys

		let keypair = 0

		if(name && mnemonic) {

			keypair = mnemonic ? sovereign.mnemonic_to_keypair(mnemonic) : 0

			if(keypair) {
				window.localStorage.setItem("priv",keypair.privateKey)
				window.localStorage.setItem("pub",keypair.publicKey)
				window.localStorage.setItem("master",keypair.masterKey)
			}
		}

		// always fetch keys from storage - to exercise the storage system

		let priv = window.localStorage.getItem("priv")
		let pub = window.localStorage.getItem("pub")
		let master = window.localStorage.getItem("master")

		if(priv && pub && master && master.length > 4) {
			keypair = { privateKey: priv, publicKey: pub, master: master, compressed:true }
		}

		// bail if no keys - no way of reconnecting to a new identity or making a fresh one

		if(!keypair) {
			this.log("Login: did not log party in ")
			return 0
		}

		// sign a generic statement - TODO later have server give me a nonce to sign to help prevent man in the middle attacks

		let signed = sovereign.sign(keypair,"welcome to my world")

		// is there an entity that matches us?

		let results = await this.entityQueryRemote({ kind:"party", signed:signed, edit:true })

		if(results && results.length) {
			this.entityParty = results[0]
			this.log("Login: found party from network " + this.entityParty.name )
			return this.entityParty
		}

		if(!force || !name) {
			return 0
		}

		// establish new entity representing the player - it will eventually publish itself to network

		this.entityParty = this.entityAddParty(name)

		this.log("Login: created new party " + name)

		return this.entityParty
	}

}

