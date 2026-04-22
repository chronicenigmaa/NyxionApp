import AsyncStorage from '@react-native-async-storage/async-storage';

export const EDUOS_BASE = 'https://nyxion-eduos-production-63b9.up.railway.app/api/v1';
export const LEARN_BASE = 'https://nyxion-learnspace-production.up.railway.app/api/v1';

const createClient = (baseURL) => ({
  async get(path) {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${baseURL}${path}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(path, body) {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
});

export const eduos = createClient(EDUOS_BASE);
export const learn = createClient(LEARN_BASE);
