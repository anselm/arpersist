
import {UXPage} from './UXComponents.js'

import {EntityManager} from './EntityManager.js'

import {XRExampleBase} from './common.js'

///
/// UXAugmentedView
///
/// Manages display and user interaction for entities
///

export class UXAugmentedView extends XRExampleBase {

	constructor(entity_manager,arview_target,logging,errors) {

        super(document.getElementById(arview_target),false,true,false,true,true)

        // block the parent class from doing some work that could add a spurious anchor
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

		// attach something to 0,0,0 (although 0,0,0 doesn't mean a lot since arkit can update anchor positions)
        this.scene.add( this.AxesHelper( 0.2 ) );
	}

	///
	/// Called once per frame by base class, before render, to give the app a chance to update this.scene
	///

	async updateScene(frame) {

		// visit all the entities and do useful frame related work
		this.entity_manager.entityUpdate(this.session,frame)

		// mark and sweep
		for(let uuid in this.nodes) { this.nodes[uuid].survives = 0 }

		// visit all the entities again and attach art to them
		this.entity_manager.entityAll((entity)=>{
			// pose is resolved elsewhere - do nothing till it arrives
			if(!entity.pose) return
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
			// local or remote?
			if(entity.transform && entity.anchor) {
				// locally created entities with anchors can in fact go directly from the anchor to the display... it's arguable if this is desired
				node.matrix.fromArray(entity.transform)
				node.matrixAutoUpdate = false
				node.updateMatrixWorld(true)
			} else {
				// the architecture of this system is designed for remote entities over the network with no anchor and just a pose
				// TODO deal with orientation
				node.position.set(entity.pose.x,entity.pose.y,entity.pose.z)
			}
		})

		// remove nodes that did not survive the last round
		let freshnodes = {}
		for(let uuid in this.nodes) {
			let node = this.nodes[uuid]
			if(!node.survives) this.scene.remove(node); else freshnodes[uuid] = node
		}
		this.nodes = freshnodes

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

