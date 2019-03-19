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
      return error;
    });
  },
  approve: function (eventName, versionGroup) {
    return API.post(`/pending/layers/${eventName}/approve/${versionGroup}`);
  },
  events: function () {
    return API.get('/events', []);
  },
  layers: function (eventName) {
    return API.get(`/layers/${eventName}`, []);
  },
  event: function (eventName) {
    return API.get(`/events/${eventName}`, {});
  },
  pendingLayers: function (eventName) {
    return API.get(`/pending/layers/${eventName}`, []);
  }
}
