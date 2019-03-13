const htmlEvent = document.getElementById('event');
const htmlMetadata = document.getElementById('metadata');
const htmlMetadataStatus = document.getElementById('metadata-status');
const htmlSubmitButton = document.getElementById('submit-button');

function checkMetadata() {
  const metadata = htmlMetadata.value;

  try {
    const json = JSON.parse(metadata);
    htmlMetadataStatus.textContent = 'JSON OK';
  } catch (err) {
    htmlMetadataStatus.textContent = 'Invalid JSON: ' + err;
  }
}

function updateEventsList(events) {
  console.log(events);
  
  events.forEach(function (event) {
    const newOption = document.createElement("option");
    newOption.value = event.name;
    newOption.textContent = event.name;
    
    htmlEvent.appendChild(newOption);
  })
}

function submit() {
  console.log('PLACEHOLDER: DATA SUBMISSION');
  console.log('Either replace this button with a button.type=submit or hook up submit() to the API.')
}

htmlMetadata.onkeyup = checkMetadata;
htmlMetadata.onblur = checkMetadata;
htmlMetadata.onpaste = checkMetadata;
checkMetadata();

API.events().then(updateEventsList)

htmlSubmitButton.onclick = submit;