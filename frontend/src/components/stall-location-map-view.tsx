import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { hasValidStallCoordinates } from '../utils/stallLocation';

type Props = {
  latitude: number;
  longitude: number;
  zoom?: number;
};

export default function StallLocationMapView({ latitude, longitude, zoom = 15 }: Props) {
  const webViewRef = useRef<WebView>(null);
  const la = Number(latitude);
  const lo = Number(longitude);
  const z = Math.min(18, Math.max(3, Math.round(zoom)));

  const html = useMemo(() => {
    if (!hasValidStallCoordinates(latitude, longitude)) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
        <body style="margin:0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0f0f0;color:#888;">Location unavailable</body></html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.map = L.map('map').setView([${la}, ${lo}], ${z});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(window.map);
    window.marker = L.marker([${la}, ${lo}]).addTo(window.map);
  </script>
</body>
</html>`;
  }, [latitude, longitude, la, lo, z]);

  useEffect(() => {
    if (!hasValidStallCoordinates(latitude, longitude)) return;
    webViewRef.current?.injectJavaScript(`
      try {
        if (window.marker && window.map) {
          window.marker.setLatLng([${la}, ${lo}]);
          window.map.setView([${la}, ${lo}], ${z});
        }
      } catch (e) {}
      true;
    `);
  }, [la, lo, z, latitude, longitude]);

  if (!hasValidStallCoordinates(latitude, longitude)) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#e8e8e8' },
  placeholder: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: { color: '#888', fontSize: 14 },
});
