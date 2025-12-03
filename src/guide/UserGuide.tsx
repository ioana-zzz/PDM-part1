import React from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonText
} from '@ionic/react';
import { 
  wifi, 
  cloudOffline, 
  sync, 
  camera, 
  map, 
  star 
} from 'ionicons/icons';

const UserGuide: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/items" />
          </IonButtons>
          <IonTitle>How to Use</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="scenic-background">
        <div style={{ padding: '10px' }}>
          
          {/* Intro Card */}
          <IonCard style={{ background: 'rgba(255,255,255,0.95)' }}>
            <IonCardHeader>
              <IonCardTitle>Welcome Traveler! ✈️</IonCardTitle>
              <IonCardSubtitle>Track your adventures with ease</IonCardSubtitle>
            </IonCardHeader>
            <IonCardContent>
              This app helps you log your trips, save photos, and remember the best spots. Here is a quick guide on how to get the most out of it.
            </IonCardContent>
          </IonCard>

          {/* Offline Mode Card */}
          <IonCard style={{ background: 'rgba(255,255,255,0.95)' }}>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={cloudOffline} style={{ verticalAlign: 'middle', marginRight: '8px' }} color="tertiary"/>
                Offline Mode
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p><strong>No Internet? No Problem.</strong></p>
              <p>You can add new items or edit existing ones even without a connection. Your changes are saved locally.</p>
              <br />
              <p><strong><IonIcon icon={sync} /> Syncing:</strong></p>
              <p>When you reconnect to the internet, look for the status indicator at the top right. The app will automatically sync your changes to the cloud.</p>
            </IonCardContent>
          </IonCard>

          {/* Features Card */}
          <IonCard style={{ background: 'rgba(255,255,255,0.95)' }}>
            <IonCardHeader>
              <IonCardTitle>Features</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText color="dark">
                <p style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <IonIcon icon={camera} slot="start" style={{ fontSize: '24px', marginRight: '10px', color: '#06b6d4' }} />
                  <strong>Photos:</strong> Snap a picture or upload one to remember the view.
                </p>
                <p style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <IonIcon icon={map} slot="start" style={{ fontSize: '24px', marginRight: '10px', color: '#10b981' }} />
                  <strong>Location:</strong> Pin the exact spot on the map so you can find it later.
                </p>
                <p style={{ display: 'flex', alignItems: 'center' }}>
                  <IonIcon icon={star} slot="start" style={{ fontSize: '24px', marginRight: '10px', color: '#f97316' }} />
                  <strong>Ratings:</strong> Rate your experience from 1 to 5 stars.
                </p>
              </IonText>
            </IonCardContent>
          </IonCard>

          {/* Tips Card */}
          <IonCard style={{ background: 'rgba(255,255,255,0.95)' }}>
            <IonCardHeader>
              <IonCardTitle>Pro Tips 💡</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <ul>
                <li>Use the <strong>"Visit Again"</strong> filter to quickly find your favorite spots for your next trip.</li>
                <li>Items glowing with an <strong>Animation</strong> are waiting to be synced to the server.</li>
              </ul>
            </IonCardContent>
          </IonCard>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default UserGuide;