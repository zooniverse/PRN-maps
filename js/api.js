const API = {
  host: 'http://localhost.pfe-preview.zooniverse.org:3000',
  events: function () {
    return superagent.get(`${API.host}/events`)
    .then(function (response) {
      return JSON.parse(response.text);
    })
    .catch(function (error) {
      console.error(error);
      return [];
    });
  },
  layers: function (eventName) {
    return superagent.get(`${API.host}/layers/${eventName}`)
    .then(function (response) {
      return JSON.parse(response.text);
    })
    .catch(function (error) {
      console.error(error);
      return [];
    });
  }
}