const mapDataURL = 'test-data/overlay_3.csv';
const center = new google.maps.LatLng(15.231458142,-61.2507115);
const map = new google.maps.Map(document.getElementById('map'), {
  center,
  zoom: 10,
  mapTypeId: 'satellite'
});

function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
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
}

const config = {
  download: true,
  skipEmptyLines: true,
  complete: parseMapData
}
Papa.parse(mapDataURL, config);
