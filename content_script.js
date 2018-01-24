function addSongInfoToTitle (songDataArr) {
  const songTitlesArr = [...document.getElementsByClassName('tracklist-name')]
  const pitchClass = [
    'C',
    'C♯/D♭',
    'D',
    'D♯/E♭',
    'E',
    'F',
    'F♯/G♭',
    'G',
    'G♯/A♭',
    'A',
    'A♯/B♭',
    'B'
  ]
  let keyArr = songDataArr.map(songDatum => songDatum.track.key)
  let bpmArr = songDataArr.map(songDatum => songDatum.track.tempo)
  let mode = songDataArr.map(songDatum => songDatum.track.mode)

  songTitlesArr.map((songTitle, index) => {
    let keyMode = (mode[index] === 1) ? 'maj' : 'min'
    return songTitle.append(` - ${pitchClass[keyArr[index]]} ${keyMode} & ${bpmArr[index].toFixed(0)} BPM`);
  });
}

function getPathname(){
  const pathname = window.location.pathname
  return pathname;
}

function makeXhrRequest(method, url, token) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token)
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
    xhr.send()
  })
}


function makeXhrRequestForAlbumOrPlaylist(pathname, token) {
  let albumId, requestUrl, userId, playlistId
  if (pathname.indexOf('album') > -1){
    albumId = pathname.slice(7) //gets rid of the /album/ in the pathname
    requestUrl = `https://api.spotify.com/v1/albums/${albumId}/tracks`
  } if (pathname.indexOf('playlist') > -1){
    userId = pathname.split('/')[2]
    playlistId = pathname.split('/')[4]
    requestUrl = `https://api.spotify.com/v1/users/${userId}/playlists/${playlistId}/tracks`
  }
    return makeXhrRequest('GET', requestUrl, token)
    .then((data) => {
      let parsedData = JSON.parse(data)
      let hrefArr = parsedData.items.map(item => {
        return (item.hasOwnProperty('track')) ? item.track.href : item.href
      })
      return hrefArr
    })
    .then(songLinkArr => {
      let audioAnalysisEndpointArr = songLinkArr.map(link => {
        return link.replace(/tracks/i, 'audio-analysis')
      });
      return audioAnalysisEndpointArr
    })
    .then(songRequestUrlArr => {
      return Promise.all(songRequestUrlArr.map(songRequestUrl => {
        return makeXhrRequest('GET', songRequestUrl, token)
      }))
    })
    .then(songDataArr => {
      let parsedSongDataArr = songDataArr.map(songData => JSON.parse(songData))
      addSongInfoToTitle(parsedSongDataArr)
    })
    .catch(err => {
      console.error('AHHHHH', err);
    })

}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    makeXhrRequestForAlbumOrPlaylist(getPathname(), request.token)
    sendResponse('WE GOT THE MESSAGE ');
    return true;
  }
);

