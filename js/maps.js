import { queryParams } from './queryParams.js';
import { API } from './api.js';

const HTML_MAP_CONTAINER = document.getElementById('map');
const HTML_MAP_THRESHOLD = document.getElementById('map-threshold');
const HTML_MAP_SELECT = document.getElementById('map-select');
const HTML_ZOOM_TO_FIT = document.getElementById('zoom-to-fit');
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

var HEATMAP_DATA = {};  // TODO: move this into MapApp

// The dots are more visible on the map with a higher weight.
const VISIBLE_WEIGHT_MULTIPLIER = 1;
const VISIBLE_WEIGHT_EXPONENT = 2;
const MAX_INTENSITY = 5;

function minimumWeight ([lat, lng, weight]) {
  const threshold = parseInt(HTML_MAP_THRESHOLD.value);
  return weight >= threshold;
}

function parseLine ([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);

  // Actual weight values range from 1-5, so we need to crank that up to make the points visible on the map.
  const visibleWeight = Math.pow((weight), VISIBLE_WEIGHT_EXPONENT) * VISIBLE_WEIGHT_MULTIPLIER;

  return { location, weight: visibleWeight };
}

function filteredMapData (results) {
  return results.data
    .filter(minimumWeight)
    .map(parseLine);
}

function selectAllLayers () {
  return Object.values(HEATMAP_DATA)
    .map(group => {
      return (group.layers && Object.values(group.layers))
        || []
    })
    .flat();
}

function readMapFile (layer, resolveFunction) {
  const config = {
    download: true,
    fastMode: true,
    skipEmptyLines: true,
    chunk: (results, file) => { cacheMapData(results, file, layer) },
    complete: resolveFunction
  }
  Papa.parse(layer.url, config);
}

function cacheMapData (results, file, layer) {
  layer.csvData = results;
  parseMapData(results, layer);
}

function parseMapData (results, layer) {
  // If a heatmap already exists, remove it.
  if (layer.heatmap) layer.heatmap.setMap(null);
  
  // Add the new heatmap
  layer.heatmap = new google.maps.visualization.HeatmapLayer({
    gradient: layer.gradient,
    maxIntensity: MAX_INTENSITY,  // TODO: change level of maxIntensity based on metadata
    opacity: 1
  });
  
  const heatmapData = filteredMapData(results);
  layer.heatmap.setData(heatmapData);
  layer.heatmap.setMap(GOOGLE_MAP);
}

function fitEventBounds () {
  API.event(eventName)
  .then((event) => {
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

function zoomToFit () {
  const bounds  = new google.maps.LatLngBounds();
  selectAllLayers().forEach((layer) => {
    const data = layer.show && layer.heatmap && layer.heatmap.getData() || [];
    data.forEach((point) => {
      bounds.extend(point.location);
    });
  });
  GOOGLE_MAP.fitBounds(bounds);
  GOOGLE_MAP.panToBounds(bounds);
}

const center = new google.maps.LatLng(15.231458142, -61.2507115);
const GOOGLE_MAP = new google.maps.Map(HTML_MAP_CONTAINER, Object.assign(MAP_OPTIONS, { center }));

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
    // HTML_MAP_SELECT.addEventListener('change', this.updateSelectedMap);
    HTML_MAP_THRESHOLD.addEventListener('change', this.renderMap.bind(this));
    HTML_ZOOM_TO_FIT.addEventListener('click', zoomToFit);
    
    this.fetchMapData();
  }

  fetchMapData () {
    API[getLayerFunc](eventName, layer)
      .then(this.saveMapData.bind(this))
      .then(this.buildMapControls.bind(this))
      .then(() => {
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
    HEATMAP_DATA = {};
    layerGroups.forEach((group) => {
      let layers = {};
      group.layers.forEach((layer, index) => {
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
      })

      HEATMAP_DATA[group.version] = {
        version: group.version,
        name: group.metadata.AOI,
        metadataUrl: group.metadata_url,
        layers,
      };
    });
    
    return layerGroups;
  }
  
  buildMapControls (layerGroups) {
    document.querySelectorAll('#map-select .group').forEach((node) => {
      HTML_MAP_SELECT.removeChild(node);
    });
    
    Object.values(HEATMAP_DATA)
      .map(this.buildMapControls_groupHtml.bind(this))
      .forEach((htmlGroup) => { HTML_MAP_SELECT.appendChild(htmlGroup) });
    
    console.log('+++ buildMapControls');
    
    // Select the first layer by default
    const defaultLayer = selectAllLayers()[0];
    defaultLayer && window.mapApp.activateLayer(defaultLayer);
    const defaultRadio = document.getElementsByName('layer-control-input')[0];
    defaultRadio && (defaultRadio.checked = true);
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

      htmlApproveButton.onclick = (e) => {
        htmlApproveButton.textContent = 'Approving...';
        htmlApproveButton.onclick = (e2) => { e2 && e2.preventDefault(); return false };  //Cancel out the approve button

        API.approve(eventName, layerGroup.version)
          .then((res) => {
            htmlApproveButton.textContent = 'DONE!';
          })
          .catch((err) => {
            console.error(err);
            htmlApproveButton.textContent = 'ERROR';
          });

        e && e.preventDefault();
        return false;
      };
    }

    Object.values(layerGroup.layers)
      .map((layer) => { return this.buildMapControls_layerHtml(layer, layerGroup) })
      .forEach((htmlLayer) => { htmlGroup.appendChild(htmlLayer) });

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
      legends.forEach((legend, index) => {
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
    selectAllLayers().forEach((layer) => {
      if (!layer.show) {
        layer.heatmap && layer.heatmap.setMap(null);
      } else {
        if (layer && layer.heatmap) {
          const heatmapData = filteredMapData(layer.csvData);
          layer.heatmap.setData(heatmapData);
          layer.heatmap.setMap(GOOGLE_MAP);
        } else {
          readMapFile(layer, resolveFunction);
        }
      }
    });
    this.updateMapControlsUI();
  }
  
  updateMapControlsUI () {
    const threshold = parseInt(HTML_MAP_THRESHOLD.value);
    const thresholdMin = Number.parseInt(HTML_MAP_THRESHOLD.min);
    const thresholdMax = Number.parseInt(HTML_MAP_THRESHOLD.max);

    for (let val = thresholdMin; val <= thresholdMax; val++) {
      const selectedElements = document.querySelectorAll(`.layer-control-legends li[data-legend-value='${val}']`);
      Array.from(selectedElements).forEach((element) => {
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
    selectAllLayers().forEach((layer) => { layer.show = false; });
  }
}

window.mapApp = new MapApp();
