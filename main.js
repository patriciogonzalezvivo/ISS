var track = orbit.orbitData;
var timeDiff = 0;
var lastDayNightOverlayUpdate = 0;
var isMiles = false;
var MILE_IN_KM = 1.609344;
var zoom = 6;
var place = "";
var placeCounter = 0;
var lastState = {};
var createObjectURL = (window.URL && window.URL.createObjectURL) || (window.webkitURL && window.webkitURL.createObjectURL);
var cloudOffset = [0,0];

map = (function () {
    'use strict';

    // Leaflet Map
    var map = L.map('map',{
                            scrollWheelZoom: 'center', 
                            dragging: false,
                            // minZoom: 4,
                            maxZoom: 12,
                            zoomControl: false 
                        });
    // Tangram Layer
    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    // setView expects format ([lat, long], zoom)
    map.setView([0, 0], 6);

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
    // Scene initialized
    layer.on('init', function() {
        console.log("Creating orbit and cheching on WebGL ")
        
        // If the browser don't suport big textures, reload scene using LowDefenition images
        if ( scene.gl.getParameter(scene.gl.MAX_TEXTURE_SIZE) < 10800) {
            console.log("Warning, Browser don't suport big images, reloading style with smaller images");
            httpGet("scene.yaml", function(err, res){
                if (err) {
                    console.error(err);
                }
                var content = res.replace(/\-[x]*hd\.jpg/gm, "-ld.jpg");
                var url = createObjectURL(new Blob([content]));
                scene.load(url,false);
                CreateOrbit();
            });
        } else {
            CreateOrbit();
        }
        
        window.setInterval("update(getCurrentTime())", 1000);

        // if (window.DeviceMotionEvent) {
        //     window.addEventListener("devicemotion", onMotionUpdate, false);
        // }
        document.addEventListener('mousemove', onMouseUpdate, false);
        document.addEventListener('mouseenter', onMouseUpdate, false);
    });
    layer.addTo(map);

    typeLocation("");
}

function CreateOrbit() {
    httpGet("data/iss.geojson", function(err, res){
        if (err) {
            console.error(err);
        }

        var response = JSON.parse(res);
        response.features[0].geometry.coordinates = [];
        response.features[1].geometry.coordinates = [];

        var prevLon = orbit.orbitData[0].ln;
        var currentGeom = 0;
        for (var i = 0; i < orbit.orbitData.length; i++) {
            if (prevLon > 0.0 && orbit.orbitData[i].ln < 0.0){
                response.features[currentGeom].geometry.coordinates.push([orbit.orbitData[i].ln+360, orbit.orbitData[i].lt])
                currentGeom = 1;
            }
            response.features[currentGeom].geometry.coordinates.push([orbit.orbitData[i].ln, orbit.orbitData[i].lt]);
            prevLon = orbit.orbitData[i].ln;
        }

        if (response.features[1].geometry.coordinates.length === 0.0) {
            response.features.length = 1;
        }

        var content = JSON.stringify(response);

        scene.config.sources.iss.url = createObjectURL(new Blob([content]));
        scene.rebuild();
    });
}

Date.prototype.getJulian = function() {
    return Math.floor((this / 86400000) - (this.getTimezoneOffset()/1440) + 2440587.5);
}

function update(time) {   // time in seconds since Jan. 01, 1970 UTC
    // Update position to the satelite
    var state = getSatelliteState(time);
    var options = {animate: true, duration: 1., easeLinearity: 1};

    if (state.lon < -173) {
        options.animate = false;
        options.duration = 0.0;
    }

    map.panTo([state.lat, state.lon],options);    
    document.getElementById('left-lat').innerHTML = "LAT " + state.lat.toFixed(4);
    document.getElementById('left-lon').innerHTML = "LON " + state.lon.toFixed(4);
    
    // Update Sun position
    var now = new Date();
    document.getElementById('left-time').innerHTML = now.getTime().toString();

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

    lastState = state;
}

function typeLocation(text) {
    if (placeCounter > text.length || place === "") {
        console.log("reset");
        placeCounter = 0;
        text = "";
        var state = getSatelliteState(getCurrentTime());
        updateGeocode(state.lat, state.lon);
        setTimeout(function(){
            typeLocation("");
        }, 3000);
    } else {
        setTimeout( function(){
            console.log(text,place, placeCounter);
            document.getElementById('loc').innerHTML = text + "<span>|</span>"; 
            typeLocation(text+place.charAt(placeCounter++));
        }, 500);
    }
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

function onMouseUpdate(e) {
    var mouse = [ (e.pageX/screen.width-.5)*0.005, (e.pageY/screen.height-.5)*-0.002];
    cloudOffset[0] += (mouse[0]-cloudOffset[0])*.01;
    cloudOffset[1] += (mouse[1]-cloudOffset[1])*.01;
    if (scene.styles) {
        scene.styles.earth.shaders.uniforms.u_clouds_offset = cloudOffset;
        scene.styles.water.shaders.uniforms.u_clouds_offset = cloudOffset;
    }
}

function onMotionUpdate(e) {
    var motion = [event.accelerationIncludingGravity.x, event.accelerationIncludingGravity.y];
    console.log("Motion",motion);

    if (scene.styles && motion[0] !== null && motion[1] !== null ) {
        cloudOffset[0] = motion[0];
        cloudOffset[1] = motion[1];
        // cloudOffset[0] += (motion[0]-cloudOffset[0])*.5;
        // cloudOffset[1] += (motion[1]-cloudOffset[1])*.5;
        scene.styles.earth.shaders.uniforms.u_clouds_offset = cloudOffset;
        scene.styles.water.shaders.uniforms.u_clouds_offset = cloudOffset;
    }
}
