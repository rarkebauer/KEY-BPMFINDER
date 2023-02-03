let button = document.getElementById('authBtn')

function handler(){
  chrome.extension.sendMessage({
      clientId: document.querySelector('#client_id').value,
      clientSecret: document.querySelector('#client_secret').value,
      action: 'launchOauth'
    })
}

button.onclick = handler
