// Original author Rachel Arkebauer, 2018-2019
// Adapted by Alexandre Hamelin, 2022

// Globals for the life span of the page (they reset to null on page refresh)
var documentObserver = null;
var currentAudioFeatData = null;  // raw JSON data from /audio-features for the current page
var currentReleaseDates = null;   // array of release dates for current tracks


function addSongInfoToTitle(titleNode, songData, releaseDate) {
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

  if (songData) {
    const keyMode = (songData.mode === 1) ? 'maj' : 'min';
    titleNode.innerHTML += ` <span style="color:darkorange">${pitchClass[songData.key]}` +
      ` ${keyMode} — ${songData.tempo.toFixed(0)} BPM</span>` +
      ` <span style="color:firebrick">${releaseDate}</span>`;
  }
  else {
    // sometimes audio-features return no data for certain songs
    titleNode.innerHTML += ' <span style="color:darkorange">(No data)</span>';
  }
}

function makeXhrRequest(method, url, token) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    if (token) {
      xhr.setRequestHeader('Authorization', 'Bearer ' + token)
      console.debug(`from makeXhrRequest: ${method} ${url} ${token.substring(0,16)+"..."}`);
    }
    xhr.onload = function(){
      if (xhr.status >= 200 && xhr.status < 300){
        return resolve(xhr.response);
      } else {
        reject(
          Error(`XHR request error: ${xhr.status} ${xhr.statusText}`, {cause: {
            status: xhr.status,
            statusText: xhr.statusText
          }})
        )
      }
    }
    xhr.onerror = function(){
      reject(
        Error(`XHR request error: ${xhr.status} ${xhr.statusText}`, {cause: {
          status: xhr.status,
          statusText: xhr.statusText
        }})
      )
    }
    xhr.send()
  })
}


