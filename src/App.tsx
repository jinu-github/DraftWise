import { useEffect, useState } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet,IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Home from './pages/Home';
import NoteEditor from './pages/NoteEditor';
import Favorites from './pages/Favorites';
import Archive from './pages/Archive';
import Trash from './pages/Trash';
import AppMenu from './components/AppMenu';
import AskNotes from './pages/AskNotes';
import Settings from './pages/Settings';
import { getTheme, applyTheme } from './services/settings';

import { databaseService } from './services/database';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.class.css';
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await databaseService.init();
        const theme = await getTheme();
        applyTheme(theme);
        setDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    initializeDatabase();
  }, []);

  if (!dbReady) {
    return (
      <IonApp>
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      </IonApp>
    );
  }

  return (
  <IonApp>
    <IonReactRouter>
      <IonSplitPane contentId="main-content">
        <AppMenu />
        <IonRouterOutlet id="main-content">
          <Route path="/home" element={<Home />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/note/new" element={<NoteEditor />} />
          <Route path="/note/:id" element={<NoteEditor />} />
          <Route path="/ask" element={<AskNotes />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/settings" element={<Settings />} />
        </IonRouterOutlet>
      </IonSplitPane>
    </IonReactRouter>
  </IonApp>
  );
};

export default App;