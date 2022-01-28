// Original author Rachel Arkebauer, 2018-2019
// Adapted by Alexandre Hamelin, 2022

chrome.runtime.onInstalled.addListener(function(){
  chrome.storage.local.set({status: 0}, function(innerObj){
    chrome.storage.local.get(['status'], function(storageObj){
      console.log('intial status is ', storageObj)
    })
  })
})
const redirectUri = 'https://$CHROME_TOKEN.chromiumapp.org/success'

function makeXhrPostRequest(code, grantType, clientId, clientSecret){
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    let refreshToken = '';
    xhr.open('POST', 'https://accounts.spotify.com/api/token', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(clientId + ':' + clientSecret))
    xhr.onload = function(){
      if (xhr.status >= 200 && xhr.status < 300){
          return resolve(xhr.response);
      } else {
        reject(Error(JSON.stringify({
          status: xhr.status,
          statusTextInElse: xhr.statusText
        })
        ))
      }
    }
    xhr.onerror = function(){
      reject(Error({
        status: xhr.status,
        statusText: xhr.statusText
      }))
    }

     let requestBody = (refreshToken) ? 'grant_type=' + grantType + '&refresh_token=' + refreshToken + '&client_id=$SPOTIFY_CLIENT_ID&client_secret=$SPOTIFY_CLIENT_SECRET' : 'grant_type=' + grantType + '&code=' + code + '&redirect_uri=' + redirectUri + '&client_id=$SPOTIFY_CLIENT_ID&client_secret=$SPOTIFY_CLIENT_SECRET'
    requestBody = `grant_type=${grantType}`; // experimenting with no webflow, force client_credentials
    xhr.send(requestBody)
  })
}

chrome.extension.onMessage.addListener(function(request, sender, sendResponse){
  if (request.action === 'launchOauth'){
/*
    chrome.identity.launchWebAuthFlow({
      url: 'https://accounts.spotify.com/authorize' +
      '?client_id=$SPOTIFY_CLIENT_ID' +
      '&response_type=code' +
      '&redirect_uri=https://<put chrome token here>.chromiumapp.org/success',
      interactive: true
    },
    function(redirectUrl) {
      let code = redirectUrl.slice(redirectUrl.indexOf('=') + 1)
*/

      makeXhrPostRequest(null, 'client_credentials', request.clientId, request.clientSecret)
        .then(data => {
          data = JSON.parse(data)
          // {"access_token":"tokentokentoken","token_type":"Bearer","expires_in":3600}
          console.log(`here is your access_token: ${data.access_token} expiring at ${new Date(Date.now()+data.expires_in*1000)}`);
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
    //}) //launch web auth flow

  } //if statment
})// extension event listener
