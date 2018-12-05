
/*
	XRExampleBase holds all of the common XR setup, rendering, and teardown code for a THREE.js based app
	It also holds a list of THREE nodes and XRAnchorOffsets which it uses to update the nodes' poses

	Extending classes should be able to focus mainly on rendering their scene and handling user input

	Parameters:
		domElement: an element used to show error messages
		createVirtualReality: if true, create a new empty reality for this app

	WebVR 1.1 displays require that the call to requestPresent be a direct result of an input event like a click.
	If you're trying to use a WebVR 1.1 display then you'll need to pass false in the shouldStartPresenting parameter
	of the constructor and then call this.startPresenting() inside an input event handler.

*/

export class XRExampleBaseModified {

	constructor(domElement, createVirtualReality=true, shouldStartPresenting=true, useComputerVision=false, worldSensing=false, alignEUS=true){

		this.el = domElement

		this.createVirtualReality = createVirtualReality
		this.shouldStartPresenting = shouldStartPresenting
		this.useComputerVision = useComputerVision
		this.alignEUS = alignEUS
		this.worldSensing = worldSensing

		this._boundHandleFrame = this._handleFrame.bind(this) // Useful for setting up the requestAnimationFrame callback

		// Set during the XR.getDisplays call below
		this.displays = null

		// Set during this.startSession below		
		this.display = null
		this.session = null

		if(typeof navigator.XR === 'undefined'){
			this.showMessage('No WebXR API found, usually because the WebXR polyfill has not loaded')
			return
		}

		// Get displays and then request a session
		navigator.XR.getDisplays().then(displays => {
			if(displays.length == 0) {
				this.showMessage('No displays are available')
				return
			}
			this.displays = displays
			this.init3js()
			// Give extending classes the opportunity to initially populate the scene
			this.initializeScene()
			this._startSession()
		}).catch(err => {
			console.error('Error getting XR displays', err)
			this.showMessage('Could not get XR displays')
		})

	}

	_startSession(){

		let sessionInitParameters = {
			exclusive: this.createVirtualReality,
			type: this.createVirtualReality ? XRSession.REALITY : XRSession.AUGMENTATION,
			videoFrames: this.useComputerVision,    //computer_vision_data
			alignEUS: this.alignEUS,
			worldSensing: this.worldSensing
		}
		for(let display of this.displays){
			if(display.supportsSession(sessionInitParameters)){
				this.display = display
				break
			}
		}
		if(this.display === null){
			this.showMessage('Could not find a display for this type of session')
			return
		}
		this.display.requestSession(sessionInitParameters).then(session => {
			this.session = session
			this.session.depthNear = 0.1
			this.session.depthFar = 1000.0

			// Handle session lifecycle events
			this.session.addEventListener('focus', ev => { this.handleSessionFocus(ev) })
			this.session.addEventListener('blur', ev => { this.handleSessionBlur(ev) })
			this.session.addEventListener('end', ev => { this.handleSessionEnded(ev) })

			this.newSession();

			if(this.shouldStartPresenting){
				// VR Displays need startPresenting called due to input events like a click
				this.startPresenting()
			}
		}).catch(err => {
			console.error('Error requesting session', err)
			this.showMessage('Could not initiate the session')
		})
	}

	/*
	  Clients should override to be called when a new session is created
	  */
	newSession() {}

	/*
		Empties this.el, adds a div with the message text, and shows a button to test rendering the scene to this.el
	*/
	showMessage(messageText){
		let messages = document.getElementsByClassName('common-message')
		if(messages.length > 0){
			var message = messages[0]
		} else {
			var message = document.createElement('div')
			message.setAttribute('class', 'common-message')
			this.el.append(message)
		}
		let div = document.createElement('div')
		div.innerHTML = messageText
		message.appendChild(div)
	}

