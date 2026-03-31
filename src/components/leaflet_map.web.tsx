import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon issue
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LeafletMapWeb = ({ latitude, longitude, onLocationSelect }: { latitude: number, longitude: number, onLocationSelect: (lat: number, lng: number) => void }) => {
  const MapUpdater = () => {
    const map = useMap();
    React.useEffect(() => {
      map.setView([latitude, longitude]);
    }, [latitude, longitude]);
    return null;
  };

  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return latitude && longitude ? <Marker position={[latitude, longitude]} /> : null;
  };

  return (
    <MapContainer 
      center={[latitude, longitude]} 
      zoom={13} 
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapUpdater />
      <LocationPicker />
    </MapContainer>
  );
};

export default LeafletMapWeb;
