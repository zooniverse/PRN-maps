const mapDataURL = 'test-data/overlay_3.csv';
const center = new google.maps.LatLng(15.231458142,-61.2507115);
const map = new google.maps.Map(document.getElementById('map'), {
  center,
  zoom: 10,
  mapTypeId: 'satellite'
});
const bounds  = new google.maps.LatLngBounds();

function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
  bounds.extend(location);
  return { location, weight };
}

function parseMapData(results, file) {
  const heatmapData = results.data.map(parseLine);
  const heatmap = new google.maps.visualization.HeatmapLayer({
    data: heatmapData,
    map,
    opacity: .4,
    radius: 200
  });
  map.fitBounds(bounds);
  map.panToBounds(bounds);
}

const config = {
  download: true,
  skipEmptyLines: true,
  complete: parseMapData
}
Papa.parse(mapDataURL, config);
