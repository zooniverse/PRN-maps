import { queryParams } from './queryParams.js'

const MAP_CONTAINER = document.getElementById('map');
const MAP_THRESHOLD = document.getElementById('map-threshold');
const MAP_SELECT_FORM = document.getElementById('map-select');
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

// The dots are more visible on the map with a higher weight.
const VISIBLE_WEIGHT_MULTIPLIER = 1;
const VISIBLE_WEIGHT_EXPONENT = 2;
const MAX_INTENSITY = 5;

function minimumWeight([lat, lng, weight]) {
  const threshold = parseInt(MAP_THRESHOLD.value);
  return weight >= threshold;
}

function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
  
  // Actual weight values range from 1-5, so we need to crank that up to make the points visible on the map.
  const visibleWeight = Math.pow((weight), VISIBLE_WEIGHT_EXPONENT) * VISIBLE_WEIGHT_MULTIPLIER;
  
  return { location, weight: visibleWeight };
}

function filteredMapData(results) {
  return results.data
    .filter(minimumWeight)
    .map(parseLine);
}

function selectLayerByUrl (url) {
  const group = Object.values(HEATMAP_GROUPS).find(group => !!group.layers[url]);
  const layer = group && group.layers[url];
  return { group, layer };
}

function parseMapData (results, url) {
  const { group, layer } = selectLayerByUrl(url);
  if (!layer) return;
  
  // For each heatmap, assign a preset colour to it.
  const heatmap = new google.maps.visualization.HeatmapLayer({
    gradient: layer.gradient,
    maxIntensity: MAX_INTENSITY,  // TODO: change level of maxIntensity based on metadata
    opacity: 1
  });
  layer.heatmap = heatmap;
  
  const heatmapData = filteredMapData(results);
  heatmap.setData(heatmapData);
  heatmap.setMap(GOOGLE_MAP);
}

function cacheMapData (results, file) {
  const url = file.streamer._input;
  const { group, layer } = selectLayerByUrl(url);
  if (!layer) return;
  
  layer.csvData = results;
  parseMapData(results, url);
}

function readMapFile (url, resolver) {
  const config = {
    download: true,
    fastMode: true,
    skipEmptyLines: true,
    chunk: cacheMapData,
    complete: resolver
  }
  Papa.parse(url, config);
}

function fitEventBounds() {
  API.event(eventName)
  .then(function (event) {
    const boundingBoxCoords = event.bounding_box_coords;
    if (boundingBoxCoords) {
      const SW = new google.maps.LatLng(boundingBoxCoords[1], boundingBoxCoords[0]);
      const NE = new google.maps.LatLng(boundingBoxCoords[3], boundingBoxCoords[2]);
      const bounds  = new google.maps.LatLngBounds(SW, NE);
      GOOGLE_MAP.fitBounds(bounds);
      GOOGLE_MAP.panToBounds(bounds);
    } else {
      console.log(event);
    }
  })
}

function zoomToFit() {
  const bounds  = new google.maps.LatLngBounds();
  
  // TODO: fix ZoomToFit
  
  /* MAP_SELECT_FORM.querySelectorAll('input:checked')
    .forEach(function (node) {
      const url = node.value;
      const { group, layer } = selectLayerByUrl(url);
      const data = layer.heatmap && layer.heatmap.getData();
      data.forEach(function (point) {
        bounds.extend(point.location);
      });
    });*/
  GOOGLE_MAP.fitBounds(bounds);
  GOOGLE_MAP.panToBounds(bounds);
}

const center = new google.maps.LatLng(15.231458142, -61.2507115);
const GOOGLE_MAP = new google.maps.Map(MAP_CONTAINER, Object.assign(MAP_OPTIONS, { center }));

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

class MapApp {
  constructor () {
    // MAP_SELECT_FORM.addEventListener('change', this.updateSelectedMap);
    MAP_THRESHOLD.addEventListener('change', this.renderMap);
    ZOOM_TO_FIT.addEventListener('click', zoomToFit);
    
    this.fetchMapData();
  }

  fetchMapData () {
    API[getLayerFunc](eventName, layer)
      .then(this.saveMapData.bind(this))
      .then(this.buildMapControls.bind(this))
      .then(function () {
        if (layer) {
          window.mapApp.renderMap(zoomToFit);
        } else {
          window.mapApp.renderMap();
          fitEventBounds();
        }
      });
  }
  
  saveMapData (layerGroups) {
    // Record data in global store.
    HEATMAP_GROUPS = {};
    layerGroups.forEach(function (group) {
      let layers = {};
      group.layers.forEach(function (layer, index) {
        const metadata = (group.metadata && group.metadata.layers && group.metadata.layers[index]) || {};
        layers[layer.url] = {
          name: layer.name,
          group: group.version,
          url: layer.url,
          description: metadata.description,
          legend: metadata.legend,
          colour: this.chooseLayerColour(index),
          gradient: this.chooseLayerGradient(index),
          heatmap: undefined,
          csvData: undefined,
          show: false,
        };
      }.bind(this))

      HEATMAP_GROUPS[group.version] = {
        version: group.version,
        name: group.metadata.AOI,
        metadataUrl: group.metadata_url,
        layers,
      };
    }.bind(this));
    
    return layerGroups;
  }
  
