/*
Code written by James Griffin <james.griffin@cantab.net>.
See the file LICENSE if that interests you.
To see it running try:
https://jtgriffin.co.uk/rollingshutter/webgl/
or if that doesn't work I've moved it to
https://jtgriffin.co.uk/rollingshutter/
*/


var rs = {
  width: 640,
  height: 480,
  realWidth: 640,
  realHeight: 480,
  flipped: false,
  bankWidth: 6,
  bankHeight: 8,
  bankCapacity: 48,
  numBanks: 2,
  totalCapacity: 96,
  bankBufferWidth: 4096,
  bankBufferHeight: 4096,
  currentSlot: 0,
  time: 0,
  buffers: {
    screenVertices: null,
    screenUVs: null,
    depositVertices: null,
    depositUVs: null
  },
  bank1: {
    buffer: null,
    texture: null
  },
  bank2: {
    buffer: null,
    texture: null
  },
//  maskTexture: null,
  videoTexture: null,
  videoElement: null,
  lastVideoTime: 0,
  depositProgram: null,
  mainProgram: null,
  stats: {
    framerate: 0,
    lastTime: 0,
    debug: false,
    overlayCtx: null
  },
  delayDir: {
    x: 0.0,
    y: -1.0
  },
  delayOffset: 0.0,
  controls: {
    mouseDown: false,
    mouseX: 0,
    mouseY: 0
  }
},
  gl = null;

function initWebGL() {
  var canvas = document.getElementById('rsCanvas');
  // Try experimental-webgl as well, in case anyone is using Edge.
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) {
    window.alert("Unable to initialize WebGL. Your browser may not support it.");
    gl = null;
  } else {
    gl.viewport(0, 0, rs.realWidth, rs.realHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

function initBanks() {
  function initBank(bank) {

    bank.buffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, bank.buffer);

    bank.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bank.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //gl.generateMipmap(gl.TEXTURE_2D);



    //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rs.bankBufferWidth, rs.bankBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, rs.bankBufferWidth, rs.bankBufferHeight, 0, gl.RGB, gl.UNSIGNED_SHORT_5_6_5, null);

    var renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, rs.bankBufferWidth, rs.bankBufferHeight);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bank.texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  initBank(rs.bank1);
  initBank(rs.bank2);
}

function initTextures() {
  //var maskImage, videoImage;
  var videoImage;

  /*function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  rs.maskTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, rs.maskTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255]));
  maskImage = new Image();
  maskImage.onload = function () { handleTextureLoaded(maskImage, rs.maskTexture); };
  maskImage.src = "masktexture.png";*/

  rs.videoTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, rs.videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_SHORT_5_6_5, new Uint16Array([255]));
  //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  updateVideoTexture();
}


