import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const LeafletMap = ({ latitude, longitude, onLocationSelect }: { latitude: number, longitude: number, onLocationSelect: (lat: number, lng: number) => void }) => {
  const webViewRef = useRef<WebView>(null);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          window.map = L.map('map').setView([${latitude}, ${longitude}], 13);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(window.map);

          window.marker = L.marker([${latitude}, ${longitude}]).addTo(window.map);

          window.map.on('click', function(e) {
            window.marker.setLatLng(e.latlng);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              lat: e.latlng.lat,
              lng: e.latlng.lng
            }));
          });

          window.addEventListener('message', function(event) {
              const data = JSON.parse(event.data);
              if (data.type === 'NEW_COORDS') {
                  marker.setLatLng([data.lat, data.lng]);
                  map.setView([data.lat, data.lng]);
              }
          });
        </script>
      </body>
    </html>
  `;

  useEffect(() => {
      // Keep the marker and map in sync if props change
      webViewRef.current?.injectJavaScript(`
          if (window.marker) {
              window.marker.setLatLng([${latitude}, ${longitude}]);
              window.map.setView([${latitude}, ${longitude}]);
          }
      `);
  }, [latitude, longitude]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.lat && data.lng) {
              onLocationSelect(data.lat, data.lng);
            }
          } catch (e) {
            console.error('Leaflet Map WebView message parse error', e);
          }
        }}
        scrollEnabled={false}
        style={{ flex: 1 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});

export default LeafletMap;
