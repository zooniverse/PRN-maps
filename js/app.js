const mapData = [];
for (let i = 0; i < 5; i++) {
  const mapSource = {
    title: "overlay_" + i,
    url: `test-data/overlay_${i}.csv`
  };
  mapData.push(mapSource);
}
const center = new google.maps.LatLng(15.231458142,-61.2507115);
const map = new google.maps.Map(document.getElementById('map'), {
  center,
  zoom: 10,
  mapTypeId: 'satellite'
});
const bounds  = new google.maps.LatLngBounds();

const heatmap = new google.maps.visualization.HeatmapLayer({
  map,
  opacity: .4
});

function minimumWeight([lat, lng, weight]) {
  return weight > 2;
}

function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
  bounds.extend(location);
  return { location, weight };
}

function parseMapData(results, file) {
  const heatmapData = results.data
    .filter(minimumWeight)
    .map(parseLine);
    heatmap.setData(heatmapData);
  map.fitBounds(bounds);
  map.panToBounds(bounds);
}

function renderMapLayer(index) {
  const config = {
    download: true,
    skipEmptyLines: true,
    complete: parseMapData
  }
  Papa.parse(mapData[index].url, config);
}

function onMapSelect(event) {
  const index = parseInt(event.target.value);
  renderMapLayer(index);
}

renderMapLayer(0);
document.getElementById('map-select').addEventListener('change', onMapSelect);