function getShader(gl, ids) {
  var shaderScript, theSource, currentChild, shader, id, i;

  if(typeof(ids)==='string') {
    ids = [ids];
  }

  theSource = "";
  for (i=0; i < ids.length; i++) {
    id = ids[i];
    shaderScript = document.getElementById(id);
    if (!shaderScript) {
      return null;
    }

    currentChild = shaderScript.firstChild;

    while (currentChild) {
      if (currentChild.nodeType === currentChild.TEXT_NODE) {
        theSource += currentChild.textContent;
      }
      currentChild = currentChild.nextSibling;
    }
  }

  if (shaderScript.type === "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type === "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    // Unknown shader type
    return null;
  }

  gl.shaderSource(shader, theSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    window.alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs"),
    vertexShader = getShader(gl, "shader-vs");

  rs.depositProgram = gl.createProgram();
  gl.attachShader(rs.depositProgram, vertexShader);
  gl.attachShader(rs.depositProgram, fragmentShader);
  gl.linkProgram(rs.depositProgram);

  if (!gl.getProgramParameter(rs.depositProgram, gl.LINK_STATUS)) {
    window.alert("Unable to initialise the shader program.");
  }

  gl.useProgram(rs.depositProgram);

  rs.depositProgram.textureCoordAttribute = gl.getAttribLocation(rs.depositProgram, "aTextureCoord");
  gl.enableVertexAttribArray(rs.depositProgram.textureCoordAttribute);

  rs.depositProgram.vertexPositionAttribute = gl.getAttribLocation(rs.depositProgram, "aVertexPosition");
  gl.enableVertexAttribArray(rs.depositProgram.vertexPositionAttribute);

  fragmentShader = getShader(gl, ["shader-head-dir-fs2", "shader-tail-fs2"]);
  vertexShader = getShader(gl, "shader-vs2");

  rs.mainProgram = gl.createProgram();
  gl.attachShader(rs.mainProgram, vertexShader);
  gl.attachShader(rs.mainProgram, fragmentShader);
  gl.linkProgram(rs.mainProgram);

  if (!gl.getProgramParameter(rs.mainProgram, gl.LINK_STATUS)) {
    window.alert("Unable to initialise the shader program.");
  }

  gl.useProgram(rs.mainProgram);

  rs.mainProgram.textureCoordAttribute = gl.getAttribLocation(rs.mainProgram, "aTextureCoord");
  gl.enableVertexAttribArray(rs.mainProgram.textureCoordAttribute);

  rs.mainProgram.vertexPositionAttribute = gl.getAttribLocation(rs.mainProgram, "aVertexPosition");
  gl.enableVertexAttribArray(rs.mainProgram.vertexPositionAttribute);

  rs.mainProgram.bankWidthUniform = gl.getUniformLocation(rs.mainProgram, "uNumX");
  rs.mainProgram.bankHeightUniform = gl.getUniformLocation(rs.mainProgram, "uNumY");
//  rs.mainProgram.useMask = gl.getUniformLocation(rs.mainProgram, "uUseMask");
  rs.mainProgram.delayDir = gl.getUniformLocation(rs.mainProgram, "uDelayDir");
  rs.mainProgram.delayOffset = gl.getUniformLocation(rs.mainProgram, "uDelayOffset");
//  rs.mainProgram.viewportSizeUniform = gl.getUniformLocation(rs.mainProgram, "uVPSize");
  rs.mainProgram.depositSizeUniform = gl.getUniformLocation(rs.mainProgram, "uDepositSize");
  rs.mainProgram.bankSizeUniform = gl.getUniformLocation(rs.mainProgram, "uBankSize");
  rs.mainProgram.timeUniform = gl.getUniformLocation(rs.mainProgram, "uTime");

}

function flipXYCoords (coords) {
  var temp,
    i;
  for (i = 0; i < coords.length / 2; i += 1) {
    temp = coords[2*i];
    coords[2*i] = coords[2*i+1];
    coords[2*i+1] = temp;
  }
}

function setUVbuffers () {
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.screenUVs);
  var uvs = [
    0.0, 1.0,
    1.0, 1.0,
    0.0, 0.0,
    1.0, 0.0
  ];
  if (rs.flipped) { flipXYCoords(uvs); }
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.depositUVs);
  var uvs2 = [
    1.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    0.0, 0.0
  ];
  if (rs.flipped) { flipXYCoords(uvs2); }
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs2), gl.STATIC_DRAW);
}

function initGeometry() {
  // Buffer for vertices
  rs.buffers.screenVertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.screenVertices);
  var vertices = [
    1.0, 1.0,
    -1.0, 1.0,
    1.0, -1.0,
    -1.0, -1.0
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Buffer for deposit: vertices
  rs.buffers.depositVertices = gl.createBuffer();

  // Buffers for uv's
  rs.buffers.screenUVs = gl.createBuffer();
  rs.buffers.depositUVs = gl.createBuffer();
  setUVbuffers();
}

