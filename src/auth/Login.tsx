import React, { useCallback, useContext, useEffect, useState } from 'react';
import { RouteComponentProps } from 'react-router';
import { 
  IonButton, 
  IonContent, 
  IonHeader, 
  IonInput, 
  IonLoading, 
  IonPage, 
  IonTitle, 
  IonToolbar,
  IonItem,
  IonLabel
} from '@ionic/react';
import { AuthContext } from './AuthProvider';
import { getLogger } from '../core';
import '../theme/index.css';

const log = getLogger('Login');

interface LoginState {
  username?: string;
  password?: string;
}

export const Login: React.FC<RouteComponentProps> = ({ history }) => {
  const { isAuthenticated, isAuthenticating, login, authenticationError } = useContext(AuthContext);
  const [state, setState] = useState<LoginState>({});
  const { username, password } = state;
  
  const handlePasswordChange = useCallback((e: any) => setState({
    ...state,
    password: e.detail.value || ''
  }), [state]);
  
  const handleUsernameChange = useCallback((e: any) => setState({
    ...state,
    username: e.detail.value || ''
  }), [state]);
  
  const handleLogin = useCallback(() => {
    log('handleLogin...');
    login?.(username, password);
  }, [username, password, login]);
  
  log('render');
  
  useEffect(() => {
    if (isAuthenticated) {
      log('redirecting to home');
      history.push('/');
    }
  }, [isAuthenticated, history]);
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>CTheWorld++</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="scenic-background">
        <div style={{ 
          maxWidth: '400px', 
          margin: '40px auto',
          padding: '20px',
        }}>
          <h2 style={{ textAlign: 'center', color: 'var(--ion-text-color, black)' }}>
            Welcome
          </h2>
          
          <IonItem>
            <IonLabel position="stacked" color="primary"> Username</IonLabel>
            <IonInput
              value={username}
              onIonChange={handleUsernameChange}
              placeholder="Enter username"
            />
          </IonItem>
          
          <IonItem style={{ marginTop: '10px' }}>
            <IonLabel position="stacked" color="primary"> Password</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonChange={handlePasswordChange}
              placeholder="Enter password"
            />
          </IonItem>
          
          {authenticationError && (
            <div style={{ 
              color: '#eb445a', 
              padding: '10px', 
              marginTop: '10px',
              backgroundColor: 'rgba(235, 68, 90, 0.1)',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              {authenticationError.message || 'Failed to authenticate'}
            </div>
          )}
          
          <IonButton 
            expand="block" 
            onClick={handleLogin}
            style={{ marginTop: '20px' }}
            color="primary"
          >
            Login
          </IonButton>
        </div>
        
        <IonLoading isOpen={isAuthenticating} message="Logging in..." />
      </IonContent>
    </IonPage>
  );
};