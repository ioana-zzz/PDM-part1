import axios from 'axios';
import { authConfig, baseUrl, getLogger, withLogs } from '../core';
import { ItemProps } from './ItemProps';

const itemUrl = `http://${baseUrl}/api/item`;

export const getItems: (token: string) => Promise<ItemProps[]> = token => {
  return withLogs(axios.get(itemUrl, authConfig(token)), 'getItems');
}

export const createItem: (token: string, item: ItemProps) => Promise<ItemProps> = (token, item) => {
  return withLogs(axios.post(itemUrl, item, authConfig(token)), 'createItem');
}

export const updateItem: (token: string, item: ItemProps) => Promise<ItemProps> = (token, item) => {
  return withLogs(axios.put(`${itemUrl}/${item._id}`, item, authConfig(token)), 'updateItem');
}

// 📸 NEW: Function to upload the photo file (1p - Upload photo)
export const uploadPhoto: (token: string, photoFile: File, itemId: string) => Promise<any> = (token, photoFile, itemId) => {
  const formData = new FormData();
  formData.append('file', photoFile, 'flower_photo.jpeg'); // 'file' matches a common server expectation

  // Ensure your server endpoint handles PUT or POST for photo uploads tied to an item ID
  // Note: Your server might expect /photo/:itemId or just /:itemId/photo
  return withLogs(axios.post(`${itemUrl}/photo/${itemId}`, formData, {
    ...authConfig(token),
    headers: {
      'Content-Type': 'multipart/form-data', 
      'Authorization': authConfig(token).headers.Authorization
    }
  }), 'uploadPhoto');
};


interface MessageData {
  type: string;
  payload: ItemProps;
}

const log = getLogger('ws');

export const newWebSocket = (token: string, onMessage: (data: MessageData) => void) => {
  const ws = new WebSocket(`ws://${baseUrl}`);
  ws.onopen = () => {
    log('web socket onopen');
    ws.send(JSON.stringify({ type: 'authorization', payload: { token } }));
  };
  ws.onclose = () => {
    log('web socket onclose');
  };
  ws.onerror = error => {
    log('web socket onerror', error);
  };
  ws.onmessage = messageEvent => {
    log('web socket onmessage');
    const data: MessageData = JSON.parse(messageEvent.data);
    onMessage(data);
  };
  return () => {
    ws.close();
  }
}