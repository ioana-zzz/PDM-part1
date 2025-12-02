import React, { useCallback, useContext, useEffect, useReducer, useState, useRef } from 'react';
import { getLogger } from '../core';
import { ItemProps } from './ItemProps';
import { createItem, getItems, newWebSocket, updateItem, uploadPhoto } from './itemApi';
import { AuthContext } from '../auth';
import { NetworkContext } from '../network/NetworkProvider';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isPlatform } from '@ionic/react';

const log = getLogger('ItemProvider');

// 1. TYPE DEFINITIONS
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
  filterClass?: string;
  setFilterClass?: (cls: string) => void;
}

interface ActionProps {
  type: string;
  payload?: any;
}

// 2. INITIAL STATE & CONSTANTS
const initialState: ItemsState = {
  fetching: false,
  saving: false,
  hasMore: true,
  searchText: '',
  filterClass: '',
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

// 3. REDUCER FUNCTION
const reducer = (state: ItemsState, { type, payload }: ActionProps): ItemsState => {
  switch (type) {
    case FETCH_ITEMS_STARTED:
      return { ...state, fetching: true, fetchingError: null };

    case FETCH_ITEMS_SUCCEEDED:
      return { ...state, items: payload.items, fetching: false };

    case FETCH_ITEMS_FAILED:
      return { ...state, fetchingError: payload.error, fetching: false };

    case MERGE_PENDING_STATUSES: {
      const currentItems = state.items || []; 
      const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
      const pendingPhotos: PendingPhotoInfo[] = JSON.parse(localStorage.getItem(PENDING_PHOTOS_KEY) || '[]');
      
      const finalItemsMap = new Map<string, ItemProps>();
      
      // FIX: Keying must be consistent (tempId or _id) to prevent duplicates
      currentItems.forEach(item => {
        const key = item.tempId || item._id; 
        if (key) { 
          finalItemsMap.set(key, item);
        }
      });

      pendingItems.forEach(pItem => {
        const key = pItem.tempId!; 
        finalItemsMap.set(key, { ...finalItemsMap.get(key), ...pItem, _pendingSync: true });
      });

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
      const item = payload.item;

      // Find index by tempId (for new items) or by _id (for existing items/WS messages)
      let index = -1;
      if (item.tempId) {
        index = items.findIndex(it => it.tempId === item.tempId);
      }
      if (index === -1 && item._id) {
        index = items.findIndex(it => it._id === item._id);
      }
      
      const updatedItem = { ...item };
      
      if (updatedItem._id && !payload.isPending) {
        updatedItem._pendingSync = false;
        if (payload.photoSynced || !updatedItem.photoPath) {
          delete updatedItem.tempId; // Clean up tempId after successful sync
        }
      }
      
      if (payload.photoSynced) {
        updatedItem._photoPendingSync = false;
      }

      if (index === -1) {
        items.unshift(updatedItem); // Add new item
      } else {
        items[index] = { ...items[index], ...updatedItem }; // Update existing item
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
        // Mark as pending photo sync upon failure
        items[index] = { ...items[index], _photoPendingSync: true }; 
      }
      return { ...state, items };
    }

    default:
      return state;
  }
};

// 4. CONTEXT CREATION
export const ItemContext = React.createContext<ItemsState>(initialState);

// 5. PROVIDER COMPONENT
export const ItemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useContext(AuthContext);
  const { isOnline } = useContext(NetworkContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const { items, fetching, fetchingError, saving, savingError } = state;

  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const savingTempIds = useRef(new Set<string>()); // Tracks items currently being saved

  // --- Helper Functions (Omitting for brevity, assuming implementation is correct) ---
  const getFileFromPath = async (localPhotoPath: string): Promise<File> => {
    // ... (implementation remains the same)
    let photoFile: File;
    if (isPlatform('hybrid')) {
      const filePath = localPhotoPath.startsWith('file://') ? localPhotoPath.substring(7) : localPhotoPath;
      const readResult = await Filesystem.readFile({ path: filePath, directory: Directory.Data, encoding: Encoding.Base64 });
      const base64Data = `data:image/jpeg;base64,${readResult.data}`;
      const response = await fetch(base64Data);
      const blob = await response.blob();
      photoFile = new File([blob], 'flower_photo.jpeg', { type: 'image/jpeg' });
    } else {
      const response = await fetch(localPhotoPath);
      const blob = await response.blob();
      photoFile = new File([blob], 'flower_photo.jpeg', { type: blob.type || 'image/jpeg' });
    }
    return photoFile;
  };

  const updatePendingPhotosStorage = (itemId: string, action: 'add' | 'remove', photoPath?: string) => {
    const pendingPhotos: PendingPhotoInfo[] = JSON.parse(localStorage.getItem(PENDING_PHOTOS_KEY) || '[]');
    const index = pendingPhotos.findIndex(p => p._id === itemId);
    if (action === 'add' && photoPath && index === -1) {
      pendingPhotos.push({ _id: itemId, photoPath });
    } else if (action === 'remove' && index !== -1) {
      pendingPhotos.splice(index, 1);
    }
    localStorage.setItem(PENDING_PHOTOS_KEY, JSON.stringify(pendingPhotos));
    window.dispatchEvent(new StorageEvent('storage', { key: PENDING_PHOTOS_KEY, newValue: JSON.stringify(pendingPhotos) }));
  };
  
  const updatePendingItemsStorage = (item: ItemProps, action: 'add' | 'remove') => {
    const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
    const index = pendingItems.findIndex(p => p.tempId === item.tempId);
    if (action === 'add' && index === -1) {
      pendingItems.push(item);
    } else if (action === 'add' && index !== -1) {
      pendingItems[index] = item;
    } else if (action === 'remove' && index !== -1) {
      pendingItems.splice(index, 1);
    }
    localStorage.setItem(PENDING_ITEMS_KEY, JSON.stringify(pendingItems));
    window.dispatchEvent(new StorageEvent('storage', { key: PENDING_ITEMS_KEY, newValue: JSON.stringify(pendingItems) }));
  };
  
  const handleSaveFailed = (error: any, item: ItemProps) => {
    log('Save failed, saving locally', error);
    const tempId = item.tempId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemWithTempId: ItemProps = { ...item, tempId, _pendingSync: true };

    dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: itemWithTempId, isPending: true } });
    updatePendingItemsStorage(itemWithTempId, 'add');
  };
 
  // Main save callback
  const saveItemCallback = useCallback(async (item: ItemProps) => {
    const tempId = item.tempId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (tempId) {
      savingTempIds.current.add(tempId);
    }
    const itemWithTempId = { ...item, tempId };

    try {
      if (!isOnline) {
        log('Offline - saving item locally');
        handleSaveFailed(new Error('Offline'), itemWithTempId);
        return;
      }

      let savedItemWithId: ItemProps;
      const { photoPath: localPhotoPath, ...itemDataToServer } = itemWithTempId;
      
      // STAGE 1: SAVE TEXT DATA
      try {
        log('saveItem STAGE 1: Saving text data');
        dispatch({ type: SAVE_ITEM_STARTED });
        
        // ⭐️ FIXUL CRITIC: Dacă item-ul are _id, ÎNTOTDEAUNA facem update.
        // Asta garantează că item-ul care reintră în sync NU mai face create.
        if (item._id) { 
          savedItemWithId = await updateItem(token, itemDataToServer);
        } else {
          savedItemWithId = await createItem(token, itemDataToServer);
        }
        
        const itemForUi = { 
          ...savedItemWithId, 
          tempId: itemWithTempId.tempId,
          photoPath: localPhotoPath,
          latitude: item.latitude, 
          longitude: item.longitude 
        };
        dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: itemForUi, isPending: false } });
        
        if (itemWithTempId.tempId || itemWithTempId._pendingSync) {
          updatePendingItemsStorage(itemWithTempId, 'remove');
        }

      } catch (error: any) {
        log('saveItem STAGE 1 FAILED', error);
        handleSaveFailed(error, itemWithTempId);
        throw error;
      }

      // STAGE 2: SAVE PHOTO
      if (localPhotoPath && savedItemWithId._id) {
        try {
          log('saveItem STAGE 2: Uploading photo for', savedItemWithId._id);
          dispatch({ type: SAVE_PHOTO_STARTED, payload: { itemId: savedItemWithId._id }});
          
          const photoFile = await getFileFromPath(localPhotoPath);
          await uploadPhoto(token, photoFile, savedItemWithId._id);
          
          log('saveItem STAGE 2 SUCCEEDED');
          const finalItem = { 
            ...savedItemWithId,
            tempId: itemWithTempId.tempId,
            photoPath: localPhotoPath, 
            has_photo: true,
          };
          dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item: finalItem, photoSynced: true } });
          updatePendingPhotosStorage(savedItemWithId._id, 'remove');

        } catch (error: any) {
          log('saveItem STAGE 2 FAILED', error);
          dispatch({ type: SAVE_PHOTO_FAILED, payload: { itemId: savedItemWithId._id } });
          updatePendingPhotosStorage(savedItemWithId._id, 'add', localPhotoPath);
        }
      }
    } finally {
      if (tempId) {
        savingTempIds.current.delete(tempId);
      }
    }
  }, [isOnline, token]);

  // Sync pending items
  const syncPendingItems = useCallback(() => {
    if (!isOnline || !token || isSyncing) return;
    const pendingItems: ItemProps[] = JSON.parse(localStorage.getItem(PENDING_ITEMS_KEY) || '[]');
    const pendingPhotos: PendingPhotoInfo[] = JSON.parse(localStorage.getItem(PENDING_PHOTOS_KEY) || '[]');
    if (pendingItems.length === 0 && pendingPhotos.length === 0) return;
    setIsSyncing(true);
    log(`Syncing ${pendingItems.length} full items and ${pendingPhotos.length} photos`);
    
    const syncFullItems = Promise.all(
      pendingItems.map(async (item: ItemProps) => {
        try {
          await saveItemCallback(item);
        } catch (error) {
          log('Failed to sync full item:', item.tempId, error);
        }
      })
    );
    const syncPhotoOnlyItems = Promise.all(
      pendingPhotos.map(async (pendingPhoto: PendingPhotoInfo) => {
        try {
          log('Syncing photo for item:', pendingPhoto._id);
          const photoFile = await getFileFromPath(pendingPhoto.photoPath!);
          await uploadPhoto(token, photoFile, pendingPhoto._id!);
          const fullItem = items?.find(it => it._id === pendingPhoto._id);
          if (fullItem) {
            dispatch({ 
              type: SAVE_ITEM_SUCCEEDED, 
              payload: { 
                item: { ...fullItem, photoPath: pendingPhoto.photoPath, has_photo: true }, 
                photoSynced: true 
              }
            });
          }
          updatePendingPhotosStorage(pendingPhoto._id, 'remove');
        } catch (error) {
          log('Failed to sync photo:', pendingPhoto._id, error);
        }
      })
    );
    Promise.all([syncFullItems, syncPhotoOnlyItems]).then(() => {
      setIsSyncing(false);
      log('Sync finished');
    });
  }, [isOnline, token, isSyncing, items, saveItemCallback]);
  
  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!token) return;
    if (!isOnline) {
      log('Offline, only merging local data');
      dispatch({ type: MERGE_PENDING_STATUSES });
      return;
    }
    try {
      log('fetchItems started');
      dispatch({ type: FETCH_ITEMS_STARTED });
      const fetchedItems = await getItems(token);
      log('fetchItems succeeded');
      localStorage.setItem('items', JSON.stringify(fetchedItems));
      dispatch({ type: FETCH_ITEMS_SUCCEEDED, payload: { items: fetchedItems } });
    } catch (error) {
      log('fetchItems failed', error);
      dispatch({ type: FETCH_ITEMS_FAILED, payload: { error } });
    } finally {
      dispatch({ type: MERGE_PENDING_STATUSES });
    }
  }, [token, isOnline]);

  // WebSocket effect
  useEffect(() => {
    let canceled = false;
    log('wsEffect - connecting');
    let closeWebSocket: (() => void) | undefined;
    
    if (token?.trim()) {
      closeWebSocket = newWebSocket(token, message => {
        if (canceled) return;
        const { type, payload: item } = message;
        
        if (item.tempId && savingTempIds.current.has(item.tempId)) {
          log('WS: Ignoring message for item we are currently saving', item.tempId);
          return;
        }

        log(`ws message, item ${type} - _id: ${item._id}`);
        dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item } });
      });
    }
    
    return () => {
      log('wsEffect - disconnecting');
      canceled = true;
      closeWebSocket?.();
    };
  }, [token]);
  
  // Storage event listener
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PENDING_ITEMS_KEY || e.key === PENDING_PHOTOS_KEY) {
        log('Storage changed in another tab, merging statuses');
        dispatch({ type: MERGE_PENDING_STATUSES });
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initial load effect
  useEffect(() => {
    log('Initial load: fetching items');
    fetchItems();
  }, [fetchItems]);
  
  // Trigger sync when coming online
  useEffect(() => {
    if (isOnline) {
      log('App is online, triggering sync');
      syncPendingItems();
    }
  }, [isOnline, syncPendingItems]);

  const saveItem = useCallback<SaveItemFn>(saveItemCallback, [saveItemCallback]);
  
  const addItem = useCallback((item: ItemProps) => {
    dispatch({ type: SAVE_ITEM_SUCCEEDED, payload: { item, isPending: true } });
  }, []);

  const loadMore = useCallback(() => {
    log('loadMore called');
    setPage(prev => prev + 1);
  }, []);

  // Filtering & Pagination
  const filteredItems = items?.filter(item => {
    const matchesSearch =
      !searchText ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.scientific_name.toLowerCase().includes(searchText.toLowerCase());
    const matchesFilter = !filterClass || item.class === filterClass;
    return matchesSearch && matchesFilter;
  });
  
  const paginatedItems = filteredItems?.slice(0, (page + 1) * ITEMS_PER_PAGE);
  const hasMoreItems = filteredItems ? (paginatedItems ? filteredItems.length > paginatedItems.length : false) : false;

  const value = { 
    items: paginatedItems,
    fetching, 
    fetchingError, 
    saving, 
    savingError, 
    saveItem, 
    addItem,
    hasMore: hasMoreItems,
    loadMore,
    searchText, 
    setSearchText,
    filterClass, 
    setFilterClass,
  };
  
  return (
    <ItemContext.Provider value={value}>
      {children}
    </ItemContext.Provider>
  );
};