// Constants
const CELL_SIZE = 100;
const GLOBAL_SCALE = 0.4;
const FRAMERATE = 4;

const prerendered_patches = [
  {
    file: "surface_code_double.svg",
    id: "surface_code_double",
    width: 2,
    height: 1,
  },
  {
    file: "surface_code.svg",
    id: "surface_code",
    width: 1,
    height: 1,
  },
  {
    file: "magic_state.svg",
    id: "magic_state",
    width: 1,
    height: 1,
  },
  {
    file: "bell_state.svg",
    id: "bell_state",
    width: 1,
    height: 1,
  },
];

const colormap = {
  SingleRowRegisterRegion: "yellow",
  CombShapedRegisterRegion: "yellow",
  MagicStateFactoryRegion: "blue",
  TCultivatorBufferRegion: "blue",
  MagicStateBufferRegion: "red",
  BellRegion: "magenta",
  RouteBus: "green",
};

const symbolmap = {
  bell: { patch: "bell_state" },
  locked: { text: " " },
  reg: { patch: "surface_code" },
  route: { text: " " },
  magic_state: { patch: "magic_state" },
  cultivator: { text: "🌻" },
  reserved: { text: "🚫" },
  unused: { text: " "}, 
  factory_output: { text: " " },
  route_buffer: { text: " " },
  other: { text: "?" },
};

// Global variables
var data; // Data loaded to render
var isPlaying = false;
var savedPlayingState = null;
var currFrame = 0;

var svgNS = "http://www.w3.org/2000/svg";
var svg = document.createElementNS(svgNS, "svg");
var svg_defs = document.createElementNS(svgNS, "defs");
var svg_bg = document.createElementNS(svgNS, "g");
var svg_fg = document.createElementNS(svgNS, "g");

var frameBox = document.getElementById("currTime");
var frameRange = document.getElementById("frameSelector");

var viewBox = svg.viewBox.baseVal;

// Setup
svg.setAttribute("style", "background-color:lightgrey; touch-action:none;");

svg.appendChild(svg_defs);
svg.appendChild(svg_bg);
svg.appendChild(svg_fg);

document.getElementById("mainContainer").appendChild(svg);

// Load prerendered patches
async function loadSVG(uri, id, width, height) {
  var resp = await fetch(uri);
  var text = await resp.text();
  var parser = new DOMParser();
  var svgDoc = parser.parseFromString(text, "image/svg+xml");
  var patchSVG = svgDoc.querySelector("svg");
  patchSVG.setAttribute("id", id);
  patchSVG.setAttribute("width", width * CELL_SIZE + "px");
  patchSVG.setAttribute("height", height * CELL_SIZE + "px");

  svg_defs.appendChild(patchSVG);
}

for (var patch of prerendered_patches) {
  loadSVG(patch.file, patch.id, patch.width, patch.height);
}

