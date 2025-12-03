import React, { useContext, useRef, useState, useEffect } from 'react';
import { RouteComponentProps } from 'react-router';
import {
    IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonList, IonLoading,
    IonPage, IonTitle, IonToolbar, IonSearchbar, IonSelect, IonSelectOption,
    IonBadge, IonChip, IonLabel, IonButton, IonButtons, IonInfiniteScroll,
    IonInfiniteScrollContent, IonModal, isPlatform
} from '@ionic/react';
import { add, logOutOutline, wifiOutline, cloudOfflineOutline, locate, close, star, helpCircleOutline } from 'ionicons/icons';
import { ItemContext } from './ItemProvider';
import { AuthContext } from '../auth/AuthProvider';
import Item from './Item';
import { ItemProps } from './ItemProps';
import '../theme/theme.css';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { createAnimation } from '@ionic/react';
import type { Animation } from '@ionic/core'

const customEnterAnimation = (baseEl: any): Animation => {
  const backdrop = createAnimation()
    .addElement(baseEl.querySelector('ion-backdrop')!)
    .fromTo('opacity', '0.01', 'var(--backdrop-opacity)'); 

  const wrapper = createAnimation()
    .addElement(baseEl.querySelector('.loading-wrapper')!) 
    .keyframes([
      { offset: 0, opacity: '0', transform: 'scale(0.8)' },
      { offset: 1, opacity: '1', transform: 'scale(1)' }
    ]);

  return createAnimation()
    .addElement(baseEl)
    .easing('ease-in-out')
    .duration(300)
    .addAnimation([backdrop, wrapper]);
};

const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    return isOnline;
};

L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });

const ItemMapViewer: React.FC<{ lat: number; lon: number }> = ({ lat, lon }) => {
    const mapRef = useRef<any>(null);
    useEffect(() => {
        const timer = setTimeout(() => mapRef.current?.invalidateSize(), 100);
        return () => clearTimeout(timer);
    }, []);
    return (
        <MapContainer center={[lat, lon]} zoom={15} style={{ height: '100%', width: '100%' }} ref={mapRef}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            <Marker position={[lat, lon]} />
        </MapContainer>
    );
};

