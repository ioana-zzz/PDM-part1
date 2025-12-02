import React, { useContext } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

import { AuthContext, AuthProvider } from './auth';
import { NetworkProvider } from './network/NetworkProvider';
import { ItemProvider } from './todo/ItemProvider';
import ItemList from './todo/ItemList';
import ItemEdit from './todo/ItemEdit';
import {Login} from './auth/Login';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <NetworkProvider>
        <AppContent />
      </NetworkProvider>
    </AuthProvider>
  </IonApp>
);

const AppContent: React.FC = () => {
  const { isAuthenticated } = useContext(AuthContext);

  return (
    <IonReactRouter>
      <ItemProvider>
        <IonRouterOutlet>
          <Route path="/login" component={Login} exact={true} />
          <Route path="/item/:id" exact={true} render={(props) => {
            if (!isAuthenticated) return <Redirect to="/login" />;
            return <ItemEdit {...props} />;
          }} />
          <Route path="/item" exact={true} render={(props) => {
            if (!isAuthenticated) return <Redirect to="/login" />;
            return <ItemEdit {...props} />;
          }} />
          <Route path="/" exact={true} render={(props) => {
            if (!isAuthenticated) return <Redirect to="/login" />;
            return <ItemList {...props} />;
          }} />
        </IonRouterOutlet>
      </ItemProvider>
    </IonReactRouter>
  );
};




export default App;