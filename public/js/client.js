
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