const ItemList: React.FC<RouteComponentProps> = ({ history }) => {
    const { 
        items, fetching, fetchingError, hasMore, loadMore, 
        searchText, setSearchText, filterRating, setFilterRating,
        filterVisitAgain, setFilterVisitAgain 
    } = useContext(ItemContext);

    const isOnline = useNetworkStatus(); 
    const { logout } = useContext(AuthContext);
    const contentRef = useRef<HTMLIonContentElement>(null);
    const [mapLocation, setMapLocation] = useState<{ lat: number; lon: number } | null>(null);

    const handleLogout = () => { logout?.(); history.push('/login'); };
    const handleInfiniteScroll = async (ev: any) => { loadMore?.(); setTimeout(() => ev.target.complete(), 500); };
    const handleLocateResource = (e: React.MouseEvent, lat: number, lon: number) => {
        e.stopPropagation();
        if (lat && lon && !isNaN(lat) && !isNaN(lon)) setMapLocation({ lat, lon });
    };

    const getPendingMessage = (item: Partial<ItemProps>) => {
        if (item._pendingSync || (item.tempId && !item._id)) return "Item Sync Pending";
        if (item._photoPendingSync) return "Photo Sync Pending";
        return null;
    };

    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 0; i < 5; i++) {
            stars.push(
                <IonIcon 
                    key={i} 
                    icon={star} 
                    style={{ fontSize: '1.2rem', marginRight: '2px' }}
                    color={i < rating ? 'tertiary' : 'medium'} 
                />
            );
        }
        return <div style={{ display: 'flex' }}>{stars}</div>;
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Where I've traveled ✈️</IonTitle>
                   
                    <IonButtons slot="end">
                        <IonChip color={isOnline ? 'success' : 'danger'}>
                            <IonIcon icon={isOnline ? wifiOutline : cloudOfflineOutline} />
                            <IonLabel>{isOnline ? 'Online' : 'Offline'}</IonLabel>
                        </IonChip>
                     <IonButton onClick={() => history.push('/guide')}>
                    <IonIcon icon={helpCircleOutline} />
                    </IonButton>
                        <IonButton onClick={handleLogout}><IonIcon slot="icon-only" icon={logOutOutline} /></IonButton>
                    </IonButtons>
                </IonToolbar>
                <IonToolbar>
                    <IonSearchbar value={searchText} onIonInput={e => setSearchText?.(e.detail.value || '')} placeholder="Search by name" debounce={300} />
                </IonToolbar>
                <IonToolbar>
                    <div style={{ display: 'flex', padding: '0 10px' }}>
                        <IonSelect 
                            value={filterRating} 
                            placeholder="Rating" 
                            onIonChange={e => setFilterRating?.(e.detail.value)} 
                            interface="popover"
                            style={{ width: '50%' }}
                        >
                            <IonSelectOption value={undefined}>All Ratings</IonSelectOption>
                            <IonSelectOption value={5}>5 Stars</IonSelectOption>
                            <IonSelectOption value={4}>4 Stars</IonSelectOption>
                            <IonSelectOption value={3}>3 Stars</IonSelectOption>
                            <IonSelectOption value={2}>2 Stars</IonSelectOption>
                            <IonSelectOption value={1}>1 Star</IonSelectOption>
                        </IonSelect>
                        
                        <IonSelect 
                            value={filterVisitAgain} 
                            placeholder="Visit?" 
                            onIonChange={e => setFilterVisitAgain?.(e.detail.value)} 
                            interface="popover"
                            style={{ width: '50%' }}
                        >
                            <IonSelectOption value="all">Show All</IonSelectOption>
                            <IonSelectOption value="yes">Visit Again</IonSelectOption>
                            <IonSelectOption value="no">One Time</IonSelectOption>
                        </IonSelect>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent ref={contentRef} className = 'scenic-background'>
                <IonLoading isOpen={fetching} message="Fetching items..."
                      enterAnimation={customEnterAnimation} leaveAnimation={customEnterAnimation} />
                {items && (
                    <IonList>
                        {items.map(item => {
                            const pendingMessage = getPendingMessage(item);
                            return (
                                <div key={item._id || item.tempId} style={{ position: 'relative' }}>
                                    {pendingMessage && <IonBadge color="warning" style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, fontSize: '0.7rem', padding: '4px 8px' }}>{pendingMessage}</IonBadge>}
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ flexGrow: 1 }}>
                                            <Item {...item} onEdit={id => history.push(`/item/${id || item.tempId}`)} />
                                            {/* Rating and Visit Again Status Display */}
                                            <div style={{ padding: '0 16px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {renderStars(item.rating)}
                                                {item.visit_again && <IonChip color="secondary" style={{ height: '20px', fontSize: '0.7rem' }}>Visit Again</IonChip>}
                                            </div>
                                        </div>
                                        {item.latitude !== undefined && item.longitude !== undefined && (
                                            <IonButton fill="clear" onClick={e => handleLocateResource(e, item.latitude!, item.longitude!)} style={{ marginInlineEnd: 10 }} title="View on Map">
                                                <IonIcon icon={locate} slot="icon-only" color="secondary" />
                                            </IonButton>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </IonList>
                )}

                <IonInfiniteScroll onIonInfinite={handleInfiniteScroll} threshold="100px" disabled={!hasMore || fetching}>
                    <IonInfiniteScrollContent loadingSpinner="bubbles" loadingText="Loading more items..." />
                </IonInfiniteScroll>

                {fetchingError && <div className="ion-padding" style={{ color: 'red', textAlign: 'center' }}>{fetchingError.message || 'Failed to fetch items'}</div>}
                {!hasMore && !fetching && items && items.length > 0 && <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>No more items</div>}
                {!fetching && (!items || items.length === 0) && <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>No items found. Add your first item!</div>}

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton onClick={() => history.push('/item')}><IonIcon icon={add} /></IonFabButton>
                </IonFab>
            </IonContent>

            <IonModal isOpen={!!mapLocation} onDidDismiss={() => setMapLocation(null)} {...(isPlatform('mobile') ? { swipeToClose: true, initialBreakpoint: 0.9, breakpoints: [0, 0.9, 1] } : {})}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Item Location</IonTitle>
                        <IonButtons slot="end"><IonButton onClick={() => setMapLocation(null)}><IonIcon slot="icon-only" icon={close} /></IonButton></IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-no-padding">
                    {mapLocation && <div style={{ height: '100%', width: '100%' }}><ItemMapViewer key={`${mapLocation.lat}-${mapLocation.lon}`} lat={mapLocation.lat} lon={mapLocation.lon} /></div>}
                </IonContent>
            </IonModal>
        </IonPage>
    );
};

export default ItemList;