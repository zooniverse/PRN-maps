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
var TILE_URL = 'http://local.zooniverse.org:8080/data/palu_2018/{z}/{x}/{y}.png';

const layerID = 'palu_2018_before';

function queryParams() {
  const queryString = window.location.search.substring(1);
  const queryPairs = queryString.split('&');
  return queryPairs.reduce(function (query, queryPair) {
    const [param, value] = queryPair.split('=');
    query[param] = value;
    return query;
  }, {});
}

function buildLayersMenu(layers) {
  document.querySelectorAll('#map-select option').forEach(function (node) {
    MAP_SELECT.removeChild(node);
  });
  layers.forEach(function (layer, i) {
    const option = document.createElement('option');
    option.value = layer.url;
    option.text = layer.name;
    MAP_SELECT.add(option);
  });
}

API.events()
.then(function ([event]) {
  const getLayers = queryParams().pending ? 'pendingLayers' : 'layers';
  return API[getLayers](event.name)
})
.then(buildLayersMenu)
.then(renderMapAndFit);

const center = new google.maps.LatLng(15.231458142,-61.2507115);
const map = new google.maps.Map(MAP_CONTAINER, Object.assign(MAP_OPTIONS, { center }));

// create the custom map tiles
var customTileMap = new google.maps.ImageMapType({
  name: layerID,
  getTileUrl: function(coord, zoom) {
    // console.log(coord);
    var url = TILE_URL
      .replace('{x}', coord.x)
      .replace('{y}', coord.y)
      .replace('{z}', zoom);
    return url;
  },
  tileSize: new google.maps.Size(256, 256),
  minZoom: 10,
  maxZoom: 15
});

// add the tile map type as an overlay over the existing
map.overlayMapTypes.insertAt(0, customTileMap);

const heatmap = new google.maps.visualization.HeatmapLayer({
  map,
  maxIntensity: 30,
  opacity: .4
});
let bounds;
let heatmapData;
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

function parseMapData(results) {
  bounds  = new google.maps.LatLngBounds();
  heatmapData = results.data
    .filter(minimumWeight)
    .map(parseLine);
  heatmap.setData(heatmapData);
  if (fitToBounds) {
    map.fitBounds(bounds);
    map.panToBounds(bounds);
    fitToBounds = false;
  }
}

function cacheMapData(results, file) {
  const url = MAP_SELECT.value;
  HEATMAPS[url] = url ? results : undefined;
  parseMapData(results);
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
  const url = MAP_SELECT.value;
  if (HEATMAPS[url]) {
    parseMapData(HEATMAPS[url]);
  } else {
    readMapFile(url);
  }
}

function renderMapAndFit() {
  fitToBounds = true;
  renderMap();
}

MAP_SELECT.addEventListener('change', renderMapAndFit);
MAP_THRESHOLD.addEventListener('change', renderMap);
