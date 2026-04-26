import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import TextEditorButton from 'flarum/common/components/TextEditorButton';
import app from 'flarum/forum/app';

import MemePickerModal from './components/MemePickerModal';

export default function addMemeButton() {
    extend(TextEditor.prototype, 'toolbarItems', function (items) {
        const composer = this.attrs.composer;

        if (!composer?.editor) return;

        if (items.has?.('meme')) return;

        const label = app.translator.trans('tangyuan-meme-tangyuan.forum.composer.meme_tooltip');

        items.add(
            'meme',
            <TextEditorButton
                icon="far fa-smile-beam"
                onclick={() => {
                    app.modal.show(MemePickerModal as any, {
                        composer,
                        onSelect: (meme: { id: number; filename: string; name: string }) => {
                            composer.editor.insertAtCursor(`[tangyuan-meme src="${meme.id}"][/tangyuan-meme] `);
                        },
                    });
                }}
                className="Button--meme"
                title={label}
                aria-label={label}
            >
                {label}
            </TextEditorButton>
        );
    });
}
