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

var HEATMAP_GROUPS = {};
const HEATMAPS = {};
const HEATMAP_DATA = {};

let HEATMAP_GRADIENT = [  // Pre-set colour gradient - provides the best contrast on a predominantly blue-green map.
  'rgba(255, 0, 0, 0.0)',  // Transparency required as first step to indicate 0-value
  'rgba(255, 0, 0, 1.0)',  // First step should be at opacity 1.0 so points will be visible at full zoom.
  'rgba(255, 0, 0, 0.5)',
  'rgba(255, 64, 64, 0.5)',
  'rgba(255, 128, 64, 0.5)',
  'rgba(255, 255, 64, 0.5)',
];

function buildLayersMenu(layerGroups) {
  console.log('=== ', layerGroups);
  
  // Record data in global store.
  HEATMAP_GROUPS = {};
  layerGroups.forEach(function (group) {
    let layers = {};
    group.layers.forEach(function (layer, index) {
      const metadata = (group.metadata && group.metadata.layers && group.metadata.layers[index]) || {};
      layers[layer.url] = {
        name: layer.name,
        url: layer.url,
        description: metadata.description,
        legend: metadata.legend,
      };
    })
    
    HEATMAP_GROUPS[group.version] = {
      version: group.version,
      name: group.metadata.AOI,
      metadataUrl: group.metadata_url,
      layers,
    };
  });
  
  document.querySelectorAll('#map-select .group').forEach(function (node) {
    MAP_SELECT.removeChild(node);
  });
  layerGroups
    .map(buildLayerGroup)
    .forEach(function (htmlGroup) { MAP_SELECT.appendChild(htmlGroup) });
}

function buildLayerGroup(layerGroup) {
  const htmlGroup = document.createElement('fieldset');
  htmlGroup.id = layerGroup.version;
  htmlGroup.className = 'group';

  const htmlHeader = document.createElement('legend');
  htmlHeader.textContent = (layerGroup.metadata && layerGroup.metadata.AOI)
    ? layerGroup.metadata.AOI
    : layerGroup.version;
  htmlGroup.appendChild(htmlHeader);

  const htmlSubmenu = document.createElement('div');
  htmlSubmenu.className = 'submenu';
  htmlGroup.appendChild(htmlSubmenu);

  const htmlMetadataLink = document.createElement('a');
  htmlMetadataLink.className = 'metadata-link';
  htmlMetadataLink.href = layerGroup.metadata_url;
  htmlMetadataLink.target = '_blank';
  htmlMetadataLink.textContent = 'Metadata';
  htmlSubmenu.appendChild(htmlMetadataLink);

  if (pendingLayers) {
    const htmlApproveButton = document.createElement('button');
    htmlApproveButton.className = 'approve-button';
    htmlApproveButton.textContent = 'Approve';
    htmlSubmenu.appendChild(htmlApproveButton);

    htmlApproveButton.onclick = function (e) {
      htmlApproveButton.textContent = 'Approving...';
      htmlApproveButton.onclick = function (e2) { e2 && e2.preventDefault(); return false };  //Cancel out the approve button

      API.approve(eventName, layerGroup.version)
        .then(function (res) {
          htmlApproveButton.textContent = 'DONE!';
        })
        .catch(function (err) {
          console.error(err);
          htmlApproveButton.textContent = 'ERROR';
        });
      
      e && e.preventDefault();
      return false;
    };
  }

  layerGroup.layers
    .map(function (layer) { return buildLayerInput(layer, layerGroup) })
    .forEach(function (htmlLayer) { htmlGroup.appendChild(htmlLayer) });

  return htmlGroup;
}

function buildLayerInput(layer, layerGroup) {
  const layerMetadata = (layerGroup && layerGroup.metadata && layerGroup.metadata.layers)
    ? layerGroup.metadata.layers.find(function (layermeta) { return layer.url.endsWith(`/${layermeta.file_name}`) })
    : undefined;
  
  const div = document.createElement('div');
  const option = document.createElement('label');
  const checkbox = document.createElement('input');
  const span = document.createElement('span');
  
  span.textContent = (layerMetadata && layerMetadata.description)
    ? layerMetadata.description
    : layer.name;
  
  checkbox.type='checkbox';
  checkbox.value = layer.url;
  checkbox.checked = true;
  
  option.appendChild(checkbox)
  option.appendChild(span);
  div.appendChild(option);
  
  div.dataset.group = layerGroup.version;
  div.dataset.layer = layer.name;
  div.dataset.url = layer.url;
  
  return div;
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

  const heatmap = new google.maps.visualization.HeatmapLayer({
    gradient: HEATMAP_GRADIENT,
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

function readMapFile(url, resolver) {
  const config = {
    download: true,
    fastMode: true,
    skipEmptyLines: true,
    chunk: cacheMapData,
    complete: resolver
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

function renderMap(resolveFunc) {
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
        readMapFile(url, resolveFunc);
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
// pending query param overrides the layer query param
// layer is used to overide the map to only show
// a single layer source, e.g. for snapshots
if (pendingLayers) {
  getLayerFunc = 'pendingLayers';
} else if (layer) {
  getLayerFunc = 'layer';
}

API[getLayerFunc](eventName, layer)
  .then(buildLayersMenu)
  .then(function () {
    if (layer) {
      renderMap(zoomToFit);
    } else {
      renderMap();
      FitEventBounds();
    }
  });
