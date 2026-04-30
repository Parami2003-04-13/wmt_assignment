import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// EXPO exposes env vars prefixed with EXPO_PUBLIC_ (see frontend/.env)
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URI ||
  'http://10.0.2.2:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const canUseSecureStore = Platform.OS !== 'web';

const getStoredValue = async (key: string) => {
  if (!canUseSecureStore) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`Unable to read ${key} from secure storage:`, error);
    return null;
  }
};

const setStoredValue = async (key: string, value: string | null) => {
  if (!canUseSecureStore) {
    if (typeof localStorage === 'undefined') return;

    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
    return;
  }

  if (value) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

api.interceptors.request.use(async (config) => {
  const token = await getStoredValue('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthToken = async (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }

  await setStoredValue('token', token);
};

export const getStoredToken = async () => {
  return await getStoredValue('token');
};

export const setStoredUser = async (user: unknown | null) => {
  await setStoredValue('user', user ? JSON.stringify(user) : null);
};

export const getStoredUser = async () => {
  const userStr = await getStoredValue('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const clearAuthStorage = async () => {
  await setAuthToken(null);
  await setStoredUser(null);
};

export { API_BASE_URL };

export default api;
