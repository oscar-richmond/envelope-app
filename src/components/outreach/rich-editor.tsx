import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Undo, Redo, Underline as UnderlineIcon, RemoveFormatting } from 'lucide-react';
import { useEffect } from 'react';
import DOMPurify from 'isomorphic-dompurify';

interface RichEditorProps {
    valueHtml: string;
    onChange: (html: string, text: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function RichEditor({ valueHtml, onChange, placeholder, disabled }: RichEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline cursor-pointer',
                },
            }),
        ],
        content: valueHtml || '',
        editable: !disabled,
        editorProps: {
            attributes: {
                class: 'prose prose-sm focus:outline-none max-w-none min-h-[150px] leading-relaxed',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            const text = editor.getText();
            onChange(html, text);
        },
    });

    // Sync content if changed externally (e.g. initial load or reset)
    useEffect(() => {
        if (editor && valueHtml !== editor.getHTML()) {
            // Only update if significantly different to avoid cursor jumps
            // A simple check might be length diff or if editor is empty
            if (editor.getText() === '' && valueHtml) {
                editor.commands.setContent(valueHtml);
            }
        }
    }, [valueHtml, editor]);

    if (!editor) return null;

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        if (url === null) return; // cancelled

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };


    return (
        <div className="flex flex-col flex-1 h-full border border-gray-200 rounded-md overflow-hidden bg-white focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 p-2 border-b border-gray-100 bg-gray-50/50">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    icon={<Bold size={14} />}
                    title="Bold"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    icon={<Italic size={14} />}
                    title="Italic"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    icon={<UnderlineIcon size={14} />}
                    title="Underline"
                />
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton
                    onClick={setLink}
                    isActive={editor.isActive('link')}
                    icon={<LinkIcon size={14} />}
                    title="Link"
                />
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    icon={<List size={14} />}
                    title="Bullet List"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    icon={<ListOrdered size={14} />}
                    title="Numbered List"
                />
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    icon={<Undo size={14} />}
                    title="Undo"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    icon={<Redo size={14} />}
                    title="Redo"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    icon={<RemoveFormatting size={14} />}
                    title="Clear Formatting"
                />
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-4 cursor-text" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div>
    );
}

function ToolbarButton({ onClick, isActive, disabled, icon, title }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-1.5 rounded transition-colors
                ${isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-200'}
                ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
            `}
        >
            {icon}
        </button>
    );
}
