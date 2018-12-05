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

export class XRExampleBase {

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

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
	initAnchors() {
		this.requestedFloor = false
		this.floorGroup = new THREE.Group() // This group will eventually be be anchored to the floor (see findFloorAnchor below)
		// an array of info that we'll use in _handleFrame to update the nodes using anchors
		this.anchoredNodes = [] // { XRAnchorOffset, Three.js Object3D }

	}

	_handleAnchors(frame) {

		// If we haven't already, request the floor anchor offset
		if(this.requestedFloor === false){
			this.requestedFloor = true
			frame.findFloorAnchor('first-floor-anchor').then(anchorOffset => {
				if(anchorOffset === null){
					console.log('could not find the floor anchor')
					const headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.EYE_LEVEL)
					const anchorUID = frame.addAnchor(headCoordinateSystem, [0,-1,0])
					anchorOffset = new XRAnchorOffset(anchorUID)
				}
				this.addAnchoredNode(anchorOffset, this.floorGroup)
			}).catch(err => {
				console.error('error finding the floor anchor', err)
			})
		}

		// Update anchored node positions in the scene graph
		for(let anchoredNode of this.anchoredNodes){
			this.updateNodeFromAnchorOffset(frame, anchoredNode.node, anchoredNode.anchorOffset)
		}
	}

	//
	// Add a node to the scene and keep its pose updated using the anchorOffset
	//
	addAnchoredNode(anchorOffset, node){
		this.anchoredNodes.push({
			anchorOffset: anchorOffset,
			node: node
		})
		this.scene.add(node)
	}

	// 
	// Remove a node from the scene
	//
	removeAnchoredNode(node) {
		for (var i = 0; i < this.anchoredNodes.length; i++) {
			if (node === this.anchoredNodes[i].node) {
				this.anchoredNodes.splice(i,1);
                this.scene.remove(node)
				return;
			}
		}
	}

	//
	// Extending classes should override this to get notified when an anchor for node is removed
	//
	anchoredNodeRemoved(node) {
	}
	
	//
	// Get the anchor data from the frame and use it and the anchor offset to update the pose of the node, this must be an Object3D
	//
	updateNodeFromAnchorOffset(frame, node, anchorOffset){
		const anchor = frame.getAnchor(anchorOffset.anchorUID)
		if(anchor === null){
			throttledConsoleLog('Unknown anchor uid', anchorOffset.anchorUID)
			this.anchoredNodeRemoved(node);
			this.removeAnchoredNode(node);
			return
		}
		node.matrixAutoUpdate = false
		node.matrix.fromArray(anchorOffset.getOffsetTransform(anchor.coordinateSystem))
		node.updateMatrixWorld(true)
	}
*/

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
			this.renderer.setClearColor('#000', 0)

			this.initComposer(width,height)

		} else {
			// standalone test code - unused

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
			this.scene.background = new THREE.Color( 0xff00ff )

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
		}

		if(true) {
			// standalone test code unused
			let geometry = new THREE.SphereGeometry( 0.07, 32, 32 ); 
			let material = new THREE.MeshPhongMaterial({ color: '#FF0099' })
			let mesh = new THREE.Mesh(geometry, material)
			mesh.position.set(0,0,-1)
			this.scene.add(mesh)
			this.setOutlined(mesh)
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

/*
function requestFullScreen(){
	if (document.body.requestFullscreen) {
		document.body.requestFullscreen()
	} else if (document.body.msRequestFullscreen) {
		document.body.msRequestFullscreen()
	} else if (document.body.mozRequestFullScreen) {
		document.body.mozRequestFullScreen()
	} else if (document.body.webkitRequestFullscreen) {
		document.body.webkitRequestFullscreen()
	}
}

function exitFullScreen(){
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen()
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen()
	} else if (document.msExitFullscreen) {			
		document.msExitFullscreen()
	}
}
*/
