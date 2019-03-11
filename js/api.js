const API = {
  host: 'https://maps-api.planetaryresponsenetwork.org',
  get: function(path, defaultValue) {
    return superagent.get(`${API.host}${path}`)
    .withCredentials()
    .then(function (response) {
      return JSON.parse(response.text);
    })
    .catch(function (error) {
      console.error(error);
      return defaultValue;
    });
  },
  post: function(path, data) {
    return superagent.post(`${API.host}${path}`)
    .send(data)
    .withCredentials()
    .then(function (response) {
      return JSON.parse(response.text);
    })
    .catch(function (error) {
      console.error(error);
      return defaultValue;
    });
  },
  approve: function (eventName) {
    return API.post(`/pending/layers/${eventName}/approve`);
  },
  events: function () {
    return API.get('/events', []);
  },
  layers: function (eventName) {
    return API.get(`/layers/${eventName}`, []);
  },
  manifests: function (eventName) {
    return API.get(`/manifests/${eventName}`, {});
  },
  pendingLayers: function (eventName) {
    return API.get(`/pending/layers/${eventName}`, []);
  }
}