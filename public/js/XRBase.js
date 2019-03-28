

// A helper to provide a warning if the user is not on an ARKit capable device (ARCore is not supported)
function warning() {
  let url = "https://itunes.apple.com/us/app/webxr-viewer/id1295998056?mt=8"
  document.body.innerHTML =
    `<br/><br/><center>
     <div style="color:white;width:80%;background:#400;border:3px solid red">
     Please use the WebXR iOS browser to experience this app.
     <br/><br/>
     <a href="https://itunes.apple.com/us/app/webxr-viewer/id1295998056?mt=8">
     https://itunes.apple.com/us/app/webxr-viewer/id1295998056?mt=8</a></div>
   `
}

export class XRBase {

	constructor(args) {

		// stash args
		this.domElement = args.domElement
		this.createVirtualReality = args.createVirtualReality
		this.shouldStartPresenting = args.shouldStartPresenting
		this.useComputerVision = args.useComputerVision
		this.alignEUS = args.alignEUS
		this.worldSensing = args.worldSensing

		// Useful for setting up the requestAnimationFrame callback
		this._boundHandleFrame = this._handleFrame.bind(this)

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

// This is the first opportunity to verify if device is ARKit capable - ARCore is not supported
if(!this.display._arKitWrapper) {
  warning();
  return
}

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

	// Clients should override to be called when a new session is created
	newSession() {}

	// Empties this.domElement, adds a div with the message text, and shows a button to test rendering the scene to this.el
	showMessage(messageText){
		let messages = document.getElementsByClassName('common-message')
		if(messages.length > 0){
			var message = messages[0]
		} else {
			var message = document.createElement('div')
			message.setAttribute('class', 'common-message')
			this.domElement ? this.domElement.append(message) : document.body.append(message)
		}
		let div = document.createElement('div')
		div.innerHTML = messageText
		message.appendChild(div)
	}

	//  WebVR 1.1 displays require that the call to requestPresent be a direct result of an input event like a click.
	//  If you're trying to set up a VR display, you'll need to pass false in the shouldStartPresenting parameter of the constructor
	//  and then call this.startPresenting() inside an input event handler.
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

	// set up the video processing
	setVideoWorker(worker){
		this.session.setVideoFrameHandler(worker)
	}

	// request the next frame
	requestVideoFrame() {
		this.session.requestVideoFrame();
	}

	_handleFrame(frame) {
		const nextFrameRequest = this.session.requestFrame(this._boundHandleFrame)
		this.headPose = frame.getDisplayPose(frame.getCoordinateSystem(XRCoordinateSystem.HEAD_MODEL))
		this._handleScene(frame)
	}

	init3js() {

		let width = window.innerWidth || 1024
		let height = window.innerHeight || 1024

		this.scene = new THREE.Scene()

		// these values are overridden by the projection matrix from ARKit or ARCore
		this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
		this.camera.position.set(0,0,0)
		this.scene.add(this.camera)

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
	}

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
			this.renderer.render(this.scene, this.camera)
		}

	}

	//
	// Extending classes should override this to complete the 3js scene during class construction
	//
	initializeScene(){}

	//
	// Extending classes that need to update the layer during each frame should override this method
	//
	updateScene(frame){}

	// Extending classes can react to these events
	handleSessionFocus(ev){}
	handleSessionBlur(ev){}
	handleSessionEnded(ev){}
	handleLayerFocus(ev){}
	handleLayerBlur(ev){}
}
