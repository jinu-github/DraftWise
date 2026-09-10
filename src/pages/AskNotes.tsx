import { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, IonInput, IonIcon, IonSpinner
} from '@ionic/react';
import { send } from 'ionicons/icons';
import { databaseService } from '../services/database';
import { askAboutNotes } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const AskNotes: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const relevantNotes = await databaseService.searchNotesForContext(question);
      const answer = await askAboutNotes(
        question,
        relevantNotes.map((n) => ({ title: n.title, content: n.content }))
      );
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: err instanceof Error ? `Error: ${err.message}` : 'Something went wrong.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Ask My Notes</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '80px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>
              Ask something like "What did I write about React?" or "Summarize my notes about databases."
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? 'var(--ion-color-primary)' : 'var(--app-card-bg)',
                color: msg.role === 'user' ? '#fff' : 'inherit',
                padding: '10px 14px',
                borderRadius: '14px',
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
              }}
            >
              {msg.role === 'assistant' ? (
                <div className="markdown-chat-bubble">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                msg.text
              )}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '10px 14px' }}>
              <IonSpinner name="dots" />
            </div>
          )}
        </div>
      </IonContent>

      <IonToolbar
        className="ion-no-border"
        style={{
          position: 'sticky',
          bottom: 0,
          '--background': 'transparent',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px 4px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--app-card-bg)',
              borderRadius: '24px',
              padding: '10px 16px',
              boxShadow: 'var(--app-card-shadow)',
            }}
          >
            <IonInput
              value={input}
              placeholder="Ask about your notes…"
              onIonInput={(e) => setInput(e.detail.value ?? '')}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              style={{ '--padding-start': '0', fontSize: '14px' } as React.CSSProperties}
            />
          </div>
          <button
            onClick={handleAsk}
            disabled={loading}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: loading ? 'var(--ion-color-medium)' : 'var(--ion-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IonIcon icon={send} style={{ color: '#fff', fontSize: '18px' }} />
          </button>
        </div>
      </IonToolbar>
    </IonPage>
  );
};

export default AskNotes;