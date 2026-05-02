import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { hasValidStallCoordinates } from '../utils/stallLocation';

let MapContainer: any;
let TileLayer: any;
let Marker: any;
let useMap: any;

if (typeof window !== 'undefined') {
  const reactLeaflet = require('react-leaflet');
  MapContainer = reactLeaflet.MapContainer;
  TileLayer = reactLeaflet.TileLayer;
  Marker = reactLeaflet.Marker;
  useMap = reactLeaflet.useMap;

  const L = require('leaflet');
  require('leaflet/dist/leaflet.css');
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

type Props = {
  latitude: number;
  longitude: number;
  zoom?: number;
};

function MapViewSync({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);
  return null;
}

export default function StallLocationMapView({ latitude, longitude, zoom = 15 }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const la = Number(latitude);
  const lo = Number(longitude);
  const z = Math.min(18, Math.max(3, Math.round(zoom)));
  const valid = hasValidStallCoordinates(latitude, longitude);

  if (!valid) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  if (!mounted || typeof window === 'undefined' || !MapContainer) {
    return <View style={styles.loading} />;
  }

  return (
    <View style={styles.wrap}>
      <MapContainer center={[la, lo]} zoom={z} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[la, lo]} />
        <MapViewSync lat={la} lng={lo} zoom={z} />
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 180, width: '100%', backgroundColor: '#e8e8e8' },
  loading: { flex: 1, minHeight: 180, backgroundColor: '#e8e8e8' },
  placeholder: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: { color: '#888', fontSize: 14 },
});