function updateVideoTexture() {
  gl.bindTexture(gl.TEXTURE_2D, rs.videoTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // Using SHORT seems to trigger a conversion which takes far longer than we would expect.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_SHORT_5_6_5, rs.videoElement);
  //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rs.videoElement);
  //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, rs.videoElement);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function drawToBank() {
  var slotNo = 0,
    x = 0,
    y = 0,
    w = rs.width / rs.bankBufferWidth,
    h = rs.height / rs.bankBufferHeight,
    videoTime = rs.videoElement.currentTime;

  // If there has been no change in videoTime, then there is no point rendering
  // the image to our Bank.  But this behaves differently between browsers, so
  // is currently disabled.
  //if (rs.lastVideoTime === videoTime) {
  //  return;
  //}
  rs.lastVideoTime = videoTime;

  gl.useProgram(rs.depositProgram);

  if (rs.currentSlot >= rs.bankCapacity) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rs.bank2.buffer);
    slotNo = rs.currentSlot - rs.bankCapacity;
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rs.bank1.buffer);
    slotNo = rs.currentSlot;
  }
  rs.currentSlot = (rs.currentSlot + 1) % rs.totalCapacity;
  x = slotNo % rs.bankWidth;
  y = (slotNo - x) / rs.bankWidth;

  //window.console.log("Rendering " + x.toString() + ', ' + y.toString());
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.depositVertices);
  var vertices = [
    (x + 1.0) * w * 2.0 - 1.0, (y + 1.0) * h * 2.0 - 1.0,
    x * w * 2.0 - 1.0, (y + 1.0) * h * 2.0 - 1.0,
    (x + 1.0) * w * 2.0 - 1.0, y * h * 2.0 - 1.0,
    x * w * 2.0 - 1.0, y * h * 2.0 - 1.0
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Assign buffers to shader attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.depositVertices);
  gl.vertexAttribPointer(rs.depositProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.depositUVs);
  gl.vertexAttribPointer(rs.depositProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

  // Assign textures to shader uniforms
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, rs.videoTexture);
  gl.uniform1i(gl.getUniformLocation(rs.depositProgram, "uSampler"), 0);

  gl.viewport(0, 0, rs.bankBufferWidth, rs.bankBufferHeight);

  // Draw
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawScene() {

  updateOverlay();

//  handleInput();

  //rs.time += 1;
	//if (rs.time > rs.totalCapacity) { rs.time -= rs.totalCapacity; }
  rs.time = (rs.currentSlot + 1) % rs.totalCapacity;
  updateVideoTexture();

  drawToBank();

  gl.viewport(0, 0, rs.realWidth, rs.realHeight);

  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(rs.mainProgram);

  gl.uniform1f(rs.mainProgram.bankWidthUniform, rs.bankWidth);
  gl.uniform1f(rs.mainProgram.bankHeightUniform, rs.bankHeight);
//  gl.uniform1f(rs.mainProgram.useMask, 0);
  gl.uniform2f(rs.mainProgram.delayDir, rs.delayDir.x, rs.delayDir.y);
  gl.uniform1f(rs.mainProgram.delayOffset, rs.delayOffset);
  gl.uniform2f(rs.mainProgram.depositSizeUniform, rs.width, rs.height);
//  gl.uniform2f(rs.mainProgram.viewportSizeUniform, rs.realWidth, rs.realHeight);
  gl.uniform2f(rs.mainProgram.bankSizeUniform, rs.bankBufferWidth, rs.bankBufferHeight);
  gl.uniform1f(rs.mainProgram.timeUniform, rs.time);

  // Assign buffers to shader attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.screenVertices);
  gl.vertexAttribPointer(rs.depositProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, rs.buffers.screenUVs);
  gl.vertexAttribPointer(rs.depositProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

  // Assign textures to shader uniforms
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, rs.bank1.texture);
  gl.uniform1i(gl.getUniformLocation(rs.mainProgram, "uBank1"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, rs.bank2.texture);
  gl.uniform1i(gl.getUniformLocation(rs.mainProgram, "uBank2"), 1);

//  gl.activeTexture(gl.TEXTURE2);
//  gl.bindTexture(gl.TEXTURE_2D, rs.maskTexture);
//  gl.uniform1i(gl.getUniformLocation(rs.mainProgram, "uMask"), 2);

  // Draw
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  window.requestAnimationFrame(drawScene);
}

function loadVideo() {
  var promise = navigator.mediaDevices.getUserMedia( {
    audio: false,
    video: {
      frameRate: { min: 30, ideal: 60 },
      width: 640,
      height: 480
    }
  } );
  promise.then( function(mediaStream) {
    rs.videoElement = document.createElement('video');
    document.getElementsByTagName('body')[0].appendChild(rs.videoElement);
    rs.videoElement.style.display = 'none';
    rs.videoElement.src = window.URL.createObjectURL(mediaStream);
    rs.videoElement.onloadedmetadata = function(e) {
      rs.videoElement.play();
      initEverything();
    }
  } );
}

function initRS() {
  var vE = rs.videoElement,
    vW = vE.videoWidth,
    vH = vE.videoHeight;
  rs.realWidth = vW;
  rs.realHeight = vH;
  rs.aspectRatio = vW / vH;
  if (vW >= vH) {
    rs.width = vW;
    rs.height = vH;
    rs.flipped = false;
  } else {
    rs.width = vH;
    rs.height = vW;
    rs.flipped = true;
  }
  rs.bankWidth = Math.floor(rs.bankBufferWidth / rs.width);
  rs.bankHeight = Math.floor(rs.bankBufferHeight / rs.height);
  rs.bankCapacity = rs.bankWidth * rs.bankHeight;
  rs.totalCapacity = rs.numBanks * rs.bankCapacity;

  var canvas = document.getElementById('rsCanvas');
  var canvasDiv = document.getElementById('rsCanvasDiv');
  canvas.width = rs.realWidth;
  canvas.height = rs.realHeight;
  canvasDiv.style.width = "100vw";
  canvasDiv.style.height = "100vh";
  canvasDiv.style.maxHeight = (100 / rs.aspectRatio).toString() + 'vw';
  canvasDiv.style.maxWidth = (100 * rs.aspectRatio).toString() + 'vh';

  var overlayCanvas = document.getElementById('overlay');
  overlayCanvas.width = rs.realWidth;
  overlayCanvas.height = rs.realHeight;

  rs.videoElement.onresize = function () {
    initRS();
    setUVbuffers();
  }
}


function initOverlay() {
  var overlayElement = document.getElementById('overlay'),
    ctx = overlayElement.getContext('2d'),
    i = 0,
    calculatePosition;

  rs.stats.overlayCtx = ctx,

  calculatePosition = function (e) {
    if (rs.controls.mouseDown) {
      rs.controls.mouseX = (e.pageX - overlayElement.offsetLeft) / overlayElement.offsetWidth;
      rs.controls.mouseY = (e.pageY - overlayElement.offsetTop) / overlayElement.offsetHeight;
      //console.log(rs.controls.mouseX.toString() + ', ' + rs.controls.mouseY.toString());
    }
  }

  rs.stats.dateObject = new Date();
  rs.stats.lastTime = rs.stats.dateObject.getTime();

  overlayElement.onmousedown = function (e) {
    rs.controls.mouseDown = true;
    calculatePosition(e);
  }

  overlayElement.onmouseup = overlay.onmouseout = function () {
    rs.controls.mouseDown = false;
  }

  overlayElement.onmousemove = calculatePosition;
}

function updateOverlay() {
  var currentTime = new Date().getTime(),
    ctx = rs.stats.overlayCtx,
    debugText = [];

  rs.stats.framerate *= 0.8;
  rs.stats.framerate += 0.2 * 1000 / (currentTime - rs.stats.lastTime);
  rs.stats.lastTime = currentTime;

  if (rs.stats.debug) {
    debugText.push('Video resolution: ' + rs.realWidth.toString() + 'x' + rs.realHeight.toString());
    debugText.push('Framerate: ' + Math.floor(rs.stats.framerate).toString());
  }

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Output debug text
  if (rs.stats.debug) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'white';
    ctx.globalAlpha = 0.8;
    for (i = 0; i < debugText.length; i += 1) {
      ctx.fillText(debugText[i], 0, 20 * i + 20);
    }
  }
}

function initEverything() {
  initRS();
  initOverlay();
  initWebGL();
  initBanks();
  initTextures();
  initShaders();
  initGeometry();

  drawScene();
}

function setDirection(i) {
  switch (i) {
    case 0:
      rs.delayDir = { x: 0.0, y: -1.0 };
      break;
    case 1:
      rs.delayDir = { x: 1.0, y: 0.0 };
      break;
    case 2:
      rs.delayDir = { x: 0.0, y: 1.0 };
      break;
    case 3:
      rs.delayDir = { x: -1.0, y: 0.0 };
      break;
  }
}

document.addEventListener("DOMContentLoaded", loadVideo);
