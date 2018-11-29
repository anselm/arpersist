
import {XRExampleBase} from './common.js'

///
/// UXAugmentedView
///
/// Manages display and user interaction for entities
///

class AugmentedView extends XRExampleBase {

	constructor(entity_manager,dom_element,logging,errors) {

        super(dom_element,false,true,false,true,true)

        // block the parent class from doing some work
		this.requestedFloor = true

		this.entity_manager = entity_manager

		this.log = logging || console.log
		this.err = errors || console.error

		this.nodes = {}

	}

	///
	/// called by parent class - scene geometry and update callback helpers
	///

	initializeScene() {
		this.listenerSetup = false

		// add some light
		this.scene.add(new THREE.AmbientLight('#FFF', 0.2))
		let directionalLight = new THREE.DirectionalLight('#FFF', 0.6)
		directionalLight.position.set(0, 10, 0)
		this.scene.add(directionalLight)

		// attach something to 0,0,0
        this.scene.add( this.AxesHelper( 0.2 ) );
	}

	///
	/// Called once per frame by base class, before render, to give the app a chance to update this.scene
	///

	async updateScene(frame) {

		if(this.isUpdating) {
			if(this.isUpdating == 1) this.err("updateScene: called before finished")
			if(this.isUpdating > 99) this.isUpdating = 0
			return
		}
		this.isUpdating = this.isUpdating ? this.isUpdating + 1 : 1

		// visit all the entities and do useful frame related work
		await this.entity_manager.entityUpdateAll(this.session,frame)

		// mark and sweep
		for(let uuid in this.nodes) { this.nodes[uuid].survives = 0 }

		// visit all the entities again and attach art to them
		this.entity_manager.entityAll((entity)=>{
			// do nothing till ready
			if(!entity.relocalized) return
			// associate visual art with an entity if needed
			let node = this.nodes[entity.uuid]
			// did art change? throw node away
			if(node && node.art != entity.art) {
				this.log("entity has new art = " + entity.uuid + " " + entity.art )
				node = 0 // detach from node - node is already marked as non surviving so it should just go away
			}
			// if invalid node then remake
			if(!node) {
				node = this.createSceneGraphNode(entity.art)
				node.art = entity.art
				node.uuid = entity.uuid
				this.scene.add(node)
				this.nodes[entity.uuid] = node
			}
			// mark as surviving
			node.survives = 1
			// transform to pose

			//if(entity.xyz) {
			//	node.position.set(entity.xyz.x,entity.xyz.y,entity.xyz.z)
			//}

			if(entity.transform) {
				node.matrix.fromArray(entity.transform.elements)
				node.matrixAutoUpdate = false
				node.updateMatrixWorld(true)
			}
		})

		// remove nodes that did not survive the last round
		let freshnodes = {}
		for(let uuid in this.nodes) {
			let node = this.nodes[uuid]
			if(!node.survives) this.scene.remove(node); else freshnodes[uuid] = node
		}
		this.nodes = freshnodes

		this.isUpdating = 0
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
				this.err('createSceneGraphNode:: [error] could not load gltf', ...params)
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
				this.err('createSceneGraphNode:: [error] cannot load gltf', ...params)
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

export class ARMain extends HTMLElement {

	content() {
	return `
		<style>
		.uxbutton {
		border-radius: 2px;
		background: transparent;
		border-style: solid;
		border-color: #aaeeaa;
		margin: 2px;
		padding: 2px;
		width: 64px;
		}
		.uxbutton img {
		width: 60px;
		filter: invert(0) hue-rotate(90deg) drop-shadow(16px 16px 10px rgba(0,0,0,0.9));
		}
		</style>
		<button style="position:absolute;right:10;top:10" class=uxbutton><img alt="make" src="assets/flatsplatterred.png" onClick="window.push('editor')"></img></button>
		<button style="position:absolute;right:10;top:90" class=uxbutton><img alt="maps" src="assets/flatglobered.png" onClick="window.push('maps')"></img></button>
		<button style="position:absolute;right:10;top:170" class=uxbutton><img alt="profile" src="assets/flatheadred.png" onClick="window.push('profile')"></img></button>
		<button style="position:absolute;right:10;top:250" class=uxbutton><img alt="zones" src="assets/flatshellred.png" onClick="window.push('zones')"></img></button>
		`
	}

	constructor(_id=0,_class=0,entity_manager,log,err) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
  		this.entity_manager = entity_manager
  		this.log = log
  		this.err = err
		this.innerHTML = this.content()
		this.view = new AugmentedView(this.entity_manager,this,this.log,this.err)
	}
}

customElements.define('ar-main', ARMain)

