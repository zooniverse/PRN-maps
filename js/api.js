const API = {
  host: 'http://localhost.pfe-preview.zooniverse.org:3000',
  get: function(path, defaultValue) {
    return superagent.get(`${API.host}${path}`)
    .then(function (response) {
      return JSON.parse(response.text);
    })
    .catch(function (error) {
      console.error(error);
      return defaultValue;
    });
  },
  events: function () {
    return API.get('/events', []);
  },
  layers: function (eventName) {
    return API.get(`/layers/${eventName}`, []);
  },
  manifests: function (eventName) {
    return API.get(`/manifests/${eventName}`, {});
  }
}