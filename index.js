// Polyfill makes it possible to run WebXR on devices that support only WebVR.
import WebXRPolyfill from "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.module.js";
let polyfill = new WebXRPolyfill();

// XR globals.
let xrButton = document.getElementById("xr-button");
let xrSession = null;
let xrRefSpace = null;

let shader = null;

let controllerVertexBuffer = null;
let controllerTexture = null;
let groundVertexBuffer = null;
let groundTexture = null;
let controllers = [];

// Creates html canvas element and returns it's WebGL 2 context.
function createWebGLContext(glAttribs) {
	glAttribs = glAttribs || {alpha: false};
	let webglCanvas = document.createElement("canvas");
	let context = null;
	context = webglCanvas.getContext("webgl2", glAttribs);
	if(!context) {
		alert("This browser does not support WebGL 2.");
		return null;
	}
	return context;
}

function initXR() {
	if(navigator.xr) {
		navigator.xr.isSessionSupported("immersive-vr").then(function(supported) {
			if(supported) {
				xrButton.addEventListener("click", onButtonClicked);
				xrButton.textContent = "Enter VR";
				xrButton.disabled = false;
			}
		});
	}
}

function onButtonClicked() {
	if(!xrSession) {
		navigator.xr.requestSession("immersive-vr").then(onSessionStarted);
	} else {
		xrSession.end();
	}
}

function onSessionStarted(session) {
	xrSession = session;
	session.addEventListener("end", onSessionEnded);

	gl = createWebGLContext({
		xrCompatible: true,
		webgl2: true
	});

	session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
	session.requestReferenceSpace("local").then(function(refSpace) {
		xrRefSpace = refSpace;
		session.requestAnimationFrame(onXRFrame);
	});

	/* Creating the vertex buffer and setting up the vertex layout */
	const vertices = [
		-0.15, 0.10, 0.10,
			0.0, 0.0,
		0.0, -0.10, -0.10,
			0.5, 1.0,
		0.15, 0.10, 0.10,
			1.0, 0.0
	];
	const vertices2 = [
		-1.0, -1.0, -1.0,
			0.0, 0.0,
		-1.0, -1.0, 1.0,
			0.0, 1.0,
		1.0, -1.0, 1.0,
			1.0, 1.0,
		
		1.0, -1.0, 1.0,
			1.0, 1.0,
		1.0, -1.0, -1.0,
			1.0, 0.0,
		-1.0, -1.0, -1.0,
			0.0, 0.0,
	];

	controllerVertexBuffer = new ezgl.VertexBuffer();
	controllerVertexBuffer.vertexLayout([3, 2]);
	controllerVertexBuffer.vertexData(vertices);

	groundVertexBuffer = new ezgl.VertexBuffer();
	groundVertexBuffer.vertexLayout([3, 2]);
	groundVertexBuffer.vertexData(vertices2);

	const vertCode = "#version 300 es\n\
	precision mediump float;\n\
	\n\
	layout(location = 0) in vec3 a_Position;\n\
	layout(location = 1) in vec2 a_TexCoord;\n\
	\n\
	uniform mat4 u_Projection;\n\
	uniform mat4 u_View;\n\
	uniform mat4 u_Model;\n\
	\n\
	out vec2 v_TexCoord;\n\
	\n\
	void main() {\n\
		gl_Position = u_Projection * u_View * u_Model * vec4(a_Position, 1.0);\n\
		v_TexCoord = a_TexCoord;\n\
		v_TexCoord.y = 1.0 - v_TexCoord.y;\n\
	}";
	const fragCode = "#version 300 es\n\
	precision mediump float;\n\
	\n\
	out vec4 o_Color;\n\
	\n\
	in vec2 v_TexCoord;\n\
	\n\
	uniform sampler2D u_Texture;\n\
	\n\
	void main() {\n\
		o_Color = texture(u_Texture, v_TexCoord);\n\
	}";

	let vS = new ezgl.SubShader(gl.VERTEX_SHADER, vertCode);
	let fS = new ezgl.SubShader(gl.FRAGMENT_SHADER, fragCode);

	shader = new ezgl.Shader();
	shader.join(vS);
	shader.join(fS);
	shader.link();

	fS.free();
	vS.free();

	controllerTexture = new ezgl.Texture();
	controllerTexture.fromFile("/tex.png");
	controllerTexture.bind();

	groundTexture = new ezgl.Texture();
	groundTexture.fromFile("/tex2.png");
	groundTexture.bind();

	gl.enable(gl.DEPTH_TEST);
}
function onSessionEnded(event) {
	xrSession = null;
	groundTexture.free();
	controllerTexture.free();
	shader.free();
	controllerVertexBuffer.free();
	groundVertexBuffer.free();
}

function onControllerUpdate(session, frame) {
	let i = 0;
	for(let inputSource of session.inputSources) {
		if(inputSource.gripSpace) {
			let gripPose = frame.getPose(inputSource.gripSpace, xrRefSpace);
			if(gripPose) {
				controllers[i] = {pose: gripPose, hand: inputSource.handedness};
			}
		}
		i++;
	}
}

function onXRFrame(t, frame) {
	let session = frame.session;
	session.requestAnimationFrame(onXRFrame);

	let pose = frame.getViewerPose(xrRefSpace);

	if(pose) {
		let glLayer = session.renderState.baseLayer;
		
		onControllerUpdate(session, frame);

		gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
		
		gl.clearColor(0.4, 0.7, 0.9, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		
		for(let view of pose.views) {
			let viewport = glLayer.getViewport(view);
			gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

			shader.bind();

			shader.set1i("u_Texture", 0);
			shader.set4x4f("u_Projection", view.projectionMatrix);
			shader.set4x4f("u_View", view.transform.inverse.matrix);
			
			controllerTexture.bind();
			shader.set4x4f("u_Model", controllers[0].pose.transform.matrix);
			controllerVertexBuffer.draw();
			shader.set4x4f("u_Model", controllers[1].pose.transform.matrix);
			controllerVertexBuffer.draw();

			groundTexture.bind()
			shader.set4x4f("u_Model", glMatrix.mat4.create());
			groundVertexBuffer.draw();

			shader.unbind();
		}
	}
}

initXR();