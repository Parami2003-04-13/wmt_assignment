import React, { useEffect, useState } from 'react';

let MapContainer: any, TileLayer: any, Marker: any, useMapEvents: any, useMap: any, L: any;

if (typeof window !== 'undefined') {
  const reactLeaflet = require('react-leaflet');
  MapContainer = reactLeaflet.MapContainer;
  TileLayer = reactLeaflet.TileLayer;
  Marker = reactLeaflet.Marker;
  useMapEvents = reactLeaflet.useMapEvents;
  useMap = reactLeaflet.useMap;

  L = require('leaflet');
  require('leaflet/dist/leaflet.css');

  // Fix Leaflet marker icon issue
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

const LeafletMapWeb = ({ latitude, longitude, onLocationSelect }: { latitude: number, longitude: number, onLocationSelect: (lat: number, lng: number) => void }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || typeof window === 'undefined' || !MapContainer) {
    return <div style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }} />;
  }

  const MapUpdater = () => {
    const map = useMap();
    React.useEffect(() => {
      map.setView([latitude, longitude]);
    }, [latitude, longitude, map]);
    return null;
  };

  const LocationPicker = () => {
    useMapEvents({
      click(e: any) {
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
