import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { IonIcon } from '@ionic/react';
import {
  textOutline, listOutline, checkboxOutline
} from 'ionicons/icons';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string; // markdown string
  onChange: (markdown: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder }) => {
  const editor = useEditor({
  extensions: [
    StarterKit.configure({}),
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      html: false,
      tightLists: true,
    }),
  ],
  content,
  onUpdate: ({ editor }) => {
    const markdown = (editor.storage as any).markdown.getMarkdown();
    onChange(markdown);
  },
  editorProps: {
    attributes: {
      class: 'rich-editor-content',
    },
  },
});

useEffect(() => {
  if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
    editor.commands.setContent(content, { emitUpdate: false });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [content, editor]);

  if (!editor) return null;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: '8px',
    background: active ? 'var(--ion-color-primary)' : 'transparent',
    color: active ? '#fff' : 'inherit',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button style={btnStyle(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button style={btnStyle(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button style={btnStyle(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
        <button style={btnStyle(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button style={btnStyle(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button style={btnStyle(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <IonIcon icon={listOutline} />
        </button>
        <button style={btnStyle(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
        <button style={btnStyle(editor.isActive('taskList'))} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <IonIcon icon={checkboxOutline} />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;