import React, { useCallback, useContext, useEffect, useReducer, useState, useRef } from 'react';
import { getLogger } from '../core';
import { ItemProps } from './ItemProps';
import { createItem, getItems, newWebSocket, updateItem, uploadPhoto } from './itemApi';
import { AuthContext } from '../auth';
import { NetworkContext } from '../network/NetworkProvider';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isPlatform } from '@ionic/react';

const log = getLogger('ItemProvider');

type SaveItemFn = (item: ItemProps) => Promise<any>;
type LoadMoreFn = () => void;
type PendingPhotoInfo = {
  _id: string;
  photoPath: string;
};

export interface ItemsState {
  items?: ItemProps[];
  fetching: boolean;
  fetchingError?: Error | null;
  saving: boolean;
  savingError?: Error | null;
  saveItem?: SaveItemFn;
  addItem?: (item: ItemProps) => void;
  hasMore?: boolean;
  loadMore?: LoadMoreFn;
  searchText?: string;
  setSearchText?: (text: string) => void;
  filterRating?: number;
  setFilterRating?: (rating: number | undefined) => void;
  filterVisitAgain?: string; 
  setFilterVisitAgain?: (value: string) => void;
}

interface ActionProps {
  type: string;
  payload?: any;
}

const initialState: ItemsState = {
  fetching: false,
  saving: false,
  hasMore: true,
  searchText: '',
  filterRating: undefined,
  filterVisitAgain: 'all',
};

const FETCH_ITEMS_STARTED = 'FETCH_ITEMS_STARTED';
const FETCH_ITEMS_SUCCEEDED = 'FETCH_ITEMS_SUCCEEDED';
const FETCH_ITEMS_FAILED = 'FETCH_ITEMS_FAILED';
const SAVE_ITEM_STARTED = 'SAVE_ITEM_STARTED';
const SAVE_ITEM_SUCCEEDED = 'SAVE_ITEM_SUCCEEDED';
const SAVE_ITEM_FAILED = 'SAVE_ITEM_FAILED';
const SAVE_PHOTO_STARTED = 'SAVE_PHOTO_STARTED';
const SAVE_PHOTO_FAILED = 'SAVE_PHOTO_FAILED';
const MERGE_PENDING_STATUSES = 'MERGE_PENDING_STATUSES';

const ITEMS_PER_PAGE = 10;
const PENDING_ITEMS_KEY = 'pendingItems';
const PENDING_PHOTOS_KEY = 'pendingPhotos';