	/*
	WebVR 1.1 displays require that the call to requestPresent be a direct result of an input event like a click.
	If you're trying to set up a VR display, you'll need to pass false in the shouldStartPresenting parameter of the constructor
	and then call this.startPresenting() inside an input event handler.
	*/
	startPresenting(){
		if(this.session === null){
			this.showMessage('Can not start presenting without a session')
			throw new Error('Can not start presenting without a session')
		}

		// Set the session's base layer into which the app will render
		this.session.baseLayer = new XRWebGLLayer(this.session, this.glContext)

		// Handle layer focus events
		this.session.baseLayer.addEventListener('focus', ev => { this.handleLayerFocus(ev) })
		this.session.baseLayer.addEventListener('blur', ev => { this.handleLayerBlur(ev) })

		this.session.requestFrame(this._boundHandleFrame)
	}

	// Extending classes can react to these events
	handleSessionFocus(ev){}
	handleSessionBlur(ev){}
	handleSessionEnded(ev){}
	handleLayerFocus(ev){}
	handleLayerBlur(ev){}

	// set up the video processing
	//
	setVideoWorker(worker){
		this.session.setVideoFrameHandler(worker)
	}

	// request the next frame
	// buffers is an optional parameter, suggesting buffers that could be used
	requestVideoFrame() {
		this.session.requestVideoFrame();
	}

	_handleFrame(frame){
		const nextFrameRequest = this.session.requestFrame(this._boundHandleFrame)
		this.headPose = frame.getDisplayPose(frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL))
		//this._handleAnchors(frame)
		this._handleScene(frame)
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// 3js

	init3js() {

		let width = window.innerWidth || 1024
		let height = window.innerHeight || 1024

		this.scene = new THREE.Scene() // The scene will be rotated and oriented around the camera using the head pose

		this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000) // These values will be overwritten by the projection matrix from ARKit or ARCore
		this.camera.position.set(0,0,0)
		this.scene.add(this.camera)

