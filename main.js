var track = orbit.orbitData;
var timeDiff = 0;
var lastDayNightOverlayUpdate = 0;
var isMiles = false;
var MILE_IN_KM = 1.609344;
var zoom = 6
var place

map = (function () {
    'use strict';

    // Leaflet Map
    var map = L.map('map',{
                            scrollWheelZoom: 'center', 
                            dragging: false,
                            minZoom: 3,
                            maxZoom: 12,
                            zoomControl: false 
                        });
    // Tangram Layer
    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        numWorkers: 2,
        attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>',
        unloadInvisibleTiles: false,
        updateWhenIdle: false,

    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    // setView expects format ([lat, long], zoom)
    map.setView([40.7238, -73.9881], 4);

    var hash = new L.Hash(map);

    /***** Render loop *****/
    window.addEventListener('load', function () {
        init();
    });

    return map;
}());

function init() {
    var serverTime = orbit.tRef;
    var clientTime = Math.round(new Date().getTime()/1000);
    timeDiff = clientTime - serverTime;

    var currTime = serverTime;

    var state = getSatelliteState(currTime);
    var time   = state.time;
    var satLon = state.lon;
    var satLat = state.lat;

    map.setView([satLat, satLon], zoom);
    layer.addTo(map);

    window.setInterval("update(getCurrentTime())", 1000);
}

Date.prototype.getJulian = function() {
    return Math.floor((this / 86400000) - (this.getTimezoneOffset()/1440) + 2440587.5);
}

function update(time) {   // time in seconds since Jan. 01, 1970 UTC
    // Update position to the satelite
    var state = getSatelliteState(time);
    map.panTo([state.lat, state.lon],{animate:true, duration: 1., easeLinearity: 1});

    updateGeocode(state.lat, state.lon);
    document.getElementById('loc').innerHTML = "Over " + place + " (" + state.lat.toFixed(4) + " , " + state.lon.toFixed(4) + " )";

    // Update Sun position
    var now = new Date();
    var cur_hour = now.getHours();
    var cur_min = now.getMinutes();
    var cur_sec = now.getSeconds();
    var cur_jul = now.getJulian() - 1;
    var equinox_jul = new Date(now.getFullYear(),2,20,24,-now.getTimezoneOffset(),0,0).getJulian() - 1;

    var offset_x = 27-Math.round(((cur_hour*3600 + cur_min*60 + cur_sec)/86400) * 180 ); // Resulting offset X
    var offset_sin = ((365.25 - equinox_jul + cur_jul)%365.25)/365.25; // Day offset, mapped on the equinox offset
    var offset_sin_factor = Math.sin(offset_sin * 2 * Math.PI); // Sine wave offset
    var offset_y = offset_sin_factor * 23.44; // Map onto angle. Maximum angle is 23.44° in both directions

    var sunPos = [offset_x, offset_y]; 
    scene.styles.earth.shaders.uniforms.u_sun_offset = sunPos;
    scene.styles.water.shaders.uniforms.u_sun_offset = sunPos;
    // scene.styles.buildings.shaders.uniforms.u_sun_offset = sunPos;
}

function getCurrentTime() {   // time in seconds since Jan. 01, 1970 UTC
  return Math.round(new Date().getTime()/1000) - timeDiff;
}

function getSatelliteState(time) {   // time in seconds since Jan. 01, 1970 UTC
    if ( (time < track[0].t) || (time > track[track.length-1].t) ) {
        window.location.reload(true);
        return null;
    }

    try {
        var idx = getIndex(time);
        var state1 = track[idx];
        var state2 = track[idx+1];
        var factor = (time - state1.t) / (state2.t - state1.t);
        var lon   = state1.ln + (state2.ln - state1.ln) * factor;
        var lat   = state1.lt + (state2.lt - state1.lt) * factor;
        var alt   = state1.h + (state2.h - state1.h) * factor;
        var speed = state1.v + (state2.v - state1.v) * factor;
        return { time: time, lon: lon, lat: lat, alt: alt, speed: speed };
    }
    catch (ex) {
        window.location.reload(true);
        return null;
    }
}

function getIndex(time) {   // time in seconds since Jan. 01, 1970 UTC
    var i = 0;
    while ( (time > track[i].t) && (i < track.length) )
        i++;
    return i - 1;
}

function httpGet (url, callback) {
    var request = new XMLHttpRequest();
    var method = 'GET';

    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            var response = request.responseText;

            // TODO: Actual error handling
            var error = null;
            callback(error, response);
        }
    };
    request.open(method, url, true);
    request.send();
}

function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this,
            args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
}

function updateGeocode (lat, lng) {
    var PELIAS_KEY = 'search--cv2Foc';
    var PELIAS_HOST = 'search.mapzen.com';

    var endpoint = '//' + PELIAS_HOST + '/v1/reverse?point.lat=' + lat + '&point.lon=' + lng + '&size=1&layers=coarse&api_key=' + PELIAS_KEY;

    httpGet(endpoint, function(err, res){
        if (err) {
            console.error(err);
        }

        // TODO: Much more clever viewport/zoom based determination of current location
        var response = JSON.parse(res);
        if (!response.features || response.features.length === 0) {
            // Sometimes reverse geocoding returns no results
            place = 'Unknown location';
        }
        else {
            place = response.features[0].properties.label;
        }
    });
}

function unhide(divID) {
    var item = document.getElementById(divID);
    if (item) {
        item.className=(item.className=='hidden')?'unhidden':'hidden';
    }
}