const reducer = (state: ItemsState, { type, payload }: ActionProps): ItemsState => {
  switch (type) {
    case FETCH_ITEMS_STARTED:
      return { ...state, fetching: true, fetchingError: null };

    case FETCH_ITEMS_SUCCEEDED: {
      const serverItems = payload.items as ItemProps[];
      const currentItems = state.items || [];
      
      // Get pending items to check for matches
      const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
      
      // STRICT MERGE:
      // 1. Start with everything from the server.
      // 2. Add local items ONLY if they are strictly local (have tempId and NO _id).
      // 3. Exclude pending items that match server items by content to avoid duplicates
      
      const localOnlyItems = currentItems.filter(localItem => {
         // If it has a real _id, the server list rules. Ignore the local copy.
         if (localItem._id) return false;
         
         // If it only has a tempId, check if it might be a duplicate of a server item
         if (localItem.tempId) {
           // Check if any server item matches this local item by name/rating/location/price
           const isDuplicate = serverItems.some(serverItem => 
             serverItem.name === localItem.name &&
             serverItem.rating === localItem.rating &&
             serverItem.location === localItem.location &&
             serverItem.price === localItem.price
           );
           
           if (isDuplicate) {
             // This local item was already synced, remove from pending storage
             const pendingIndex = pendingItems.findIndex(p => p.tempId === localItem.tempId);
             if (pendingIndex !== -1) {
               pendingItems.splice(pendingIndex, 1);
               localStorage.setItem(PENDING_ITEMS_KEY, JSON.stringify(pendingItems));
             }
             return false;
           }
           
           return true; // Keep it, hasn't synced yet
         }
         
         return false;
      });

      // Combine: Server Items + Strictly Local Items
      const mergedItems = [...serverItems, ...localOnlyItems];
      
      return { ...state, items: mergedItems, fetching: false };
    }

    case FETCH_ITEMS_FAILED:
      return { ...state, fetchingError: payload.error, fetching: false };

    case MERGE_PENDING_STATUSES: {
      const currentItems = state.items || []; 
      const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
      const pendingPhotos: PendingPhotoInfo[] = JSON.parse(localStorage.getItem(PENDING_PHOTOS_KEY) || '[]');
      
      // If there's nothing pending, just ensure all items are marked as synced
      if (pendingItems.length === 0 && pendingPhotos.length === 0) {
        const cleanedItems = currentItems.map(item => ({
          ...item,
          _pendingSync: false,
          _photoPendingSync: false
        }));
        return { ...state, items: cleanedItems };
      }
      
      const finalItemsMap = new Map<string, ItemProps>();
      
      // 1. Add all current items to map
      currentItems.forEach(item => {
        const key = item._id || item.tempId;
        if (key) finalItemsMap.set(key, item);
      });

      // 2. Overlay pending items (this ensures offline edits are visible)
      pendingItems.forEach(pItem => {
        const key = pItem._id || pItem.tempId;
        if (key) {
            finalItemsMap.set(key, { ...finalItemsMap.get(key), ...pItem, _pendingSync: true });
        }
      });

      // 3. Apply photo pending statuses
      const newItems = Array.from(finalItemsMap.values()).map(item => ({
        ...item,
        _photoPendingSync: item._photoPendingSync || (item._id ? pendingPhotos.some(p => p._id === item._id) : false)
      }));

      return { ...state, items: newItems };
    }

    case SAVE_ITEM_STARTED:
      return { ...state, saving: true, savingError: null };

    case SAVE_ITEM_SUCCEEDED: {
      const items = [...(state.items || [])];
      const savedItem = payload.item;
      const originalTempId = payload.originalTempId; // The tempId used before saving

      // SCENARIO 1: We updated an existing item (has _id)
      if (savedItem._id && !originalTempId) {
          const index = items.findIndex(it => it._id === savedItem._id);
          if (index !== -1) {
              items[index] = { ...items[index], ...savedItem, _pendingSync: false };
          }
      } 
      // SCENARIO 2: We created a NEW item (had tempId, now has _id)
      else if (savedItem._id && originalTempId) {
          // Remove the old "temp" item
          const indexTemp = items.findIndex(it => it.tempId === originalTempId);
          if (indexTemp !== -1) {
              items.splice(indexTemp, 1);
          }
          
          // Ensure the new item is clean
          const newItem = { ...savedItem, _pendingSync: false };
          if (newItem.tempId) delete newItem.tempId; // Clean up tempId from the object itself

          // Add the new "real" item to the top
          items.unshift(newItem);
      }
      // SCENARIO 3: Offline Save (still has tempId, no _id)
      else {
          const index = items.findIndex(it => it.tempId === savedItem.tempId);
          if (index === -1) {
              items.unshift(savedItem);
          } else {
              items[index] = { ...items[index], ...savedItem };
          }
      }
      
      if (payload.photoSynced && savedItem._id) {
         const index = items.findIndex(it => it._id === savedItem._id);
         if (index !== -1) items[index]._photoPendingSync = false;
      }

      return { ...state, items, saving: false };
    }

    case SAVE_ITEM_FAILED:
      return { ...state, savingError: payload.error, saving: false };
      
    case SAVE_PHOTO_STARTED:
    case SAVE_PHOTO_FAILED: {
      const items = [...(state.items || [])];
      const index = items.findIndex(it => it._id === payload.itemId);
      if (index !== -1) {
        items[index] = { ...items[index], _photoPendingSync: true }; 
      }
      return { ...state, items };
    }

    default:
      return state;
  }
};

export const ItemContext = React.createContext<ItemsState>(initialState);

