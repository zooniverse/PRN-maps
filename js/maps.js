const MAP_CONTAINER = document.getElementById('map');
const MAP_THRESHOLD = document.getElementById('map-threshold');
const MAP_SELECT = document.getElementById('map-select');
const MAP_OPTIONS = {
  zoom: 10,
  mapTypeControl: true,
  mapTypeControlOptions: {
    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
    mapTypeIds: ['hybrid', 'satellite', 'roadmap', 'terrain']
  },
  mapTypeId: 'hybrid',
  scaleControl: true,
  streetViewControl: false
}
const HEATMAPS = {};
const HEATMAP_DATA = {};
const HEATMAP_COLOURS = [  // Pre-set colour gradients for each heatmap
  ['transparent', '#844', '#c44', '#f44', '#f00'],
  ['transparent', '#844', '#c44', '#f44', '#f00'],
  ['transparent', '#844', '#c44', '#f44', '#f00'],
  ['transparent', '#844', '#c44', '#f44', '#f00'],
  ['transparent', '#844', '#c44', '#f44', '#f00'],
  ['transparent', '#844', '#c44', '#f44', '#f00'],
];


function queryParams() {
  const queryString = window.location.search.substring(1);
  const queryPairs = queryString.split('&');
  return queryPairs.reduce(function (query, queryPair) {
    const [param, value] = queryPair.split('=');
    query[param] = value;
    return query;
  }, {});
}

function buildLayerInput(layer) {
  const option = document.createElement('label');
  const checkbox = document.createElement('input');
  const text = document.createTextNode(layer.name)
  checkbox.type='checkbox';
  checkbox.value = layer.url;
  checkbox.checked = true;
  option.appendChild(checkbox)
  option.appendChild(text);
  return option;
}
function buildLayersMenu(layers) {
  document.querySelectorAll('#map-select label').forEach(function (node) {
    MAP_SELECT.removeChild(node);
  });
  layers
    .map(buildLayerInput)
    .forEach(function (input) {
      MAP_SELECT.appendChild(input);
    });
}

const eventName = queryParams().event
const getLayers = queryParams().pending ? 'pendingLayers' : 'layers';
API[getLayers](eventName)
  .then(buildLayersMenu)
  .then(renderMapAndFit);

const center = new google.maps.LatLng(15.231458142,-61.2507115);
const map = new google.maps.Map(MAP_CONTAINER, Object.assign(MAP_OPTIONS, { center }));

let bounds;
let fitToBounds = false;

function minimumWeight([lat, lng, weight]) {
  const threshold = parseInt(MAP_THRESHOLD.value);
  return weight > threshold;
}

function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
  bounds.extend(location);
  return { location, weight };
}

function filteredMapData(results) {
  return results.data
    .filter(minimumWeight)
    .map(parseLine);
}

function parseMapData(results, url) {
  // For each heatmap, assign a preset colour to it.
  const numberOfHeatmaps = Object.keys(HEATMAPS).length;
  const colourIndex = numberOfHeatmaps % HEATMAP_COLOURS.length;
  const gradient = HEATMAP_COLOURS[colourIndex];
  
  const heatmap = new google.maps.visualization.HeatmapLayer({
    gradient,
    maxIntensity: 30,
    opacity: .4
  });
  bounds  = new google.maps.LatLngBounds();
  const heatmapData = filteredMapData(results);
  heatmap.setData(heatmapData);
  if (fitToBounds) {
    map.fitBounds(bounds);
    map.panToBounds(bounds);
    fitToBounds = false;
  }
  heatmap.setMap(map);
  HEATMAPS[url] = url ? heatmap : undefined;
}

function cacheMapData(results, file) {
  const url = file.streamer._input;
  console.log(url)
  HEATMAP_DATA[url] = url ? results : undefined;
  parseMapData(results, url); 
}

function readMapFile(url) {
  const config = {
    download: true,
    fastMode: true,
    skipEmptyLines: true,
    chunk: cacheMapData
  }
  console.log(url)
  Papa.parse(url, config);
}

function renderMap() {
  const urls = Object.keys(HEATMAPS);
  urls.forEach(function (url) {
    HEATMAPS[url] && HEATMAPS[url].setMap(null);
  })
  MAP_SELECT.querySelectorAll('input:checked')
    .forEach(function (node) {
      const url = node.value;
      if (HEATMAPS[url]) {
        const heatmapData = filteredMapData(HEATMAP_DATA[url]);
        HEATMAPS[url].setData(heatmapData);
        HEATMAPS[url].setMap(map);
      } else {
        readMapFile(url);
      }
    })
}

function renderMapAndFit() {
  fitToBounds = true;
  renderMap();
}

MAP_SELECT.addEventListener('change', renderMapAndFit);
MAP_THRESHOLD.addEventListener('change', renderMap);