// Drawing functions
function roundedRect(x, y, width, height, radius, fill, fill_opacity) {
  var rect = document.createElementNS(svgNS, "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("fill", fill);
  rect.setAttribute("fill-opacity", fill_opacity);
  rect.setAttribute("stroke", "black");
  rect.setAttribute("stroke-width", 0.5);
  rect.setAttribute("rx", radius);
  rect.setAttribute("ry", radius);
  return rect;
}

function pathRect(x, y, width, height) {
  var rect = document.createElementNS(svgNS, "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("fill", "orange");
  rect.setAttribute("fill-opacity", 0.6);
  rect.setAttribute("rx", 1);
  rect.setAttribute("ry", 1);
  return rect;
}

function baseCell(rowIdx, colIdx) {
  var y = (rowIdx + 0.1) * CELL_SIZE;
  var x = (colIdx + 0.1) * CELL_SIZE;

  var width = CELL_SIZE * 0.8;
  var height = CELL_SIZE * 0.8;

  return roundedRect(x, y, width, height, 3, "white", "100%");
}

function drawWidgetRegion(region) {
  var x = region["loc_tl"][1] * CELL_SIZE;
  var y = region["loc_tl"][0] * CELL_SIZE;

  var width = (region["loc_br"][1] - region["loc_tl"][1] + 1) * CELL_SIZE;
  var height = (region["loc_br"][0] - region["loc_tl"][0] + 1) * CELL_SIZE;

  svg_bg.appendChild(
    roundedRect(x, y, width, height, 3, colormap[region["name"]], "20%")
  );

  if ("factories" in region) {
    for (var factory of region["factories"]) {
      var x = (factory["loc_tl"][1] + 0.05) * CELL_SIZE;
      var y = (factory["loc_tl"][0] + 0.05) * CELL_SIZE;

      var width =
        (factory["loc_br"][1] - factory["loc_tl"][1] + 0.9) * CELL_SIZE;
      var height =
        (factory["loc_br"][0] - factory["loc_tl"][0] + 0.9) * CELL_SIZE;

      svg_bg.appendChild(roundedRect(x, y, width, height, 3, "blue", "80%"));
    }
  }
}

function drawBaseLayer(width, height) {
  for (var rowIdx = 0; rowIdx < height; rowIdx++) {
    for (var colIdx = 0; colIdx < width; colIdx++) {
      svg_bg.appendChild(baseCell(rowIdx, colIdx));
      if (data.base_layer.board[rowIdx][colIdx].type == 'reg') {
        drawCellContents(rowIdx, colIdx, data.base_layer.board[rowIdx][colIdx]);
      }
    }
  }
}

function drawCellContents(rowIdx, colIdx, cell) {
  if ("patch" in symbolmap[cell.type]) {
    var x = colIdx * CELL_SIZE;
    var y = rowIdx * CELL_SIZE;
    var text = document.createElementNS(svgNS, "use");
    text.setAttribute("href", `#${symbolmap[cell.type].patch}`);
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    svg_fg.appendChild(text);
  } else {
    var x = colIdx * CELL_SIZE + CELL_SIZE * 0.5;
    var y = rowIdx * CELL_SIZE + CELL_SIZE * 0.55;
    var text = document.createElementNS(svgNS, "text");
    text.setAttribute("font-size", CELL_SIZE * 0.5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.innerHTML = symbolmap[cell["type"]].text;
    if (text.innerHTML == "undefined") {
      console.log(cell);
    }
    svg_fg.appendChild(text);
  }
}

function drawLock(p) {
  if (p[0] == null || p[1] == null) {
    return;
  }
  var x = p[1] * CELL_SIZE + CELL_SIZE * 0.2;
  var y = p[0] * CELL_SIZE + CELL_SIZE * 0.2;
  var width = CELL_SIZE * 0.6;
  var height = CELL_SIZE * 0.6
  svg_fg.appendChild(pathRect(x, y, width, height));
}

function drawRoute(p1, p2) {
  if (p1[0] == null || p1[1] == null || p2[0] == null || p2[1] == null) {
    return;
  }
  if (Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) != 1) {
    return;
  }
  var x, y;
  var width, height;
  if (p1[0] == p2[0]) {
    x = Math.min(p1[1], p2[1]) * CELL_SIZE + CELL_SIZE * 0.8;
    y = Math.min(p1[0], p2[0]) * CELL_SIZE + CELL_SIZE * 0.2;
    width = CELL_SIZE * 0.4;
    height = CELL_SIZE * 0.6;
  } else {
    x = Math.min(p1[1], p2[1]) * CELL_SIZE + CELL_SIZE * 0.2;
    y = Math.min(p1[0], p2[0]) * CELL_SIZE + CELL_SIZE * 0.8;
    width = CELL_SIZE * 0.6;
    height = CELL_SIZE * 0.4;
  }
  svg_fg.appendChild(pathRect(x, y, width, height));
}

function drawLayer(layer) {
  for (const [rowIdx, row] of layer["board"].entries()) {
    for (const [colIdx, cell] of row.entries()) {
      drawCellContents(rowIdx, colIdx, cell);
    }
  }
  for (var gate of layer["gates"]) {
    for (const cell of gate["board"]) {
      drawLock(cell);
    }
    for (var i = 0; i < gate["holds"].length - 1; i++) {
      drawRoute(gate["holds"][i], gate["holds"][i + 1]);
    }
  }
}

function drawDataBackground() {
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "720");

  initialiseViewPort();

  svg_bg.innerHTML = "";

  for (var region of data["regions"]) {
    drawWidgetRegion(region);
  }
  drawBaseLayer(data["width"], data["height"]);

  document.getElementById("tickmarks").innerHTML = "";

  var i;
  for (i = 0; i < data["layers"].length + 9; i += 10) {
    var opt = document.createElement("option");
    opt.setAttribute("value", i);
    opt.setAttribute("label", i);
    document.getElementById("tickmarks").appendChild(opt);
  }
  frameRange.setAttribute("max", i - 10);
}

function loadFile() {
  var file_to_read = document.getElementById("filePicker").files[0];
  var fileread = new FileReader();
  fileread.onload = function (e) {
    var content = e.target.result;
    var intern = JSON.parse(content);
    data = intern;
    drawDataBackground();
    draw();
  };
  fileread.readAsText(file_to_read);
}

function rangeUpdate() {
  if (frameRange.valueAsNumber > data["layers"].length - 1) {
    frameRange.valueAsNumber = data["layers"].length - 1;
  }
  if (frameRange.valueAsNumber != currFrame) {
    currFrame = frameRange.valueAsNumber;
    requestAnimationFrame(draw);
    if (savedPlayingState == null) {
      savedPlayingState = isPlaying;
      isPlaying = false;
    }
  }
}

function rangeDone() {
  if (savedPlayingState !== null) {
    isPlaying = savedPlayingState;
    savedPlayingState = null;
    if (isPlaying) {
      setTimeout(play, 1000 / FRAMERATE);
    }
  }
}

function boxUpdate() {
  if (frameBox.valueAsNumber > data["layers"].length - 1) {
    frameBox.value = data["layers"].length - 1;
  }
  if (frameBox.valueAsNumber != currFrame) {
    currFrame = frameBox.valueAsNumber;
  }
  requestAnimationFrame(draw);
}

function draw() {
  svg_fg.innerHTML = "";
  drawLayer(data["layers"][currFrame]);
  frameBox.value = currFrame;
  frameRange.value = currFrame;
}

function play() {
  currFrame = currFrame + 1;
  if (currFrame > data["layers"].length - 1) {
    return;
  }
  requestAnimationFrame(draw);
  if (isPlaying) {
    setTimeout(play, 1000 / FRAMERATE);
  }
}

function setLightDarkMode(mode) {
  document.querySelector("html").setAttribute("data-bs-theme", mode);
}

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

var default_file;
if (!urlParams.has('file')) {
  default_file = 'example.json';
}
else {
  default_file = urlParams.get('file');
}
if (default_file !== "none") {
  fetch(default_file)
    .then((resp) => resp.json())
    .then((json) => {
      data = json;
      drawDataBackground();
      draw();
    });
}

// Zoom/pan functionality

var isPointerDown = false;
var pointerOrigin;
var deltaZoom = 0;

function getPointFromEvent(event) {
  var point = svg.createSVGPoint();
  if (event.targetTouches) {
    point.x = event.targetTouches[0].clientX;
    point.y = event.targetTouches[0].clientY;
  } else {
    point.x = event.clientX;
    point.y = event.clientY;
  }
  var invertedSVGMatrix = svg.getScreenCTM().inverse();

  return point.matrixTransform(invertedSVGMatrix);
}

async function saveSVG(animated) {
  const opts = {
    types: [
      {
        description: "SVG file",
        accept: { "image/svg+xml": [".svg"] },
      },
    ],
  };
  var svgClone = svg.cloneNode(true);
  if (animated) {
    svgClone.removeChild(svgClone.lastChild);
    for (var i = 0; i < data["layers"].length; i++) {
      svg_fg = document.createElementNS(svgNS, "g");
      svg_fg.setAttribute("visibility", "hidden");

      var anim = document.createElementNS(svgNS, "set");
      anim.setAttribute("id", "frame" + i);
      anim.setAttribute("attributeName", "visibility");
      anim.setAttribute("to", "visible");
      if (i == 0) {
        anim.setAttribute("begin", `0; frame${data["layers"].length - 1}.end`);
      } else {
        anim.setAttribute("begin", `frame${i - 1}.end`);
      }
      anim.setAttribute("dur", 1 / FRAMERATE + "s");

      svg_fg.appendChild(anim);

      drawLayer(data["layers"][i]);
      svgClone.appendChild(svg_fg);
    }

    svg_fg = svg.lastChild;
    draw();
  }
  var svgData = new XMLSerializer().serializeToString(svgClone);

  var handler = await window.showSaveFilePicker(opts);
  var writable = await handler.createWritable();
  await writable.write(svgData);

  await writable.close();
}

function initialiseViewPort() {
  const svg_offset = 0.05 * CELL_SIZE;
  var svg_width = data["width"] * CELL_SIZE + 2 * svg_offset;
  var svg_height = data["height"] * CELL_SIZE + 2 * svg_offset;
  svg.setAttribute(
    "viewBox",
    `${-svg_offset} ${-svg_offset} ${svg_width} ${svg_height}`
  );

  if (viewBox === undefined || viewBox === null) {
    viewBox = svg.viewBox.baseVal;
  }

  var invertedSVGMatrix = svg.getScreenCTM().inverse();
  var rect = svg.getBoundingClientRect();
  var point = svg.createSVGPoint();
  point.x = rect.x;
  point.y = rect.y;
  var viewBoxPos = point.matrixTransform(invertedSVGMatrix);
  point.x += rect.width;
  point.y += rect.height;
  var viewBoxEnd = point.matrixTransform(invertedSVGMatrix);
  viewBox.x = viewBoxPos.x;
  viewBox.y = viewBoxPos.y;
  viewBox.width = viewBoxEnd.x - viewBoxPos.x;
  viewBox.height = viewBoxEnd.y - viewBoxPos.y;
}

function onPointerDown(event) {
  isPointerDown = true;
  pointerOrigin = getPointFromEvent(event);
  event.preventDefault();
  svg.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!isPointerDown) {
    return;
  }
  event.preventDefault();

  var pointerPosition = getPointFromEvent(event);

  viewBox.x -= pointerPosition.x - pointerOrigin.x;
  viewBox.y -= pointerPosition.y - pointerOrigin.y;
}
function onPointerUp(event) {
  isPointerDown = false;
  event.preventDefault();
  svg.releasePointerCapture(event.pointerId);
}

function onWheel(event) {
  deltaZoom += event.deltaY + event.deltaZ;
  var wheelPosition = getPointFromEvent(event);
  function updateViewBoxBounds() {
    var deltaScale = Math.pow(2, deltaZoom / 100);
    deltaZoom = 0;
    viewBox.x = wheelPosition.x * (1 - deltaScale) + viewBox.x * deltaScale;
    viewBox.y = wheelPosition.y * (1 - deltaScale) + viewBox.y * deltaScale;
    viewBox.height *= deltaScale;
    viewBox.width *= deltaScale;
  }
  requestAnimationFrame(updateViewBoxBounds);
  event.preventDefault();
}

svg.addEventListener("pointerdown", onPointerDown);
svg.addEventListener("pointerup", onPointerUp);
svg.addEventListener("pointermove", onPointerMove);

svg.addEventListener("touchStart", onPointerDown);
svg.addEventListener("touchEnd", onPointerUp);

svg.addEventListener("wheel", onWheel);


window.addEventListener("message", (event) => {
  data = event.data;
  drawDataBackground();
  draw();
})