const ezgl = {
	gl: null,
	VertexBuffer: class {
		constructor() {
			console.log("Constructed a Vertex Buffer!");

			this.dataLength = 0;
			this.vertexStride = 0;
			this.verticesCount = 0;

			this.glVertexBuffer = ezgl.gl.createBuffer();
			ezgl.gl.bindBuffer(ezgl.gl.ARRAY_BUFFER, this.glVertexBuffer);
		}
		vertexSpecifyLayout(layoutData = [0,3, 1,3]) {
			ezgl.gl.bindBuffer(ezgl.gl.ARRAY_BUFFER, this.glVertexBuffer);

			let stride = 0;
			for(let i = 0; i < layoutData.length; i += 2) { stride += layoutData[i+1] * 4; }

			let offset = 0;
			for(let i = 0; i < layoutData.length; i += 2) {
				ezgl.gl.enableVertexAttribArray(i);
				ezgl.gl.vertexAttribPointer(i, layoutData[i+1], ezgl.gl.FLOAT, false, stride, offset);
				offset += layoutData[i+1] * 4;
			}

			this.vertexStride = stride / 4;
			this.verticesCount = this.dataLength / this.vertexStride;
		}
		supplyData(data) {
			ezgl.gl.bindBuffer(ezgl.gl.ARRAY_BUFFER, this.glVertexBuffer);

			let localData = new Float32Array(data);
			ezgl.gl.bufferData(gl.ARRAY_BUFFER, localData, ezgl.gl.STATIC_DRAW);

			this.dataLength = localData.length;
			this.verticesCount = this.dataLength / this.vertexStride;
		}
		bind() {
			ezgl.gl.bindBuffer(ezgl.gl.ARRAY_BUFFER, this.glVertexBuffer);
		}
		draw() {
			ezgl.gl.bindBuffer(ezgl.gl.ARRAY_BUFFER, this.glVertexBuffer);
			
			ezgl.gl.drawArrays(gl.TRIANGLES, 0, this.verticesCount);
		}
		free() {
			console.log("Destructed a Vertex Buffer!");

			ezgl.gl.deleteBuffer(this.glVertexBuffer);
		}
	},
	Shader: class {
		constructor() {

		}
	},
	Program: class {
		constructor() {

		}
	},
	Rednerer: class {
		constructor() {

		}
	}
};