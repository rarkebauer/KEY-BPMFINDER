let button = document.getElementById('authBtn')

  chrome.storage.local.get(['status'], function(storageObj){
  })


function handler(){
      chrome.extension.sendMessage({
          action: 'launchOauth'
        })
}

chrome.alarms.onAlarm.addListener(function(){
  console.log('onAlarm storage status is ', localStorage)
})

button.onclick = handler