export const ItemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const { isOnline } = useContext(NetworkContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const { items, fetching, fetchingError, saving, savingError } = state;

  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [filterRating, setFilterRating] = useState<number | undefined>(undefined);
  const [filterVisitAgain, setFilterVisitAgain] = useState<string>('all');
  
  const isSyncingRef = useRef(false);
  const savingTempIds = useRef(new Set<string>());

  // --- Helpers ---
  const getFileFromPath = useCallback(async (localPhotoPath: string): Promise<File> => {
    let photoFile: File;
    if (isPlatform('hybrid')) {
      const filePath = localPhotoPath.startsWith('file://') ? localPhotoPath.substring(7) : localPhotoPath;
      const readResult = await Filesystem.readFile({ path: filePath, directory: Directory.Data, encoding: Encoding.Base64 });
      const base64Data = `data:image/jpeg;base64,${readResult.data}`;
      const response = await fetch(base64Data);
      const blob = await response.blob();
      photoFile = new File([blob], 'item_photo.jpeg', { type: 'image/jpeg' });
    } else {
      const response = await fetch(localPhotoPath);
      const blob = await response.blob();
      photoFile = new File([blob], 'item_photo.jpeg', { type: blob.type || 'image/jpeg' });
    }
    return photoFile;
  }, []);

  const updatePendingPhotosStorage = useCallback((itemId: string, action: 'add' | 'remove', photoPath?: string) => {
    const pendingPhotos: PendingPhotoInfo[] = JSON.parse(localStorage.getItem(PENDING_PHOTOS_KEY) || '[]');
    const index = pendingPhotos.findIndex(p => p._id === itemId);
    if (action === 'add' && photoPath && index === -1) {
      pendingPhotos.push({ _id: itemId, photoPath });
    } else if (action === 'remove' && index !== -1) {
      pendingPhotos.splice(index, 1);
    }
    localStorage.setItem(PENDING_PHOTOS_KEY, JSON.stringify(pendingPhotos));
    window.dispatchEvent(new StorageEvent('storage', { key: PENDING_PHOTOS_KEY, newValue: JSON.stringify(pendingPhotos) }));
  }, []);
  
  const updatePendingItemsStorage = useCallback((item: ItemProps, action: 'add' | 'remove') => {
    const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
    
    // Strict match: If it has tempId, match tempId. If it has _id, match _id.
    const index = pendingItems.findIndex(p => 
        (item.tempId && p.tempId === item.tempId) || 
        (item._id && p._id === item._id)
    );

    if (action === 'add') {
        if (index === -1) pendingItems.push(item);
        else pendingItems[index] = item;
    } else if (action === 'remove' && index !== -1) {
        pendingItems.splice(index, 1);
    }
    
    localStorage.setItem(PENDING_ITEMS_KEY, JSON.stringify(pendingItems));
    // Don't dispatch storage event here to prevent race condition in same tab
  }, []);
  
  const handleSaveFailed = useCallback((error: any, item: ItemProps) => {
    log('Save failed, saving locally', error);
    const tempId = item.tempId || `temp_${Date.now()}`;
    const itemWithTempId: ItemProps = { ...item, tempId, _pendingSync: true };

    dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: itemWithTempId } });
    updatePendingItemsStorage(itemWithTempId, 'add');
  }, [updatePendingItemsStorage]);
 
  // --- Main Save Function ---
  const saveItemCallback = useCallback(async (item: ItemProps) => {
    // Capture the tempId if this is a new item being synced
    const originalTempId = item.tempId; 
    
    // Generate a new tempId if it's a brand new offline creation
    const tempId = item.tempId || `temp_${Date.now()}`;
    
    // Lock this ID to prevent WebSocket updates from clashing
    savingTempIds.current.add(tempId);
    
    const itemForServer = { ...item, tempId }; 

    try {
      if (!isOnline) {
        handleSaveFailed(new Error('Offline'), itemForServer);
        return;
      }

      let savedItemFromServer: ItemProps;
      const { photoPath: localPhotoPath, ...itemDataToServer } = itemForServer;
      
      // Clean up UI-only properties before sending to server
      delete itemDataToServer.tempId;
      delete itemDataToServer._pendingSync;
      delete itemDataToServer._photoPendingSync;

      // --- STAGE 1: TEXT SAVE ---
      dispatch({ type: SAVE_ITEM_STARTED });
      
      if (item._id) { 
        savedItemFromServer = await updateItem(token, itemDataToServer);
      } else {
        savedItemFromServer = await createItem(token, itemDataToServer);
      }
      
      // Server accepted the item - NOW remove from pending storage
      updatePendingItemsStorage(itemForServer, 'remove');
      
      const itemForUi = { 
        ...savedItemFromServer, 
        photoPath: localPhotoPath,
        // If we just created it, it now has an _id and NO tempId needed
      };
      
      dispatch({ 
          type: SAVE_ITEM_SUCCEEDED, 
          payload: { 
              item: itemForUi, 
              originalTempId: originalTempId || tempId // Pass this so Reducer knows what to delete
          } 
      });

      // --- STAGE 2: PHOTO SAVE ---
      if (localPhotoPath && savedItemFromServer._id) {
        try {
          dispatch({ type: SAVE_PHOTO_STARTED, payload: { itemId: savedItemFromServer._id }});
          
          const photoFile = await getFileFromPath(localPhotoPath);
          await uploadPhoto(token, photoFile, savedItemFromServer._id);
          
          const finalItem = { ...savedItemFromServer, photoPath: localPhotoPath };
          
          dispatch({ 
              type: SAVE_ITEM_SUCCEEDED, 
              payload: { item: finalItem, photoSynced: true } 
          });
          
          updatePendingPhotosStorage(savedItemFromServer._id, 'remove');

        } catch (error: any) {
          log('Photo save failed', error);
          dispatch({ type: SAVE_PHOTO_FAILED, payload: { itemId: savedItemFromServer._id } });
          updatePendingPhotosStorage(savedItemFromServer._id, 'add', localPhotoPath);
        }
      }
    } catch (error) {
        handleSaveFailed(error, itemForServer);
        throw error;
    } finally {
      savingTempIds.current.delete(tempId);
    }
  }, [isOnline, token, handleSaveFailed, updatePendingItemsStorage, updatePendingPhotosStorage, getFileFromPath]);

  // --- Fetch Items ---
  const fetchItems = useCallback(async (forceFetch = false) => {
    if (!token) return;
    if (!forceFetch && isSyncingRef.current) return; // Block fetch during sync unless forced

    if (!isOnline && !forceFetch) {
      dispatch({ type: MERGE_PENDING_STATUSES });
      return;
    }
    
    try {
      dispatch({ type: FETCH_ITEMS_STARTED });
      const fetchedItems = await getItems(token);
      localStorage.setItem('items', JSON.stringify(fetchedItems));
      dispatch({ type: FETCH_ITEMS_SUCCEEDED, payload: { items: fetchedItems } });
    } catch (error) {
      dispatch({ type: FETCH_ITEMS_FAILED, payload: { error } });
    } finally {
        dispatch({ type: MERGE_PENDING_STATUSES });
    }
  }, [token, isOnline]);

  // --- Sync Logic ---
  const syncPendingItems = useCallback(async () => {
    if (!isOnline || !token || isSyncingRef.current) return;
    
    const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
    const pendingPhotos: PendingPhotoInfo[] = JSON.parse(localStorage.getItem(PENDING_PHOTOS_KEY) || '[]');
    
    if (pendingItems.length === 0 && pendingPhotos.length === 0) return;
    
    isSyncingRef.current = true;
    log('Starting Sync...');
    
    // 1. Sync Items
    for (const item of pendingItems) {
        try {
            await saveItemCallback(item); 
            // saveItemCallback handles the storage cleanup and state update internally
        } catch (error) {
            log('Sync item error', error);
        }
    }

    // 2. Sync Photos
    for (const pendingPhoto of pendingPhotos) {
        try {
          const photoFile = await getFileFromPath(pendingPhoto.photoPath!);
          await uploadPhoto(token, photoFile, pendingPhoto._id!);
          
          // Update UI to remove photo pending status
          const fullItem = items?.find(it => it._id === pendingPhoto._id);
          if (fullItem) {
             dispatch({ 
                 type: SAVE_ITEM_SUCCEEDED, 
                 payload: { item: { ...fullItem, photoPath: pendingPhoto.photoPath }, photoSynced: true }
             });
          }
          updatePendingPhotosStorage(pendingPhoto._id, 'remove');
        } catch (error) {
          log('Sync photo error', error);
        }
    }

    isSyncingRef.current = false;
    log('Sync Complete. Refreshing.');
    await fetchItems(true); // Force fetch to get fresh data from server
    
  }, [isOnline, token, items, saveItemCallback, getFileFromPath, updatePendingPhotosStorage, fetchItems]);

  // --- Effects ---

  // WebSocket
  useEffect(() => {
    let canceled = false;
    let closeWebSocket: (() => void) | undefined;
    if (token?.trim()) {
      closeWebSocket = newWebSocket(token, message => {
        if (canceled) return;
        const { type, payload: item } = message;
        // Ignore WS messages for items we are currently saving to avoid race conditions
        if (item.tempId && savingTempIds.current.has(item.tempId)) return;
        dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item } });
      });
    }
    return () => { canceled = true; closeWebSocket?.(); };
  }, [token]);
  
  // Storage Listener (Cross-tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PENDING_ITEMS_KEY || e.key === PENDING_PHOTOS_KEY) {
        if (!isSyncingRef.current) dispatch({ type: MERGE_PENDING_STATUSES });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initial Load
  useEffect(() => { fetchItems(); }, [fetchItems]);
  
  // Online Trigger
  useEffect(() => {
    if (isOnline) syncPendingItems();
  }, [isOnline, syncPendingItems]);

  const saveItem = useCallback<SaveItemFn>(saveItemCallback, [saveItemCallback]);
  const addItem = useCallback((item: ItemProps) => {
    dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item } });
  }, []);

  const loadMore = useCallback(() => setPage(prev => prev + 1), []);

  const filteredItems = items?.filter(item => {
    const matchesSearch = !searchText || item.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesRating = filterRating === undefined || item.rating === filterRating;
    const matchesVisit = filterVisitAgain === 'all' || 
                         (filterVisitAgain === 'yes' && item.visit_again) || 
                         (filterVisitAgain === 'no' && !item.visit_again);
    return matchesSearch && matchesRating && matchesVisit;
  });
  
  const paginatedItems = filteredItems?.slice(0, (page + 1) * ITEMS_PER_PAGE);
  const hasMoreItems = filteredItems ? (paginatedItems ? filteredItems.length > paginatedItems.length : false) : false;

  const value = { 
    items: paginatedItems, fetching, fetchingError, saving, savingError, saveItem, addItem,
    hasMore: hasMoreItems, loadMore, searchText, setSearchText, filterRating, setFilterRating,
    filterVisitAgain, setFilterVisitAgain,
  };
  
  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
};