		if(true) {
			// Create a canvas and context for the session layer
			this.glCanvas = document.createElement('canvas')
			this.glContext = this.glCanvas.getContext('webgl')
			if(this.glContext === null){
				this.showMessage('Could not create a WebGL canvas')
				throw new Error('Could not create GL context')
			}

			// Set up the THREE renderer with the session's layer's glContext
			this.renderer = new THREE.WebGLRenderer({
				canvas: this.glCanvas,
				context: this.glContext,
				antialias: false,
				alpha: true
			})
			this.renderer.setPixelRatio(1)
			this.renderer.autoClear = false
			//this.renderer.setClearColor('#000', 0)

			this.initComposer(width,height)

		} else {
			// standalone test code - unused

            //this.camera.aspect = width / height;
            //this.camera.updateProjectionMatrix();
			//this.scene.background = new THREE.Color( 0xff00ff )

			this.scene.add( new THREE.AmbientLight( 0xaaaaaa, 0.2 ) );
			var light = new THREE.DirectionalLight( 0xddffdd, 0.6 );
			light.position.set( 1, 1, 1 );
			light.castShadow = true;
			light.shadow.mapSize.width = 1024;
			light.shadow.mapSize.height = 1024;
			this.scene.add(light)

			this.renderer = new THREE.WebGLRenderer()
            this.renderer.shadowMap.enabled = true;
            this.renderer.setSize(width,height)
            document.body.appendChild( this.renderer.domElement );
			this.renderer.setClearColor('#000', 0)

			this.initComposer(width,height)

			let scope = this

			var lastTimeStamp;
			var render = function() {
				if(scope.composer) {
					scope.composer.render()
				} else {
					scope.renderer.render( scope.scene, scope.camera );
				}
				requestAnimationFrame( render );
			}
	        requestAnimationFrame( render );

			{
				let geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); 
				let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
				let mesh = new THREE.Mesh(geometry, material)
				mesh.position.set(0,0,-1)
				this.scene.add(mesh)
				this.setOutlined(mesh)
			}

		}

	}

	setOutlined(mesh) {
		if(this.outlinePass) this.outlinePass.selectedObjects = mesh ? [ mesh ] : []
	}

	initComposer(width,height) {

		// an effect

		this.composer = new THREE.EffectComposer( this.renderer )
		this.renderPass = new THREE.RenderPass( this.scene, this.camera )
		this.composer.addPass( this.renderPass )
		let outlinePass = this.outlinePass = new THREE.OutlinePass( new THREE.Vector2( width, height ), this.scene, this.camera )
/*
		outlinePass.edgeStrength = Number( 5 );
		outlinePass.edgeGlow = Number( 1 );
		outlinePass.edgeThickness = Number( 8 );
		outlinePass.pulsePeriod = Number( 1 );
		outlinePass.usePatternTexture =  true;
		//outlinePass.visibleEdgeColor.set( value );
		//outlinePass.hiddenEdgeColor.set( value );
*/
		this.composer.addPass( this.outlinePass )


		let loader = new THREE.TextureLoader();
		loader.load( '/assets/tri_pattern.jpg', (texture) => {
			this.outlinePass.patternTexture = texture;
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;	
		});
		this.effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
		this.effectFXAA.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );
		this.effectFXAA.renderToScreen = true;
		this.composer.addPass( this.effectFXAA );

        this.composer.setSize( width, height );

	}
	
	//
	// Extending classes should override this to set up the scene during class construction
	//
	initializeScene(){}

	//
	// Extending classes that need to update the layer during each frame should override this method
	//
	updateScene(frame){}

	_handleScene(frame) {


		let width = this.session.baseLayer.framebufferWidth || window.innerWidth
		let height = this.session.baseLayer.framebufferHeight || window.innerHeight

		// Let the extending class update the scene before each render
		this.updateScene(frame)

		// Prep THREE.js for the render of each XRView
		this.renderer.autoClear = false
		this.renderer.setSize(width,height, false)
		this.renderer.clear()

		this.camera.matrixAutoUpdate = false

		// Render each view into this.session.baseLayer.context
		for(const view of frame.views){
			// Each XRView has its own projection matrix, so set the camera to use that
			this.camera.matrix.fromArray(view.viewMatrix)
			this.camera.updateMatrixWorld()
			this.camera.projectionMatrix.fromArray(view.projectionMatrix)

			// Set up the renderer to the XRView's viewport and then render
			this.renderer.clearDepth()
			const viewport = view.getViewport(this.session.baseLayer)
			this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
			this.doRender()
		}

	}

	doRender(){
		if(this.composer) {
			this.composer.render()
			return
		} else {
			this.renderer.render(this.scene, this.camera)
		}
	}

}

///
/// UXAugmentedView
///
/// Manages display and user interaction for entities
///

class AugmentedView extends XRExampleBaseModified {

	constructor(entity_manager,dom_element,logging,errors) {

        super(dom_element,false,true,false,true,true)

        this.dom_element = dom_element

        // general settings
        this.params = {}
        this.params.general_object_size = 0.1

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
		directionalLight.position.set(0, 0, 0)

		this.camera.add(directionalLight)

		// attach something to 0,0,0
        //this.scene.add( this.AxesHelper( this.params.general_object_size ) );
	}

	///
	/// Called once per frame by base class, before render, to give the app a chance to update this.scene
	///