  buildMapControls (layerGroups) {
    document.querySelectorAll('#map-select .group').forEach(function (node) {
      MAP_SELECT_FORM.removeChild(node);
    });
    
    Object.values(HEATMAP_GROUPS)
      .map(this.buildMapControls_groupHtml.bind(this))
      .forEach(function (htmlGroup) { MAP_SELECT_FORM.appendChild(htmlGroup) });
    
    // TODO: select one of the maps.
  }
  
  buildMapControls_groupHtml (layerGroup) {
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
    htmlMetadataLink.href = layerGroup.metadataUrl;
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

    Object.values(layerGroup.layers)
      .map(function (layer) { return this.buildMapControls_layerHtml(layer, layerGroup) }.bind(this))
      .forEach(function (htmlLayer) { htmlGroup.appendChild(htmlLayer) });

    return htmlGroup;
  }
  
  buildMapControls_layerHtml (layer, layerGroup) {
    const div = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');
    const span = document.createElement('span');

    span.textContent = layer.description;

    input.type = 'radio';
    input.name = 'layer-control-input';
    input.value = layer.url;
    input.addEventListener('change', () => {
      this.activateLayer(layer);
    });

    label.style.borderRight = `0.5em solid ${layer.colour}`;
    label.appendChild(input)
    label.appendChild(span);
    div.appendChild(label);

    // Add legends, if any.
    const legends = (layer && layer.legend) || [];
    if (legends && legends.length > 0) {
      const ol = document.createElement('ol');
      ol.className = 'layer-control-legends';
      legends.forEach(function (legend, index) {
        const li = document.createElement('li');
        li.textContent = legend;
        li.dataset.legendValue = index + 1;
        ol.appendChild(li);
      });
      div.appendChild(ol);
    }

    div.className = 'layer-control';
    div.dataset.group = layer.group;
    div.dataset.layer = layer.name;
    div.dataset.url = layer.url;

    return div;
  }
  
  chooseLayerColour (index) {
    const colours = [
      'rgba(255, 255, 0, 1.0)',
      'rgba(255, 0, 255, 1.0)',
      'rgba(0, 255, 255, 1.0)',
      'rgba(255, 0, 0, 1.0)',
      'rgba(0, 255, 0, 1.0)',
    ];
    return colours[Math.min(index, colours.length - 1)];
  }
  
  chooseLayerGradient (index) {
    const colours = [
      [ 'rgba(255, 255, 0, 0.0)', 'rgba(255, 255, 0, 0.5)', ],
      [ 'rgba(255, 0, 255, 0.0)', 'rgba(255, 0, 255, 0.5)', ],
      [ 'rgba(0, 255, 255, 0.0)', 'rgba(0, 255, 255, 0.5)', ],
      [ 'rgba(255, 0, 0, 0.0)', 'rgba(255, 0, 0, 0.5)', ],
      [ 'rgba(0, 255, 0, 0.0)', 'rgba(0, 255, 0, 0.5)', ],
    ];
    return colours[Math.min(index, colours.length - 1)];
  }
  
  renderMap (resolveFunction) {
    // For each map, show/hide them as necessary.
    Object.values(HEATMAP_GROUPS)
      .forEach((group) => {
        group.layers && Object.values(group.layers).forEach((layer) => {
          if (!layer.show) {
            layer.heatmap && layer.heatmap.setMap(null);
          } else {
            if (layer && layer.heatmap) {
              const heatmapData = filteredMapData(layer.csvData);
              layer.heatmap.setData(heatmapData);
              layer.heatmap.setMap(GOOGLE_MAP);
            } else {
              readMapFile(layer.url, resolveFunction);
            }
          }
        });
      });
    this.updateMapControlsUI();
  }
  
  updateMapControlsUI () {
    const threshold = parseInt(MAP_THRESHOLD.value);
    const thresholdMin = Number.parseInt(MAP_THRESHOLD.min);
    const thresholdMax = Number.parseInt(MAP_THRESHOLD.max);

    for (let val = thresholdMin; val <= thresholdMax; val++) {
      const selectedElements = document.querySelectorAll(`.layer-control-legends li[data-legend-value='${val}']`);
      Array.from(selectedElements).forEach(function (element) {
        if (val >= threshold) element.className = 'selected';
        else element.className = 'unselected';
      });
    }
  }
  
  activateLayer (layer) {
    this.deactivateAllLayers();
    layer.show = true;
    this.renderMap();
  }
  
  deactivateAllLayers () {
    Object.values(HEATMAP_GROUPS)
      .forEach((group) => {
        group.layers && Object.values(group.layers).forEach((layer) => {
          layer.show = false;
        });
      });
  }
}

window.mapApp = new MapApp();
