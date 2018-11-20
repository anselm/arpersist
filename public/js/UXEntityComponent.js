
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// UXEntityComponent
///
/// Manages display and user interaction for entities
///
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class UXEntityComponent extends XRExampleBase {

	constructor(element,zone,party,logging=0) {
        super(element,false,true,false,true,true)
        this.logging = logging || function(msg) { console.log(msg) }
        this.em = new EntityManager(zone,party,logging)
	}

	async restart(args) {
		// start networking
		// wipe any art
		this._entitySelected = 0
		this.em.entityAll((entity)=>{
			if(!entity.node) return
			this.scene.remove(entity.node)
			entity.node = 0
		})
		// reset entities too
		this.em.entitySystemReset()
		// start network or restart it
		await this.em.entityNetworkRestart(args)
	}

	selected() { return this._entitySelected || 0 }

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
		// TODO I'm not happy with this approach - see EventBus for something more flexible
		let command = this.command
		this.command = 0
		if(!command) return 0
		this.logging("UXEntityComponent::actionResolve doing command="+command)
		frame._session = this.session // HACK
		switch(command) {
			case "gps": await this.em.entityAddGPS(frame); break
			case "make": this._entitySelected = await this.em.entityAddArt(frame); break
			case "move": await this.em.entityAddParty(frame); break
			case "save": await this.em.mapSave(frame); break
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
		this.em.entityUpdateAll(frame)
		this.paintScene(frame)
	}

	paintScene(frame) {
		this.em.entityAll((entity)=>{
			if(!entity.pose) return
			if(!entity.node) {
				entity.node = this.createSceneGraphNode(entity.art)
				this.scene.add(entity.node)
			}
			// locally created entities with anchors can in fact go directly from the anchor to the display
			if(entity.transform) {
				entity.node.matrix.fromArray(entity.transform)
				entity.node.matrixAutoUpdate = false
				entity.node.updateMatrixWorld(true)
			} else {
				entity.node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)
			}
		})
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
				this.logging('UXEntityComponent::createSceneGraphNode:: [error] could not load gltf', ...params)
			})
			return group
		}

		// examine the string and decide what the content is - TODO this needs a real proxy such as moz hubs

		if(args.startsWith("http")) {
			let group = new THREE.Group()
			let path = args // "/raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
			loadGLTF(path).then(gltf => {
				group.add(gltf.scene)
			}).catch((...params) =>{
				this.logging('UXEntityComponent::createSceneGraphNode:: [error] cannot load gltf', ...params)
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


}
