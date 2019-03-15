const htmlUploadForm = document.getElementById('upload-form');
const htmlEventList = document.getElementById('event-list');
const htmlStatusText = document.getElementById('status-text');
const htmlMetadataFile = document.getElementById('metadata-file');
const htmlLayersFiles = document.getElementById('layers-files');
//const htmlMetadata = document.getElementById('metadata');
//const htmlMetadataStatus = document.getElementById('metadata-status');
const htmlSubmitButton = document.getElementById('submit-button');

/*function checkMetadata() {
  const metadata = htmlMetadata.value;

  try {
    const json = JSON.parse(metadata);
    htmlMetadataStatus.textContent = 'JSON OK';
  } catch (err) {
    htmlMetadataStatus.textContent = 'Invalid JSON: ' + err;
  }
}*/

function updateFormAction() {
  const eventName = htmlEventList.value;
  const url = API.host + '/upload/layers/' + eventName;
  htmlUploadForm.action = url;
  
  htmlStatusText.textContent = 'Files will be uploaded to ' + eventName;
}

function updateEventsList(events) {
  events.forEach(function (event, index) {
    const newOption = document.createElement('option');
    newOption.value = event.name;
    newOption.textContent = event.name;
    
    htmlEventList.appendChild(newOption);
  });
  
  htmlEventList.selectedIndex = 0;
  updateFormAction();
}

function submit() {
  htmlStatusText.textContent = 'Uploading...';
  
  const request = superagent
    .post(htmlUploadForm.action)
    .withCredentials();
  
  // Attach the metadata file
  if (htmlMetadataFile.files.length > 0) {                                    
    request.attach(htmlMetadataFile.name, htmlMetadataFile.files[0]);
  }
  
  // Attach each Layer file
  Array.from(htmlLayersFiles.files).forEach(function (file) {
    request.attach(htmlLayersFiles.name, file);
  });
  
  // Send!
  request.then(function onUploadComplete(res) {
    console.log('onUploadComplete', res);
    
    if (!res.ok) {
      throw 'General Error - server returned ' + res.status;
    }
    
    htmlStatusText.textContent = '[Upload Complete] All OK!';
  })
  .catch(function onUploadError(err) {
    let errorMessage = err;
    
    if (err.response && err.response.body && err.response.body.errors) {
      errorMessage = err.response.body.errors.join(' ; ');
    }
    
    console.error('onUploadError: ', err);
    htmlStatusText.textContent = '[Upload Error] ' + errorMessage;
  });
}

/*htmlMetadata.onkeyup = checkMetadata;
htmlMetadata.onblur = checkMetadata;
htmlMetadata.onpaste = checkMetadata;
checkMetadata();*/

API.events().then(updateEventsList)
htmlEventList.onchange = updateFormAction;

htmlSubmitButton.onclick = submit;