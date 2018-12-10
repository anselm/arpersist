
// a helper to get gps location
import {XRAnchorCartography} from './XRAnchorCartography.js'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Client side entity state mirroring and networking
///
/// Manages a concept of 'entities' which are networkable collections of art and gps locations
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

	async entityUpdateAll(session,frame) {

		if(this.still_busy) {
			this.still_busy++
			return
		}
		this.still_busy = 1

		try {
			// save arkit map?
			if(this.pleaseSaveMap) {
				this.pleaseSaveMap = 0
				await this._mapSave(session,frame)
			}

			// load arkit map?
			if(this.pleaseLoadMap) {
				let filename = this.pleaseLoadMap
				this.pleaseLoadMap = 0
				await this._mapLoad(session,frame,filename)
			}

			// update all entities
			this.entityAll((entity)=>{
				await this._entityUpdateOne(session,frame,entity)
			})

			if(!this.debugging_setup) {
				this.debugging_setup = 1
				this.debugging(session)
			}
		} catch(e) {
			this.err(e)
		}

		this.still_busy = 0
	}

	async _entityUpdateOne(session,frame,entity) {

		// do not update unless either is a gps anchor or gps anchor exists
		if(!this.entityGPS && entity.kind != "gps") {
			return
		}

		// debugging
		let relocalized_before = entity.relocalized

// TODO - if this entity is the local party then go ahead and remake their anchor

		// relocalize all entities
		XRAnchorCartography.relocalize(frame,entity,this.entityGPS)

		// set gps anchor if at all possible
		if(!this.entityGPS && entity && entity.kind == "gps" && entity.relocalized) {
			this.log("*** entityGPS found " + entity.uuid)
			this.entityGPS = entity
		}

		// debug - report on when things get relocalized except for the party because they move often - maybe a timer would be better TODO
		if(!relocalized_before && entity.relocalized && entity.kind != "party" ) {
			this.log(entity.uuid + " relocalized kind="+entity.kind+" pub="+entity.published)
		}

		// until a gps anchor shows up do not network
		if(!this.entityGPS) {
			return
		}

		// publish?
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
		        art: "cylinder",
		       tags: this.tags,
		      party: this.entityParty ? this.entityParty.party : 0,
		  cartesian: 0,
		 quaternion: 0,
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
		        art: "box",
		       tags: this.tags,
		      party: this.entityParty ? this.entityParty.party : 0,
		  cartesian: 0,
		 quaternion: 0,
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
		        art: "box",
		       tags: this.tags,
		      party: newname,
		  cartesian: 0,
		 quaternion: 0,
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
		this.pleaseSaveMap = 1
		return
	}

	async _mapSave(session,frame) {

		// this is an optional helper - if there is no gps anchor at all then make one (prior to fetching map)
		let entity = this.entityGPS
		if(!entity) {
			entity = this.entityAddGPS()
			await XRAnchorCartography.relocalize(frame,entity,0)
			if(entity.relocalized) {
				this.entityGPS = entity
			}
		}
		if(!this.entityGPS) {
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

		// this engine avoids publishing gps anchors until associated with a saved map

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
				parseFloat(entity.quaternion.x),
				parseFloat(entity.quaternion.y),
				parseFloat(entity.quaternion.z),
				parseFloat(entity.quaternion.w) ) : new THREE.Quaternion()
		entity.published = 1
		entity.relocalized = 0
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
			previous.scale = entity.scale
			previous.xyz = entity.xyz
			previous.gps = entity.gps
			previous.published = 1
			previous.relocalized = 0
			//this.log("entityReceive: remote entity found again and updated " + entity.uuid)
		}
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
			      scale: entity.scale || 0,
			        //xyz: entity.xyz || 0,
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
				if(entity.kind == "gps") this.log("<font color=green>mapLoad: " + event.detail.uid + " *** ANCHOR GOOD</font>" )
			} else { // if (event.detail.uid.startsWith("anchor")) {
				this.err("mapLoad: " + event.detail.uid + " *** ANCHOR BAD" )
			}
		})

        session.addEventListener(XRSession.REMOVE_WORLD_ANCHOR, (event) => {
        	this.log("anchor deleted " + event.detail.uid)
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
}

