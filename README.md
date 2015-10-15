# OSM from the ISS

## Source

* [OpenStreetMap](http://www.openstreetmap.org/): vector tile data
* [Leaflet](http://leafletjs.com/): JavaScript library for interactive maps
* [Tangram](https://mapzen.com/projects/tangram): 2D/3D WebGL map engine
* [Tangram Style](http://tangrams.github.io/tangram-play/?style=https://raw.githubusercontent.com/patriciogonzalezvivo/ISS/gh-pages/scene.yaml)
* [NASA Blue Marble earth images](http://visibleearth.nasa.gov/view_cat.php?categoryID=1484) 
* [Live ISS UStream](http://www.ustream.tv/channel/live-iss-stream)
* [ISS HD Earth Viewing Experiment](http://www.ustream.tv/channel/iss-hdev-payload)

### To run locally

Start a web server in the repo's directory:

    python -m SimpleHTTPServer 8000
    
If that doesn't work, try:

    python -m http.server 8000
    
Then navigate to: [http://localhost:8000](http://localhost:8000)
