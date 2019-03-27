import { queryParams } from './queryParams.js'

const MAP_CONTAINER = document.getElementById('map');
const MAP_THRESHOLD = document.getElementById('map-threshold');
const MAP_SELECT = document.getElementById('map-select');
const ZOOM_TO_FIT = document.getElementById('zoom-to-fit');
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

let HEATMAP_COLOURS = [  // Pre-set colour gradients for each heatmap
  ['rgba(204, 068, 068, 0.0)', 'rgba(204, 068, 068, 0.6)', 'rgba(255, 136, 136, 0.6)'],  // Red
  ['rgba(204, 204, 068, 0.0)', 'rgba(204, 204, 068, 0.6)', 'rgba(255, 255, 136, 0.6)'],  // Yellow
  ['rgba(068, 204, 204, 0.0)', 'rgba(068, 204, 204, 0.6)', 'rgba(136, 255, 255, 0.6)'],  // Cyan
  ['rgba(068, 204, 068, 0.0)', 'rgba(068, 204, 068, 0.6)', 'rgba(136, 255, 136, 0.6)'],  // Green
  ['rgba(204, 068, 204, 0.0)', 'rgba(204, 068, 204, 0.6)', 'rgba(255, 136, 255, 0.6)'],  // Magenta
  ['rgba(068, 068, 204, 0.0)', 'rgba(068, 068, 204, 0.6)', 'rgba(136, 136, 255, 0.6)'],  // Blue
];
// Pad the colour gradient to favour the high-intensity colours.
// We need at least 8 steps in the gradient - the first being transparent - for this to look good.
HEATMAP_COLOURS = HEATMAP_COLOURS.map(function spreadColours(arr) {
  return [arr[0], arr[1], arr[1], arr[1], arr[2], arr[2], arr[2], arr[2]];
});

function buildLayersMenu(layers) {
  document.querySelectorAll('#map-select .group').forEach(function (node) {
    MAP_SELECT.removeChild(node);
  });
  layers
    .map(buildLayerGroup)
    .forEach(function (htmlGroup) { MAP_SELECT.appendChild(htmlGroup) });
}
function buildLayerGroup(versionGroup) {
  const htmlGroup = document.createElement('fieldset');
  htmlGroup.className = 'group';

  const htmlHeader = document.createElement('legend');
  htmlHeader.textContent = versionGroup.version;
  htmlGroup.appendChild(htmlHeader);

  const htmlSubmenu = document.createElement('div');
  htmlSubmenu.className = 'submenu';
  htmlGroup.appendChild(htmlSubmenu);

  const htmlMetadataLink = document.createElement('a');
  htmlMetadataLink.className = 'metadata-link';
  htmlMetadataLink.href = versionGroup.metadata_url;
  htmlMetadataLink.target = '_blank';
  htmlMetadataLink.textContent = 'Metadata';
  htmlSubmenu.appendChild(htmlMetadataLink);

  if (pendingLayers) {
    const htmlApproveButton = document.createElement('button');
    htmlApproveButton.className = 'approve-button';
    htmlApproveButton.textContent = 'Approve';
    htmlSubmenu.appendChild(htmlApproveButton);

    htmlApproveButton.onclick = function() {
      htmlApproveButton.textContent = 'Approving...';
      htmlApproveButton.onclick = undefined;

      API.approve(eventName, versionGroup.version)
        .then(function (res) {
          if (!res.ok) {
            throw 'General Error - server returned ' + res.status;
          }
          htmlApproveButton.textContent = 'DONE!';
        })
        .catch(function (err) {
          console.error(err);
          htmlApproveButton.textContent = 'ERROR';
        });
    };
  }

  versionGroup.layers
    .map(buildLayerInput)
    .forEach(function (htmlLayer) { htmlGroup.appendChild(htmlLayer) });

  return htmlGroup;
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

function minimumWeight([lat, lng, weight]) {
  const threshold = parseInt(MAP_THRESHOLD.value);
  return weight > threshold;
}

function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
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
  const heatmapColour = HEATMAP_COLOURS[colourIndex];

  const heatmap = new google.maps.visualization.HeatmapLayer({
    gradient: heatmapColour,
    maxIntensity: 30,
    opacity: 1
  });
  const heatmapData = filteredMapData(results);
  heatmap.setData(heatmapData);
  heatmap.setMap(map);
  HEATMAPS[url] = url ? heatmap : undefined;
}

function cacheMapData(results, file) {
  const url = file.streamer._input;
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
  Papa.parse(url, config);
}

function toggleLayer(event) {
  const url = event.target.value;
  if (event.target.checked) {
    if (HEATMAPS[url]) {
      HEATMAPS[url].setMap(map);
    } else {
      readMapFile(url);
    }
  } else {
    HEATMAPS[url] && HEATMAPS[url].setMap(null);
  }
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

function FitEventBounds() {
  API.event(eventName)
  .then(function (event) {
    const boundingBoxCoords = event.bounding_box_coords;
    if (boundingBoxCoords) {
      const SW = new google.maps.LatLng(boundingBoxCoords[1], boundingBoxCoords[0]);
      const NE = new google.maps.LatLng(boundingBoxCoords[3], boundingBoxCoords[2]);
      const bounds  = new google.maps.LatLngBounds(SW, NE);
      map.fitBounds(bounds);
      map.panToBounds(bounds);
    } else {
      console.log(event);
    }
  })
}

function zoomToFit() {
  const bounds  = new google.maps.LatLngBounds();
  MAP_SELECT.querySelectorAll('input:checked')
    .forEach(function (node) {
      const url = node.value;
      const data = HEATMAPS[url] && HEATMAPS[url].getData();
      data.forEach(function (point) {
        bounds.extend(point.location);
      });
    });
  map.fitBounds(bounds);
  map.panToBounds(bounds);

}

MAP_SELECT.addEventListener('change', toggleLayer);
MAP_THRESHOLD.addEventListener('change', renderMap);
ZOOM_TO_FIT.addEventListener('click', zoomToFit);

const center = new google.maps.LatLng(15.231458142, -61.2507115);
const map = new google.maps.Map(MAP_CONTAINER, Object.assign(MAP_OPTIONS, { center }));

const eventName = queryParams().event;
const pendingLayers = queryParams().pending;
let getLayerFunc = 'layers';
let layer = queryParams().layer;
let zoomFunc = FitEventBounds;
// pending query param overrides the layer query param
// layer is used to overide the map to only show
// a single layer source, e.g. for snapshots
if (pendingLayers) {
  getLayerFunc = 'pendingLayers';
} else if (layer) {
  getLayerFunc = 'layer';
  zoomFunc = zoomToFit;
}

API[getLayerFunc](eventName, layer)
  .then(buildLayersMenu)
  .then(renderMap)
  .then(zoomFunc);
