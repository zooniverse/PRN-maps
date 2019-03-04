const EVENTS_LIST = document.getElementById('events');
function buildEventLink(event) {
  const link = document.createElement('a');
  link.href = "/maps?event=" + event.name;
  link.textContent = event.name;
  const item = document.createElement('li')
  item.appendChild(link);
  return item;
}

function listEvents(events) {
  events
    .map(buildEventLink)
    .forEach(function (link) {
      EVENTS_LIST.appendChild(link);
    });
}

API.events()
.then(listEvents)