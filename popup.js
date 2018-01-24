let button = document.getElementById('authBtn')

  chrome.storage.local.get(['status'], function(storageObj){
    console.log('storageObj is ', storageObj)
    if (storageObj.status === 1){
      button.setAttribute('disabled', true)
    } else {
      button.removeAttribute('disabled')
    }
  })


function handler(){
      chrome.extension.sendMessage({
          action: 'launchOauth'
        })
      chrome.alarms.create('enableButton', {delayInMinutes: .1})
      chrome.storage.local.set({status: 1}, function(){
        chrome.storage.local.get(['status'], function(storageObj){
          console.log('status after click is ', storageObj)
          button.setAttribute('disabled', true)
        })
      })
}

chrome.alarms.onAlarm.addListener(function(){
  console.log('running the alarm')
  chrome.storage.local.set({status: 0}, function(){
    button.removeAttribute('disabled')
  })
  console.log('onAlarm storage status is ', localStorage)
})

button.onclick = handler
