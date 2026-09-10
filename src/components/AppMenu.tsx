import { IonMenu, IonIcon, IonLabel, IonMenuToggle } from '@ionic/react';
import { homeOutline, starOutline, archiveOutline, trashOutline, chatbubbleOutline, settingsOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';

const menuItems = [
  { title: 'All Notes', path: '/home', icon: homeOutline },
  { title: 'Favorites', path: '/favorites', icon: starOutline },
  { title: 'Archive', path: '/archive', icon: archiveOutline },
  { title: 'Trash', path: '/trash', icon: trashOutline },
  { title: 'Ask My Notes', path: '/ask', icon: chatbubbleOutline },
  { title: 'Settings', path: '/settings', icon: settingsOutline },
];

const AppMenu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <IonMenu contentId="main-content" menuId="main-menu" style={{ '--width': '280px' } as React.CSSProperties}>
      <div
        style={{
          margin: '56px 14px 24px 14px',
          background: 'var(--app-card-bg)',
          borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          height: 'calc(100% - 80px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 20px 12px', fontSize: '1.2rem', fontWeight: 700 }}>
          Draftwise
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 10px' }}>
          {menuItems.map((item) => (
            <IonMenuToggle key={item.path} autoHide={false}>
              <div
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: '14px',
                  background: location.pathname === item.path ? 'rgba(79,70,229,0.1)' : 'transparent',
                  cursor: 'pointer', marginBottom: '4px',
                }}
              >
                <IonIcon icon={item.icon} style={{ fontSize: '1.2rem' }} color={location.pathname === item.path ? 'primary' : undefined} />
                <IonLabel style={{ fontWeight: location.pathname === item.path ? 600 : 400 }}>{item.title}</IonLabel>
              </div>
            </IonMenuToggle>
          ))}
        </div>
      </div>
    </IonMenu>
  );
};

export default AppMenu;