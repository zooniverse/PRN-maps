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

function submit() {
  console.log('PLACEHOLDER: DATA SUBMISSION');
}

htmlMetadata.onkeyup = checkMetadata;
htmlMetadata.onblur = checkMetadata;
htmlMetadata.onpaste = checkMetadata;
checkMetadata();

htmlSubmitButton.onclick = submit;