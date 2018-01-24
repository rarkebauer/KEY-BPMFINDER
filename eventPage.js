chrome.runtime.onInstalled.addListener(function(){
  chrome.storage.local.set({status: 0}, function(innerObj){
    chrome.storage.local.get(['status'], function(storageObj){
      console.log('intial status is ', storageObj)
    })
  })
})
const redirectUri = 'redacted'

function makeXhrPostRequest(code, grantType, refreshToken){
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.spotify.com/api/token', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.onload = function(){
      if (xhr.status >= 200 && xhr.status < 300){
          return resolve(xhr.response);
      } else {
        reject(Error({
          status: xhr.status,
          statusTextInElse: xhr.statusText
        }))
      }
    }
    xhr.onerror = function(){
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }

     let requestBody = (refreshToken) ? 'grant_type=' + grantType + '&refresh_token=' + refreshToken + '&client_id=redacted&client_secret=' : 'grant_type=' + grantType + '&code=' + code + '&redirect_uri=' + redirectUri + '&client_id=redacted&client_secret=redacted'
    xhr.send(requestBody)
  })
}

chrome.extension.onMessage.addListener(function(request, sender, sendResponse){
  if (request.action === 'launchOauth'){
    chrome.identity.launchWebAuthFlow({
      url: 'https://accounts.spotify.com/authorize' +
      '?client_id=redacted' +
      '&response_type=code' +
      '&redirect_uri=redacted',
      interactive: true
    },
    function(redirectUrl) {
      let code = redirectUrl.slice(redirectUrl.indexOf('=') + 1)

      makeXhrPostRequest(code, 'authorization_code')
        .then(data => {
          data = JSON.parse(data)
          chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab){
            if (
              changeInfo.status === 'complete' && tab.url.indexOf('spotify') > -1
            || changeInfo.status === 'complete' && tab.url.indexOf('spotify') > -1 && tab.url.indexOf('user') > -1 && tab.url.indexOf('playlists') === -1
          ) {
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
                  chrome.tabs.sendMessage(tabs[0].id, {token: data.access_token}, function(response) {
                    console.log('response is ', response)
                  });
              })
            }
          })
          return data
        })
        .catch(err => console.error(err))
    }) //launch web auth flow

  } //if statment
})// extension event listener
