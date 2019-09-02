let button = document.getElementById('authBtn')

function handler(){
  chrome.extension.sendMessage({
      action: 'launchOauth'
    })
}

button.onclick = handler