	updateScene(frame) {

		if(this.isUpdating) {
			// TODO - this should no longer happen so probably this can be removed
			if(this.isUpdating == 1) this.err("updateScene: called before finished")
			if(this.isUpdating > 99) this.isUpdating = 0
			return
		}
		this.isUpdating = this.isUpdating ? this.isUpdating + 1 : 1

		// visit all the entities and do useful frame related work ( asynchronous )
		this.entity_manager.entityUpdateAll(this.session,frame)

		// mark and sweep - since entities can come and go outside of local scope
		for(let uuid in this.nodes) { this.nodes[uuid].survivor = 0 }

		// visit all the entities again and attach art to them
		this.entity_manager.entityAll((entity)=>{
			// do nothing till ready
			if(!entity.relocalized) return
			// associate visual art with an entity if needed
			let node = this.nodes[entity.uuid]
			// did art change? throw node away - cannot rely on mark and sweep because the entry itself is rewritten below
			if(node && node.art != entity.art) {
				this.log("entity has new art = " + entity.uuid + " " + entity.art )
				this.scene.remove(node)
				node = 0
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
			node.survivor = 1

			// build a transform

			let m = new THREE.Matrix4()
			let xyz = entity.xyz || new THREE.Vector3(0,0,0)
			let s = entity.scale || new THREE.Vector3(1,1,1)
			let q = entity.quaternion || new THREE.Quaternion()
			m.compose(xyz,q,s)
			entity.transform = m

			// test
			//if(entity.xyz) {
			//	node.position.set(entity.xyz.x,entity.xyz.y,entity.xyz.z)
			//}

			if(entity.transform) {
				node.matrix.fromArray(entity.transform.elements)
				node.matrixAutoUpdate = false
				node.updateMatrixWorld(true)
			}
		})

		// remove nodes that don't seem to be used anymore
		for(let uuid in this.nodes) {
			let node = this.nodes[uuid]
			if(node && !node.survivor) {
				this.scene.remove(node)
				delete this.nodes[uuid]
			}
		}

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
		let geometry = new THREE.BufferGeometry();
		geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
		let material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
		return new THREE.LineSegments(geometry, material);
	}


	loadGLTF(url,size){

		// a parent that is a bounding sphere for ray intersection tests
		let geometry = new THREE.SphereGeometry( size, 32, 32 )
		var material = new THREE.MeshBasicMaterial( {color: 0x00ff00 } )
		var group = new THREE.Mesh( geometry, material )

		// load callback
		let callback = (gltf) => {

			if(!gltf || !gltf.scene) {
				return // oh well it tried - doesn't matter if fails
			}

			// start animations
	        if(gltf.animations && gltf.animations.length){
	            let mixer = new THREE.AnimationMixer(gltf.scene)
	            for(let animation of gltf.animations){
	                mixer.clipAction(animation).play()
	            }
	        }

			// center on self
			let bbox = new THREE.Box3().setFromObject(gltf.scene)
		    const scale = size / bbox.getSize().length() * 2;
		    const offset = bbox.getCenter().multiplyScalar(scale);
		    gltf.scene.scale.set(scale, scale, scale);
		    gltf.scene.position.sub(offset);

			group.add(gltf.scene)

			// turn the parent material invisible
			material.visible = false
		}

		// load

		let loader = new THREE.GLTFLoader()
		loader.load("/proxy/"+url, callback )

		// return group before load is sone

		return group
	}


	//
	// This routine cannot fail - must return some 3js mesh of some kind
	//

	createSceneGraphNode(args = 0) {

		let size = this.params && this.params.general_object_size ? this.params.general_object_size : 0.2

		let args2 = args.toLowerCase()

		// a primitive?

		if(args2 == "cylinder") {
			let geometry = new THREE.CylinderGeometry( size/2, size/2, size/2, 32 );
			let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
			return new THREE.Mesh(geometry, material)
		}

		if(args2 == "sphere") {
			let geometry = new THREE.SphereGeometry( size/2, 32, 32 );
			let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
			return new THREE.Mesh(geometry, material)
		}

		if(args == "box" || args == "cube") {
			let geometry = new THREE.BoxBufferGeometry(size, size, size);
			let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
			return new THREE.Mesh(geometry, material)
		}

		// if not an url then force a default url

		if(!args2.startsWith("http")) {
			args = args2 = "https://raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
		}

		 // what is the path? is it an image?

		var parser = document.createElement('a')
		parser.href = args
		let pathname = parser.pathname ? parser.pathname.toLowerCase() : 0

		if(pathname.endsWith(".jpg") || pathname.endsWith(".png") || pathname.endsWith(".gif")) {

			let loader = new THREE.TextureLoader()
		    var texture = loader.load( '/proxy/' + encodeURIComponent(args) )
			texture.minFilter = THREE.LinearFilter

		    let geometry = new THREE.BoxGeometry(0.3,0.3,0.01,10,10)
		    var material = new THREE.MeshLambertMaterial( { map: texture } );
		    //var material = new THREE.MeshLambertMaterial({color: 0xffffff});
		    var mesh = new THREE.Mesh(geometry, material);
		    mesh.receiveShadow = true;
		    return mesh
		}

		// hmm, not something we know?

		if(!pathname.endsWith(".glb") || !pathname.endsWith(".gltf")) {
			args = args2 = "https://raw.githubusercontent.com/mozilla/webxr-polyfill/master/examples/image_detection/DuckyMesh.glb"
		}

		// load what we can

		return this.loadGLTF(args,size)
	}

	selectBest() {

		// the selection strategy at the moment is a ray cast but this is not very good - consider using distance TODO

		if(!this.raycaster) {
			this.raycaster = new THREE.Raycaster()
		}

		// Try pick - this fails to find some geometries TODO

		var point = new THREE.Vector2(0,0)
		this.raycaster.setFromCamera(point, this.camera )
		let intersects = this.raycaster.intersectObjects( this.scene.children )
		let intersect = 0
		for ( var i = 0; i < intersects.length; i++ ) {
			intersect = intersects[i].object
			break
		}

		// show it or nothing

		this.showSelected(intersect)
	}

	showSelected(intersect) {

		// anything?

		let entity = intersect && intersect.uuid ? this.entity_manager.entitySetSelectedByUUID(intersect.uuid) : 0

		// nothing found?

		if(!entity) {

			// set selected to nothing

			this.entity_manager.entitySetSelected(0)

			// disable controls

			if(this.controls) { this.controls.dispose() ; this.controls.uuid = 0 }

			// hide picker art

			// if(this.scenePicker) this.scenePicker.visible = false
			this.setOutlined(0)

			// get out

			return
		}

		this.setOutlined(intersect)

		//this.entity_manager.entitySetSelected(entity) <- implicitly done above

		// make sure controls exist and are attached to the right thing

return
		if(!this.controls || this.controls.uuid != intersect.uuid) {

			if(this.controls) {
				this.controls.dispose()
				this.controls.uuid = 0
			}

			let controls = this.controls = new THREE.TrackballControls( intersect, this.dom_element);
			controls.rotateSpeed = 1.0;
			controls.zoomSpeed = 1.2;
			controls.panSpeed = 0.8;
			controls.noZoom = false;
			controls.noPan = false;
			controls.staticMoving = true;
			controls.dynamicDampingFactor = 0.3;
			controls.uuid = intersect.uuid
		}
	}
}

///
/// ARMain
/// Acts as a shim for the AugmentedView above which can't subclass HTMLElement (and also anyway remains visible all the time)
///

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
		<button style="position:absolute;right:10;top:110" class=uxbutton><img alt="make" src="assets/flatsplatterred.png" onClick="window.push('editor')"></img></button>
		<button style="position:absolute;right:10;top:190" class=uxbutton><img alt="maps" src="assets/flatglobered.png" onClick="window.push('maps')"></img></button>
		<button style="position:absolute;right:10;top:270" class=uxbutton><img alt="profile" src="assets/flatheadred.png" onClick="window.push('profile')"></img></button>
		<button style="position:absolute;right:10;top:350" class=uxbutton><img alt="zones" src="assets/flatshellred.png" onClick="window.push('zones')"></img></button>
		`
	}

	constructor(_id=0,_class=0,entity_manager) {
		super()
  		if(_id) this.id = _id
  		if(_class) this.className = _class
  		this.entity_manager = entity_manager
		this.innerHTML = this.content()
		this.view = new AugmentedView(this.entity_manager,this,this.log,this.err)
	}

	onshow() {
		if(!this.interval)this.interval = setInterval(this.view.selectBest.bind(this.view),100)
	}
	onhide() {
		clearInterval(this.interval); this.interval = 0
	}

}

customElements.define('ar-main', ARMain)

