import React, { useContext, useEffect, useState } from 'react';

import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  isPlatform
} from '@ionic/react';
import { baseUrl, getLogger } from '../core';
import { ItemContext } from './ItemProvider';
import { RouteComponentProps } from 'react-router';
import { ItemProps } from './ItemProps';
import '../theme/animate.css'
import 'leaflet/dist/leaflet.css'; // Leaflet's main CSS
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { camera, locate } from 'ionicons/icons';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';


let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41] 
});

L.Marker.prototype.options.icon = DefaultIcon;

const log = getLogger('ItemEdit');
const getImageUrl = (photoPath: String) => {
    if (!photoPath) return null;
    if (photoPath.startsWith('file:') || photoPath.startsWith('blob:')) {
      return photoPath;
    }
    if (photoPath.startsWith('/')) {
      return `http://${baseUrl}${photoPath}`;
    }
    return photoPath;
  };
interface ItemEditProps extends RouteComponentProps<{
  id?: string;
}> {}

function MapPicker({ onPositionChange }: { onPositionChange: (pos: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng);
    },
  });
  return null; 
}

function LocationMap({ 
  position, 
  onPositionChange 
}: { 
  position: { lat: number, lng: number }, 
  onPositionChange: (pos: { lat: number, lng: number }) => void 
}) {
  return (
    <MapContainer 
      center={[position.lat, position.lng]} 
      zoom={13} 
      style={{ height: '100%', width: '100%' }}
      key={`map-${position.lat}-${position.lng}`}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <Marker position={[position.lat, position.lng]} />
      <MapPicker 
        onPositionChange={(pos) => {
          onPositionChange({ lat: pos.lat, lng: pos.lng });
        }}
      />
    </MapContainer>
  );
}

const ItemEdit: React.FC<ItemEditProps> = ({ history, match }) => {
  const { items, saving, savingError, saveItem } = useContext(ItemContext);
  const [item, setItem] = useState<ItemProps>();
  const [name, setName] = useState('');
  const [noPetals, setNoPetals] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [flowerClass, setFlowerClass] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number, lng: number } | null>(null);

  const [photoPath, setPhotoPath] = useState<string | undefined>();
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  useEffect(() => {
    log('useEffect');
    const routeId = match.params.id || '';
    const foundItem = items?.find(it => 
      it._id === routeId || it.tempId === routeId
    );
    
    setItem(foundItem);
    if (foundItem) {
      setName(foundItem.name);
      setNoPetals(foundItem.no_petals.toString());
      setScientificName(foundItem.scientific_name);
      setFlowerClass(foundItem.class);
      // Load existing photo/location data
      setPhotoPath(foundItem.photoPath);
      setLatitude(foundItem.latitude);
      setLongitude(foundItem.longitude);
    } else {
      setName('');
      setNoPetals('');
      setScientificName('');
      setFlowerClass('');
      setPhotoPath(undefined);
      setLatitude(undefined);
      setLongitude(undefined);
    }
  }, [match.params.id, items]);



