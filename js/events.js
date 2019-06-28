import { API } from './api.js';

const EVENTS_LIST = document.getElementById('events');
function createAnchor(href, textContent) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = textContent;
  return link;
}
function buildEventLinks(event) {
  const eventHref = "/maps?event=" + event.name;
  const pendingHref = eventHref + "&pending=true";
  const uploadHref = "/maps/upload.html?event=" + event.name;
  const eventLink = createAnchor(eventHref, event.name);
  const pendingLink = createAnchor(pendingHref, "pending layers");
  const uploadLink = createAnchor(uploadHref, "upload layers");
  const item = document.createElement('li')
  item.appendChild(eventLink);
  item.appendChild(document.createTextNode(' '));
  item.appendChild(pendingLink);
  item.appendChild(document.createTextNode(' '));
  item.appendChild(uploadLink);
  return item;
}

function listEvents(events) {
  events
    .map(buildEventLinks)
    .forEach(function (link) {
      EVENTS_LIST.appendChild(link);
    });
}

API.events()
.then(listEvents)