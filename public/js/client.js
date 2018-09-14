
////////////////////////////////////////////////////////////////////////
// client - Sep 11 2018
//
// - publishes entities (which are hashes) to a server
// - busy polls server for updates
// - paints entities to display
// - uses xr ios extensions to anchor entities relative to an anchor
//
// - TODO generate a room UUID per session so that every client instance has its own room
// - TODO do not shovel everything back to client every update - only send back differences
// - TODO do not busy poll
//
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
// position update for now
////////////////////////////////////////////////////////////////////////

let worldPosition = {
	latitude: 0,
	longitude: 0,
	elevation: 0,	// TODO
	orientation: 0	// TODO
}

function startWorldPositionUpdate() {
	navigator.geolocation.watchPosition(function(position) {
		worldPosition.latitude = position.coords.latitude
		worldPosition.longitude = position.coords.longitude
		console.log("World Position is")
		console.log(worldPosition)
	});
}

startWorldPositionUpdate()

////////////////////////////////////////////////////////////////////////
// network and database wrapper for now
////////////////////////////////////////////////////////////////////////

var entities = {}

function postData(url,data) {
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

function entity_broadcast(entity) {
	postData('/api/entity/save',entity).then(result => {
		if(!result || !result.uuid) {
			console.error("failed to save to server")
		} else {
			// save locally if network returns it to us ( we don't need to do this here but can wait for busy poll for now )
			entities[result.uuid] = result
		}
	})
}

function entity_collect(callback_handler) {
	callback_handler(entities)
}

function entity_busy_poll_server() {

	// for now we busy poll - later on a long socket would be wiser

	var d = new Date()
	var n = d.getTime()
	console.log("Busy polling server at time " + n )

	postData('/api/entity/sync',{time:n}).then(results => {

		for(let uuid in results) {
			let entity = results[uuid]
			if(entity.uuid && !entities[entity.uuid]) {
				entities[entity.uuid] = entity
				console.log("Added entity")
				console.log(entity)
			}
		}

		setTimeout(entity_busy_poll_server,1000)

	})

}

function entity_initialize() {
	entity_busy_poll_server()
}

////////////////////////////////////////////////////////////////////////
// anchor example
////////////////////////////////////////////////////////////////////////

class ARAnchorExample extends XRExampleBase {

	constructor(domElement){
		super(domElement, false)
		this.headCoordinateSystem = 0;
		this.addObjectButton = document.createElement('button')
		this.addObjectButton.setAttribute('class', 'add-object-button')
		this.addObjectButton.innerText = 'Add Box'
		this.el.appendChild(this.addObjectButton)

		// initialize an entity management system
		entity_initialize()

		this.addObjectButton.addEventListener('click', this.makeEntity );
	}

	makeEntity() {
		let entity = {
			uuid:0,
			kind:"box",
			x:0,
			y:0,
			z:-0.75,
			latitude: worldPosition.latitude,
			longitude: worldPosition.longitude,
			elevation: 0,
			orientation: 0
		}
		entity_broadcast(entity);
	}

	// Called during construction by parent scope
	initializeScene(){
		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)
	}

	createSceneGraphNode(){
		let geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1)
		let material = new THREE.MeshPhongMaterial({ color: '#FF9999' })
		return new THREE.Mesh(geometry, material)
	}

	updateScene(frame){

		this.headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL)

		entity_collect((unused) => {
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

		})

	}
}

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		try {
			window.pageApp = new ARAnchorExample(document.getElementById('target'))
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





