import { queryParams } from './queryParams.js';
import { API } from './api.js';

const HTML_MAP_CONTAINER = document.getElementById('map');
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
const VISIBLE_WEIGHT_EXPONENT = 1;

// IMPORTANT: for PRN maps, every point on the map has a minimum weight of 1.
// This includes POIs where there's nothing of interest happening. Essentually,
// this means that when we display a heatmap, we essentially clutter the map
// with points EVERYWHERE.
// const MIN_INTENSITY = 1;

// HOTFIX 20190911: ignore what that previous block of code said. They data
// suppliers have now changed the newer data sets so that POIs with nothing
// happening aren't listed, so a weight of 1 actually means something now.
const MIN_INTENSITY = 0;

// IMPORTANT: for PRN maps, there's a known maximum weight. However, for visual
// presentation purposes, we often use a lower artificial max intensity to make
// the heatmap dots more visible on a map.
const MAX_INTENSITY = 4;
const ARTIFICIAL_MAX_INTENSITY = 2;

function minimumWeight ([lat, lng, weight]) {
  return weight > MIN_INTENSITY;
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
  
  if (layer.hasSingleIntensity()) {
    
    // If a heatmap already exists, remove it.
    layer.hideHeatmap();

    // Add the new heatmap
    layer.heatmap = new google.maps.visualization.HeatmapLayer({
      gradient: layer.gradient,
      maxIntensity: ARTIFICIAL_MAX_INTENSITY,
      opacity: 1
    });
    
    layer.showHeatmap(GOOGLE_MAP);
    
  } else {
    
    // If a heatmap already exists, remove it.
    layer.hideHeatmap();

    // Add the new heatmap _for each intensity_ (each legend item = 1 intensity)
    layer.heatmap = [];
    
    layer.legend && layer.legend.forEach((legend, index) => {
      const newHeatmap = new google.maps.visualization.HeatmapLayer({
        gradient: layer.gradient[index],
        maxIntensity: ARTIFICIAL_MAX_INTENSITY,
        opacity: 1
      });
      layer.heatmap.push(newHeatmap);
    });

    layer.showHeatmap(GOOGLE_MAP);

  }
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
    if (layer.hasSingleIntensity()) {
      const data = layer.show && layer.heatmap && layer.heatmap.getData() || [];
      data.forEach((point) => {
        bounds.extend(point.location);
      });
    } else {
      layer.show && layer.heatmap && layer.heatmap.forEach((heatmap) => {
        const data = heatmap.getData();
        data.forEach((point) => {
          bounds.extend(point.location);
        });
      });      
    }
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

/*
A "LayerGroup" is exactly what the name implies. Identified by its 'version'.
 */
class LayerGroup {
  constructor (initialProps) {
    this.version = '',
    this.name = '',
    this.uploadedAt = '';
    this.metadataUrl = '',
    this.layers = [];
    
    Object.assign(this, initialProps);
  }
}

/*
A "Layer" represents a single grouping of data on the map. Identified by its
'url'.

Note: if a Layer has Legends (i.e. it has a range of Intensity values instead
of a single true/false Intensity), it follows a different logic - it has
multiple heatmap objects (instead of one), to reflect each intensity value.
 */
class Layer {
  constructor (initialProps) {
    this.name = '',
    this.group = '',
    this.url = '',
    this.description = '';
    this.legend = [];
    this.colour = [];
    this.gradient = [];
    this.heatmap = undefined;  // Either a single object, or an array.
    this.csvData = undefined;
    this.show = false;
    
    Object.assign(this, initialProps);
  }
  
  hasSingleIntensity () {
    return !this.hasMultipleIntensities();
  }
  
  hasMultipleIntensities () {
    return (this.legend && this.legend.length > 0) || (this.heatmap && Array.isArray(this.heatmap));
  }
  
  showHeatmap (targetMap) {
    if (!this.heatmap) return;
    
    if (this.hasSingleIntensity()) {
      const heatmapData = filteredMapData(this.csvData);
      this.heatmap.setData(heatmapData);
      this.heatmap.setMap(targetMap);
    } else {
      Array.isArray(this.heatmap) && this.heatmap.forEach((heatmap, index) => {
        const intensity = index + MIN_INTENSITY;
        if (intensity == MIN_INTENSITY) return;  // Ignore the minimum intensity, since it's applied to every 'blank' POI
        
        const heatmapData = this.csvData && this.csvData.data
          .filter(([lat, lng, weight]) => {
            return weight == intensity;
          })
          .map(parseLine);
        
        heatmap.setData(heatmapData);
        heatmap.setMap(targetMap);
      });
    }
  }
  
  hideHeatmap () {
    if (!this.heatmap) return;
    
    if (this.hasSingleIntensity()) {
      this.heatmap.setMap(null);
    } else {
      Array.isArray(this.heatmap) && this.heatmap.forEach((heatmap) => {
        heatmap.setMap(null);
      });
    }
  }
}

/*
MapApp is the primary engine for showing and controlling maps on the web page.
 */
class MapApp {
  constructor () {
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
        const hasMultipleIntensities = metadata.legend && metadata.legend.length > 1;
        
        layers[layer.url] = new Layer({
          name: layer.name,
          group: group.version,
          url: layer.url,
          description: metadata.description,
          legend: metadata.legend,
          colour: this.chooseLayerColour(index, hasMultipleIntensities),
          gradient: this.chooseLayerGradient(index, hasMultipleIntensities),
          heatmap: undefined,
          csvData: undefined,
          show: false,
        });
      })

      HEATMAP_DATA[group.version] = new LayerGroup({
        version: group.version,
        name: group.metadata.AOI,
        uploadedAt: group.metadata.uploaded_at,
        metadataUrl: group.metadata_url,
        layers,
      });
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
    htmlHeader.textContent = layerGroup.name || layerGroup.version;
    htmlGroup.appendChild(htmlHeader);
    
    const htmlExtraInfo = document.createElement('div');
    htmlExtraInfo.className = 'extra-info';
    htmlExtraInfo.textContent = `Name: ${layerGroup.name}\r\nVer: ${layerGroup.version}\r\nUploaded: ${layerGroup.uploadedAt}`; 
    htmlGroup.appendChild(htmlExtraInfo);

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

    const colour = (layer.hasSingleIntensity()) ? layer.colour : 'transparent';
    
    label.style.borderRight = `0.5em solid ${colour}`;
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
        li.style.borderRight = `0.5em solid ${layer.colour[index]}`;
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
  
  chooseLayerColour (index, hasMultipleIntensities) {
    if (hasMultipleIntensities) {
      return [
        'rgba(255, 255, 192, 1.0)',
        'rgba(255, 255, 0, 1.0)',
        'rgba(255, 128, 0, 1.0)',
        'rgba(255, 0, 0, 1.0)',
        'rgba(255, 0, 128, 1.0)',
      ];
    }
    
    const colours = [
      'rgba(192, 128, 0, 1.0)',
      'rgba(192, 0, 255, 1.0)',
      'rgba(0, 255, 255, 1.0)',
      'rgba(0, 255, 128, 1.0)',
      'rgba(255, 0, 255, 1.0)',
    ];
    return colours[Math.min(index, colours.length - 1)];
  }
  
  chooseLayerGradient (index, hasMultipleIntensities) {
    if (hasMultipleIntensities) {
      return [
        [ 'rgba(255, 255, 0, 0.0)', 'rgba(255, 255, 192, 0.7)', ],
        [ 'rgba(255, 255, 0, 0.0)', 'rgba(255, 255, 0, 0.7)', ],
        [ 'rgba(255, 255, 0, 0.0)', 'rgba(255, 128, 0, 0.7)', ],
        [ 'rgba(255, 255, 0, 0.0)', 'rgba(255, 0, 0, 0.7)', ],
        [ 'rgba(255, 255, 0, 0.0)', 'rgba(255, 0, 128, 0.7)', ],
      ];
    }
    
    const colours = [
      [ 'rgba(255, 255, 255, 0.0)', 'rgba(192, 128, 0, 0.7)', ],
      [ 'rgba(255, 255, 255, 0.0)', 'rgba(192, 0, 255, 0.7)', ],
      [ 'rgba(255, 255, 255, 0.0)', 'rgba(0, 255, 255, 0.7)', ],
      [ 'rgba(255, 255, 255, 0.0)', 'rgba(0, 255, 128, 0.7)', ],
      [ 'rgba(255, 255, 255, 0.0)', 'rgba(255, 0, 255, 0.7)', ],
    ];
    return colours[Math.min(index, colours.length - 1)];
  }
  
  renderMap (resolveFunction) {
    // For each map, show/hide them as necessary.
    selectAllLayers().forEach((layer) => {
      if (!layer.show) {
        layer.hideHeatmap();
      } else {
        if (layer && layer.heatmap) {
          layer.showHeatmap(GOOGLE_MAP);
          if (resolveFunction) resolveFunction();
        } else {
          readMapFile(layer, resolveFunction);
        }
      }
    });
  }
  
  activateLayer (layer) {
    // If the user activated a layer that's in a different group, it's a good
    // idea to reframe the view to show the new group.
    const autoZoomIsAGoodIdea = this.shouldWeZoomToFit(layer);
    
    this.deactivateAllLayers();
    layer.show = true;
    
    if (autoZoomIsAGoodIdea) {
      this.renderMap(zoomToFit);
    } else {
      this.renderMap();
    }
  }
  
  deactivateAllLayers () {
    selectAllLayers().forEach((layer) => { layer.show = false; });
  }
  
  shouldWeZoomToFit (newlyActivatedLayer = {}) {
    const currentActiveGroup = Object.keys(HEATMAP_DATA).find(groupId => {
      const group = HEATMAP_DATA[groupId];
      return Object.keys(group.layers).find(layerId => group.layers[layerId].show);
    });
    
    return (currentActiveGroup !== newlyActivatedLayer.group);
  }
}

window.mapApp = new MapApp();