const handleDownloadPhoto = () => {
  if (photoPath) {
    if (isPlatform('hybrid')) {
      alert('Photo is already saved permanently on your device.');
      return;
    }
          
    const link = document.createElement('a');
  
    link.href = photoPath;
    
    link.download = `flower_${new Date().getTime()}.jpeg`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    log('Photo download triggered for web platform.');
  } else {
    alert('No photo available to download.');
  }
};

  const handleTakePhoto = async () => {
    try {
      const cameraPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 90,
        allowEditing: false,
      });

      if (!cameraPhoto || !cameraPhoto.webPath) {
        return; // User cancelled
      }

      let savedFilePath = cameraPhoto.webPath;

      // If on a device, save the photo permanently
      if (isPlatform('hybrid')) {
          const response = await fetch(cameraPhoto.webPath);
          const blob = await response.blob();

          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
          
          const base64String = base64Data.split(',')[1];
          const fileName = `${new Date().getTime()}.jpeg`;

          const result = await Filesystem.writeFile({
              path: fileName,
              data: base64String,
              directory: Directory.Data, 
              recursive: true,
          });

          savedFilePath = result.uri; 
          log('Photo saved successfully to:', savedFilePath);
      }

      setPhotoPath(savedFilePath);
    } catch (error) {
      log('Error taking or saving photo:', error);
    }
  };

  const handleSelectLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition();
      const { latitude: lat, longitude: lng } = position.coords;
      
      setMarkerPosition({ lat, lng });
      
      setTimeout(() => {
        setShowMap(true);
      }, 100);
      
      log('Location selected:', position.coords);
    } catch (error) {
      log('Error getting location, using default:', error);

      setMarkerPosition({ lat: 46.7712, lng: 23.6236 });
      
      setTimeout(() => {
        setShowMap(true);
      }, 100);
    }
  };

  const handleSave = () => {
    const local_date = new Date().toISOString();
    
    const editedItem: ItemProps = { 
      ...(item || {}), 
      name, 
      no_petals: parseInt(noPetals) || 0,
      scientific_name: scientificName,
      class: flowerClass, 
      date_added: item?.date_added || local_date,
      has_photo: !!photoPath,
      photoPath: photoPath,
      latitude: latitude,
      longitude: longitude,
    };
    
    if (saveItem) {
      saveItem(editedItem).then(() => {
        history.goBack();
      }).catch(err => {
        log('saveItem error:', err);
      });
    }
  };

  log('render');
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{match.params.id ? 'Edit' : 'New'} Flower</IonTitle>
          <IonButtons slot="end">
            <IonButton 
              onClick={handleSave} 
              className={saving ? 'saving-animation' : ''}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
          <IonInput 
            label="Name" 
            labelPlacement="floating"
            value={name} 
            onIonChange={e => setName(e.detail.value || '')} 
          />
          <IonInput 
            label="Number of Petals" 
            labelPlacement="floating"
            type="number"
            value={noPetals} 
            onIonChange={e => setNoPetals(e.detail.value || '')} 
          />
          <IonInput 
            label="Scientific Name" 
            labelPlacement="floating"
            value={scientificName} 
            onIonChange={e => setScientificName(e.detail.value || '')} 
          />
          <IonInput 
            label="Class" 
            labelPlacement="floating"
            value={flowerClass} 
            onIonChange={e => setFlowerClass(e.detail.value || '')} 
          />
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0' }}>
            <IonButton onClick={handleTakePhoto} fill="outline">
              <IonIcon slot="start" icon={camera} />
              {photoPath ? 'Retake Photo' : 'Take Photo'}
            </IonButton>
            
            <IonButton onClick={handleSelectLocation} fill="outline">
              <IonIcon slot="start" icon={locate} />
              {latitude ? 'Reselect Location' : 'Select Location'}
            </IonButton>


                {photoPath && !isPlatform('hybrid') && (
          <IonButton onClick={handleDownloadPhoto} fill="solid">
              Download Photo
          </IonButton>)}
          
          </div>

          {}
          {photoPath && (
            <div style={{ textAlign: 'center', margin: '15px 0' }}>
              <img 
                src={getImageUrl(photoPath) || "https://img.freepik.com/premium-vector/vector-illustration-cute-flower-drawing-kids-page_925324-8756.jpg"} 
                alt="Item Photo" 
                style={{ width: '100%', maxWidth: '300px', height: '200px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #ddd' }}
              />
            </div>
          )}
          
        {showMap && markerPosition && (
          <div style={{ margin: '15px 0', height: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: '300px', position: 'relative' }}>
              <LocationMap 
                position={markerPosition}
                onPositionChange={(pos) => {
                  log('Map clicked:', pos);
                  setMarkerPosition(pos);
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <IonButton 
                fill="clear" 
                color="danger" 
                onClick={() => setShowMap(false)}
              >
                Cancel
              </IonButton>
              <IonButton 
                fill="solid"
                onClick={() => {
                  setLatitude(markerPosition.lat);
                  setLongitude(markerPosition.lng);
                  setShowMap(false);
                  log('New location confirmed:', markerPosition);
                }}
              >
                Confirm Location
              </IonButton>
            </div>
          </div>
        )}

        <IonLoading isOpen={saving} />
        {savingError && (
          <div className="ion-padding" style={{ color: 'red', textAlign: 'center' }}>
            {savingError.message || 'Failed to save item'}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ItemEdit;