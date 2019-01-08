function parseLine([lat, lng, weight]) {
  const location = new google.maps.LatLng(lat, lng);
  return { location, weight };
}
function parseMapData(results, file) {
  const heatMapData = results.data.map(parseLine);
  console.log(heatMapData);
}
const mapDataURL = '/test-data/overlay_0.csv';
const config = {
  download: true,
  complete: parseMapData
}
Papa.parse(mapDataURL, config);
