// Polyfill makes it possible to run WebXR on devices that support only WebVR.
import WebXRPolyfill from "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.module.js";
let polyfill = new WebXRPolyfill();

// XR globals.
let xrButton = document.getElementById("xr-button");
let xrSession = null;
let xrRefSpace = null		
// WebGL scene globals.
let gl = null;

let glObjs = {vertexbuffer: null, vertexarray: null, program: null};

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
	glObjs.vertexarray = gl.createVertexArray();
	gl.bindVertexArray(glObjs.vertexarray);

	const vertices = [
		-0.5, -0.5, -1.0,
			1.0, 0.0, 0.0, 1.0,
		0.0, 0.5, -1.0,
			0.0, 1.0, 0.0, 1.0,
		0.5, -0.5, -1.0,
			0.0, 0.0, 1.0, 1.0
	];
	glObjs.vertexbuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, glObjs.vertexbuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	
	gl.bindVertexArray(glObjs.vertexarray);

	gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 7*4, 0);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 7*4, 3*4);
	gl.enableVertexAttribArray(1);
	
	gl.bindVertexArray(null); /* we have to unbind the vertex array, because WebXR does some vertex layout setting on it's own later, and we don't want it to influence our vertex array */
	
	/* Creating and compiling shaders and combining them into a program */
	const vertCode = "#version 300 es\n\
	precision mediump float;\n\
	\n\
	layout(location = 0) in vec3 a_Position;\n\
	layout(location = 1) in vec4 a_Color;\n\
	\n\
	uniform mat4 u_Projection;\n\
	uniform mat4 u_View;\n\
	\n\
	out vec4 v_Color;\n\
	\n\
	void main() {\n\
		gl_Position = u_Projection * u_View * vec4(a_Position, 1.0);\n\
		v_Color = a_Color;\n\
	}";
	let vertShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertShader, vertCode);
	gl.compileShader(vertShader);
	
	const fragCode = "#version 300 es\n\
	precision mediump float;\n\
	\n\
	out vec4 o_Color;\n\
	\n\
	in vec4 v_Color;\n\
	\n\
	void main() {\n\
		o_Color = v_Color;\n\
	}";
	let fragShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragShader, fragCode);
	gl.compileShader(fragShader);
	
	glObjs.program = gl.createProgram();
	gl.attachShader(glObjs.program, vertShader);
	gl.attachShader(glObjs.program, fragShader);
	gl.linkProgram(glObjs.program);
	gl.useProgram(glObjs.program);

}
function onSessionEnded(event) {
	xrSession = null;
}

function onXRFrame(t, frame) {
	let session = frame.session;
	session.requestAnimationFrame(onXRFrame);

	let pose = frame.getViewerPose(xrRefSpace);

	if(pose) {
		let glLayer = session.renderState.baseLayer;
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
		
		gl.clearColor(0.4, 0.7, 0.9, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		
		for(let view of pose.views) {
			let viewport = glLayer.getViewport(view);
			gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

			gl.useProgram(glObjs.program);
			gl.bindVertexArray(glObjs.vertexarray);
			gl.bindBuffer(gl.ARRAY_BUFFER, glObjs.vertexbuffer);

			let pLoc = gl.getUniformLocation(glObjs.program, "u_Projection");
			gl.uniformMatrix4fv(pLoc, false, view.projectionMatrix);
			let vLoc = gl.getUniformLocation(glObjs.program, "u_View");
			gl.uniformMatrix4fv(vLoc, false, view.transform.inverse.matrix);

			gl.drawArrays(gl.TRIANGLES, 0, 3);

			gl.bindVertexArray(null); /* the same reason as previously */

			//renderScene(view.projectionMatrix, view.transform);
		}
	}
}

initXR();