function makeXhrRequestForAlbumOrPlaylist(token, accountToken) {
  let albumId, requestUrl, playlistId, limit;
  const pathname = window.location.pathname;
  
  // load the audio features (key, key mode, tempo) for ALL tracks of this playlist/album
  // - get /playlists/$id/tracks?fields=total, then .total (TODO)
  // - get track data for all tracks, by chunks of 100 songs at a time (50 for albums)
  //    - use audio-features instead of audio-analysis (less traffic, simpler API)
  //    - issue: many requests for large playlists (page loads/user navigations)
  //    - solution: cache pages (page refresh needed if is playlist modified)
  // - then() cascade to get audio features for the given tracks
  // - then() currentAudioFeatData will be populated with info for all tracks,
  //   which the observer can easily use afterwards

  if (pathname.indexOf('album') > -1 && !pathname.includes('albums')){
    albumId = pathname.slice(7) //grab albumId
    requestUrl = `https://api.spotify.com/v1/albums/${albumId}/tracks`
    limit = 50;
  }
  
  if (pathname.indexOf('playlist') > -1 && !pathname.includes('playlists')){
    playlistId = pathname.split('/')[2];
    requestUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=total,items.track.id,items.track.album.release_date`
    limit = 100;
  }

  // split the total number of tracks into chunks of ${limit}
  // e.g. 709 -> [[0, 100], [100, 100], [200, 100], ..., [700, 9]]
  const chunks = (function f(c, t, sz) {
    return t - sz <= 0 ? [[c, t]] : [[c, sz], ...f(c + sz, t - sz, sz)]
  })(0, total=100, limit); // FIXME: replace with real total when implemented

  // Turn chunks into Promises and perform all requests in parallel
  return Promise.all([...chunks.map(([from, count]) => {
    // build the full URL to retrieve the list of tracks (IDs)
    const sep = '?&'[+requestUrl.includes('?')];
    requestUrl = `${requestUrl}${sep}offset=${from}&limit=${count}`;

    // send the request; use the account access token because otherwise
    // the tracks are not in the same order (!)
    return makeXhrRequest('GET', requestUrl, accountToken).then((tracksData) => {
      tracksData = JSON.parse(tracksData);
      const songIdArr = tracksData.items.map(t => t.hasOwnProperty('track') ? (t.track !== null ? t.track.id : 'no-id') : t.id).join(',');
      currentReleaseDates = tracksData.items.map(t => t.hasOwnProperty('track') ? (t.track !== null ? t.track.album.release_date : 'no-album') : '');
      return songIdArr;
    })
    .then(songIdArr => {
      // build the audio-features URL based on those IDs
      const audioFeatUrl = 'https://api.spotify.com/v1/audio-features?ids=' + songIdArr;
      console.debug('built audiofeat url = ' + audioFeatUrl);

      // finally, fetch the data we need for those tracks and expectedly
      // use the API access token because /audio-features requires this
      // (the user account access token is not authorized to access that API)
      return makeXhrRequest('GET', audioFeatUrl, token)
        .then(audioFeatData => {
          // at last, ultimately set global variable for the observer to consume
          currentAudioFeatData = JSON.parse(audioFeatData);
          console.debug(`retrieved audio feats for ${currentAudioFeatData.audio_features.length} tracks`);
        })
        .catch(err => {
          // the query to audio-features may fail because of the token
          // has expired; notify the user in logs
          if (err.cause.status == 401)
            console.error('API authentication token has expired! Re-authenticate manually using the Extension popup page');
          throw err;
        });
    })
    .then(() => {
      // handle the case when the html nodes are already added to the document
      // due to slow requests to /audio-features
      for (let i = 0; i < currentAudioFeatData.audio_features.length; i++) { 
        const songTitleClassName = 't_yrXoUO3qGsJS4Y6iXX';
        let titleNode = null;
        if (pathname.startsWith('/playlist/')) {
          titleNode = document.querySelector(`[data-testid="playlist-tracklist"] [aria-rowindex="${i+2}"] .${songTitleClassName} div`);
        }
        else if (pathname.startsWith('/album/')) {
          titleNode = document.querySelector(`[data-testid="track-list"] [aria-rowindex="${i+2}"] .${songTitleClassName} div`);
        }
        if (titleNode)
          addSongInfoToTitle(titleNode, currentAudioFeatData.audio_features[i], currentReleaseDates[i]);
      }
    })
    .catch(err => {
      console.error('AHHHHH', err);
      currentAudioFeatData = null; // invalidate the data we had
    })
  })]);
}

function installObserver() {
  // OK, Spotify adds and removes HTML nodes dynamically everytime the user
  // scrolls the page up and down, meaning we can't just append th info
  // permanently to the track titles. We need to listen for changes to the DOM
  // and piggyback on those events to display our extra information.
  // That's done by using a MutationObserver object and watching (filtering)
  // for node additions.

  const observer = new MutationObserver(mutations => {
    // This callback is triggered whenever a new node is added to the DOM.
    // However there is a major drawback to this approach: we have no idea
    // what track the added node corresponds to, i.e. the node contains no
    // information about the track (except the title and artist as free text).
    //
    // The way we can find out what track we're dealing with, is to use the
    // aria-rowindex attribute value of the node which is basically the row
    // in the track listing table displayed on screen (offset by 2). Use
    // that index in the global variables to retrieve the corresponding
    // info for that track. Those variables are set whenever the browser tab
    // is updated (a refresh or uesr navigation and URL changes).

    // Don't do anything if something went wrong loading the needed data.
    if (!currentAudioFeatData || !currentAudioFeatData.audio_features) return;

    mutations.filter(m => m.addedNodes.length > 0).forEach(m => {
      console.debug('number of nodes added: ' + m.addedNodes.length);

      // Filter mutations on node additions only and check that they're
      // HTML elements with a 'role' attribute set to 'row': these are
      // the ones corresponding to the tracks displayed.

      const newNode = m.addedNodes[0];
      if (newNode.nodeType == Node.ELEMENT_NODE && newNode.getAttribute('role') == 'row') {
        console.debug("New song node added to DOM:", newNode);

        // Adjust columns width
        document.querySelectorAll('[aria-colcount="5"] .wTUruPetkKdWAR1dd6w4').forEach(elem => {
          elem.style.gridTemplateColumns =
            '[index] 16px [first] 12fr [var1] 4fr [var2] 1fr [last] minmax(120px,1fr)'
        });

        const tracklistNode = document.querySelector('[data-testid="playlist-tracklist"]') ||
                              document.querySelector('[data-testid="track-list"]');
        // must be part of the playlist, not the recommended songs, etc.
        if (!tracklistNode || !tracklistNode.contains(newNode)) return;
        console.debug(" Song node is valid, appending audio features to song node");

        // TODO: handle other kinds of pages here...
        //else if (...) {
        // TODO: /queue (api /tracks?ids=$id with user account token)
        // TODO: /artist/$id (api-partner /query?operationName=queryArtistOverview)
        // TODO: /artist/$id/discography/single (api-partner /query?operationName={queryArtistDiscographySingles,queryAlbumTracks})
        // TODO: /search/$terms (api-partner /query?operationName=searchDesktop)
        // TODO: /search/$terms/tracks (api-partner /query?operationName=searchTracks)
        // TODO: recommanded songs (playlist extended /extenderp)
        //}

        // For now, use this hardcoded class name which is set on all title nodes
        // (probably changes every new version deployed of the web player).
        // ":scope" is needed here to find a descendant of newNode.
        // Adjust index by 2 accounting for 0-based and the table header.
        const songTitleClassName = 't_yrXoUO3qGsJS4Y6iXX';
        const titleNode = newNode.querySelector(`:scope .${songTitleClassName} div`) ||  // playlist page
                          newNode.querySelector(`:scope div.${songTitleClassName}`);     // album page
        const trackIndex = parseInt(newNode.getAttribute('aria-rowindex')) - 2;
        console.debug(` index=${trackIndex} and title=${titleNode.innerText}`);
        console.debug("", currentAudioFeatData.audio_features[trackIndex]);
        if (trackIndex < currentAudioFeatData.audio_features.length)
          addSongInfoToTitle(titleNode, currentAudioFeatData.audio_features[trackIndex], currentReleaseDates[trackIndex]);
      }
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  return observer;
}

function updateUserAccessToken() {
  return makeXhrRequest("GET", "/get_access_token?reason=transport&productType=web-player", null).then(tokenData => {
    document.querySelector('#session').innerHTML = tokenData;
    console.debug("new session data:", tokenData);
    return JSON.parse(tokenData).accessToken;
  })
  .catch(err_ => {
    console.error("error fetching new access token");
  })
}

function findUserAccessToken() {
  const sessionNode = document.querySelector('#session');
  if (!sessionNode) {
    console.warn("no session config node in page?");
    return Promise.resolve(null);
  }
  let sessionData = JSON.parse(sessionNode.innerText);
  const expiration = sessionData.accessTokenExpirationTimestampMs;
  const now = new Date().getTime();
  if (now < expiration) {
    console.debug("accesstoken is still valid");
    return Promise.resolve(sessionData.accessToken);
  }
  else {
    console.debug("accesstoken has expired, updating html node with new session data");
    return updateUserAccessToken();
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    // this is called whenever a spotify tab is updated (message sent from eventPage.js)

    // start anew everytime the page reloads
    currentReleaseDates = currentAudioFeatData = null;

    // avoid handling pages other than albums and playlists for now
    if (!window.location.pathname.match(/^\/(?:album|playlist)\//)) return true;

    findUserAccessToken().then(userAccessToken => {
      makeXhrRequestForAlbumOrPlaylist(request.token, userAccessToken);
    }).catch(err => {
      console.error("error while updating user access token", err);
    });

    if (!documentObserver) {
      console.debug('Page has been reloaded, observer is gone, reinstalling the DOM observer');
      documentObserver = installObserver();
    }
    else {
      console.debug('Page navigation event; observer still there, moving on with current data...');
    }
    sendResponse('WE GOT THE MESSAGE ');
    return true;
  }
);
