import Map from "./mapBox/map";
import markers from "./mapBox/markers";

function contactsMap (el) {
    
    const mapToken = 'pk.eyJ1Ijoic2VyZWdhdG8iLCJhIjoiTVhMa2NkRSJ9.LyqhckvDNmXgLSdHiRKigw';
    const mapStyle = 'mapbox://styles/seregato/clqexs3ur00gl01qugncof93f';

    const mapbox = new Map({
        container: el,
        markers: markers,
        token: mapToken,
        style: mapStyle,
        zoom: 15,
        mapCenter: [131.886448, 43.119550],
    });
 
}

export default contactsMap;