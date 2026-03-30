import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Uses EXPO_PUBLIC_ prefix configured in the root .env file
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = async (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    await SecureStore.setItemAsync('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    await SecureStore.deleteItemAsync('token');
  }
};

export const getStoredToken = async () => {
  return await SecureStore.getItemAsync('token');
};

export default api;
