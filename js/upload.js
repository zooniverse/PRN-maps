const htmlUploadForm = document.getElementById('upload-form');
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

function updateFormAction() {
  const eventName = htmlEvent.value;
  const url = API.host + '/upload/layers/' + eventName;
  htmlUploadForm.action = url;
}

function updateEventsList(events) {
  events.forEach(function (event, index) {
    const newOption = document.createElement("option");
    newOption.value = event.name;
    newOption.textContent = event.name;
    
    htmlEvent.appendChild(newOption);
  });
  
  htmlEvent.selectedIndex = 0;
  updateFormAction();
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
htmlEvent.onchange = updateFormAction;

htmlSubmitButton.onclick = submit;