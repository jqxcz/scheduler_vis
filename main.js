// Constants
const CELL_SIZE = 100;
const GLOBAL_SCALE = 0.4;
const FRAMERATE = 4;
const colormap = {
  SingleRowRegisterRegion: "red",
  MagicStateFactoryRegion: "blue",
  RouteBus: "green",
};

const symbolmap = {
  bell: "$",
  locked: "🔒",
  reg: "R",
  route: "=",
  magic_state: "✨",
  cultivator: "@",
  reserved: "X",
  factory_output: "@",
  route_buffer: ".",
  other: "?",
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

// Setup
svg.setAttribute("style", "background-color:lightgrey");
// svg.setAttribute('transform-origin', "0 0")
// svg.setAttribute('transform', `scale(1)`)
// svg.setAttribute('overflow', "hidden")

// svg.setAttribute('width', '100%');
// svg.setAttribute('height', '80vh');

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

loadSVG("surface_code_double.svg", "surface_code_double", 2, 1);
loadSVG("surface_code.svg", "surface_code", 1, 1);

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
  rect.setAttribute("fill-opacity", 0.3);
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
    roundedRect(x, y, width, height, 3, colormap[region["name"]], "10%")
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
    }
  }
}

function drawCellContents(rowIdx, colIdx, cell) {
  if (cell["type"] !== "reg") {
    var x = colIdx * CELL_SIZE + CELL_SIZE * 0.2;
    var y = rowIdx * CELL_SIZE + CELL_SIZE * 0.7;
    var text = document.createElementNS(svgNS, "text");
    text.setAttribute("font-size", CELL_SIZE * 0.5);
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.innerHTML = symbolmap[cell["type"]];
    if (text.innerHTML == "undefined") {
      console.log(cell);
    }
    svg_fg.appendChild(text);
  } else {
    var x = colIdx * CELL_SIZE;
    var y = rowIdx * CELL_SIZE;
    var text = document.createElementNS(svgNS, "use");
    text.setAttribute("href", "#surface_code");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    svg_fg.appendChild(text);
  }
}

function drawRoute(p1, p2) {
  if (Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) > 1) {
    return;
  }
  var x = Math.min(p1[1], p2[1]) * CELL_SIZE + CELL_SIZE * 0.2;
  var y = Math.min(p1[0], p2[0]) * CELL_SIZE + CELL_SIZE * 0.2;
  var width, height;
  if (p1[0] == p2[0]) {
    width = CELL_SIZE * 1.6;
    height = CELL_SIZE * 0.6;
  } else {
    width = CELL_SIZE * 0.6;
    height = CELL_SIZE * 1.6;
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
    for (var i = 0; i < gate["holds"].length - 1; i++) {
      drawRoute(gate["holds"][i], gate["holds"][i + 1]);
    }
  }
}

function drawDataBackground() {
  const svg_offset = 0.05 * CELL_SIZE;
  var svg_width = data["width"] * CELL_SIZE + 2 * svg_offset;
  var svg_height = data["height"] * CELL_SIZE + 2 * svg_offset;
  svg.setAttribute(
    "viewBox",
    `${-svg_offset} ${-svg_offset} ${svg_width} ${svg_height}`
  );
  // svg.setAttribute('width', svg_width * GLOBAL_SCALE);
  // svg.setAttribute('height', svg_height * GLOBAL_SCALE);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "720");

  for (var region of data["regions"]) {
    drawWidgetRegion(region);
  }
  drawBaseLayer(data["width"], data["height"]);

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

fetch("test_input3.json")
  .then((resp) => resp.json())
  .then((json) => {
    data = json;
    drawDataBackground();
    draw();
});

// Zoom/pan functionality

var viewBox = svg.viewBox.baseVal;
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

function initialiseViewPort() {
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
}

function onWheel(event) {
  deltaZoom += event.deltaY;
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
}

svg.addEventListener("pointerdown", onPointerDown);
svg.addEventListener("pointerup", onPointerUp);
svg.addEventListener("pointerleave", onPointerUp);
svg.addEventListener("pointermove", onPointerMove);
svg.addEventListener("pointerenter", initialiseViewPort, { once: true });

svg.addEventListener("wheel", onWheel);
