import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import MemeUploadModal from './MemeUploadModal';
import MemeVisibilityModal from './MemeVisibilityModal';
import { formatBytes } from '../utils/formatBytes';

interface MyMeme {
    id: number;
    filename: string;
    display_name: string;
    original_filename: string;
    url: string;
    size: number;
    status: string;
    visibility: 'public' | 'private';
    allowed_user_ids?: number[];
    rejection_reason: string | null;
}

interface Quota {
    allow_uploads: boolean;
    max_count: number;
    max_size: number;
    used_count: number;
    used_size: number;
}

export default class MemeMyPage extends Page {
    memes: MyMeme[] = [];
    quota: Quota | null = null;
    selected: Set<number> = new Set();
    loading: boolean = true;

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        (this as any).bodyClass = 'App--memes';
        this.load();
    }

    async load(): Promise<void> {
        this.loading = true;
        try {
            const res = await app.request<{ memes: MyMeme[]; quota: Quota }>({
                method: 'GET',
                url: '/meme-list?scope=mine',
            });
            this.memes = res.memes || [];
            this.quota = res.quota || null;
            this.selected.clear();
        } catch (err) {
            console.error('Load mine memes failed', err);
        }
        this.loading = false;
        m.redraw();
    }

    toggleSelect(id: number): void {
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        m.redraw();
    }

    openUpload(): void {
        app.modal.show(MemeUploadModal as any, {
            target: 'user',
            onUploaded: () => this.load(),
        });
    }

    editVisibility(meme: MyMeme): void {
        app.modal.show(MemeVisibilityModal as any, {
            memeId: meme.id,
            initialVisibility: meme.visibility || 'public',
            initialAllowedUserIds: meme.allowed_user_ids || [],
            onSaved: ({ visibility, allowed_user_ids }: { visibility: 'public' | 'private'; allowed_user_ids: number[] }) => {
                meme.visibility = visibility;
                meme.allowed_user_ids = allowed_user_ids;
                m.redraw();
            },
        });
    }

    async deleteSelected(): Promise<void> {
        if (this.selected.size === 0) return;
        const count = this.selected.size;
        const confirmed = window.confirm(
            (app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.confirm_delete', {
                count,
            }) as unknown as string) || `Delete ${count} memes?`
        );
        if (!confirmed) return;

        try {
            await app.request<any>({
                method: 'POST',
                url: '/meme-admin',
                body: { action: 'delete', ids: Array.from(this.selected) },
            });
            this.selected.clear();
            await this.load();
        } catch (err) {
            console.error('Delete failed', err);
        }
    }

    renameMeme(meme: MyMeme): void {
        const newName = window.prompt(
            (app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.rename_prompt') as unknown as string) || 'Enter new name:',
            meme.display_name
        );
        if (!newName || newName.trim() === '' || newName.trim() === meme.display_name) return;

        app.request<any>({
            method: 'POST',
            url: '/meme-admin',
            body: { action: 'rename', ids: [meme.id], display_name: newName.trim() },
        }).then(() => {
            meme.display_name = newName.trim();
            m.redraw();
        }).catch((err: any) => console.error('Rename failed', err));
    }

    async setAllPrivate(): Promise<void> {
        const confirmed = window.confirm(
            (app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.set_all_private_confirm') as unknown as string) ||
            'Set all your public memes to private?'
        );
        if (!confirmed) return;

        try {
            const res = await app.request<{ updated_count: number }>({
                method: 'POST',
                url: '/meme-admin',
                body: { action: 'set-all-private', ids: [] },
            });
            const count = res.updated_count || 0;
            if (count > 0) {
                app.alerts.show(
                    { type: 'success' },
                    (app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.set_all_private_done', {
                        count,
                    }) as unknown as string) || `Set ${count} memes to private.`
                );
            }
            await this.load();
        } catch (err) {
            console.error('Set all private failed', err);
        }
    }

    view(): Mithril.Children {
        const user = app.session.user;
        if (!user) {
            return (
                <div class="MemeGalleryPage IndexPage">
                    <div class="container">
                        <div class="MemeGallery-empty">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.empty_states.login_required')}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div class="MemeAdminPage MemeMyPage">
                <div class="container">
                    <div class="MemeAdminPage-header">
                        <a href={app.route('tangyuan.meme.gallery')} class="MemeAdminPage-back">
                            <i class="fas fa-chevron-left" />
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.back')}
                        </a>
                        <h2>{app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.title')}</h2>
                        <div class="MemeAdminPage-actions">
                            <Button class="Button" onclick={() => this.setAllPrivate()}>
                                <i class="fas fa-lock" />
                                {' '}
                                {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.set_all_private')}
                            </Button>
                            {this.selected.size > 0 && (
                                <Button class="Button Button--danger" onclick={() => this.deleteSelected()}>
                                    {app.translator.trans(
                                        'tangyuan-meme-tangyuan.forum.gallery.mine.delete_selected',
                                        { count: this.selected.size }
                                    )}
                                </Button>
                            )}
                            {this.quota?.allow_uploads && (
                                <Button class="Button Button--primary" icon="fas fa-upload" onclick={() => this.openUpload()}>
                                    {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.upload')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {this.quota && (
                        <div class="MemeMyPage-quota">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.upload.quota_label', {
                                usedCount: this.quota.used_count,
                                maxCount: this.quota.max_count,
                                usedSize: formatBytes(this.quota.used_size),
                                maxSize: formatBytes(this.quota.max_size),
                            })}
                        </div>
                    )}

                    {this.loading ? (
                        <LoadingIndicator />
                    ) : this.memes.length === 0 ? (
                        <div class="MemeGallery-empty">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.mine.empty')}
                        </div>
                    ) : (
                        <div class="MemeAdminPage-grid">
                            {this.memes.map((meme) => {
                                const isPrivate = meme.visibility === 'private';
                                const allowedCount = meme.allowed_user_ids?.length ?? 0;
                                return (
                                    <div
                                        key={meme.id}
                                        class={`MemeAdminPage-item MemeMyPage-item status-${meme.status} ${
                                            this.selected.has(meme.id) ? 'is-selected' : ''
                                        }`}
                                    >
                                        <div
                                            class="MemeAdminPage-itemImage"
                                            onclick={() => this.toggleSelect(meme.id)}
                                        >
                                            <img src={meme.url} alt={meme.display_name} loading="lazy" />
                                            <span class={`MemeMyPage-statusBadge status-${meme.status}`}>
                                                {app.translator.trans(
                                                    `tangyuan-meme-tangyuan.forum.gallery.mine.status.${meme.status}`
                                                )}
                                            </span>
                                        </div>
                                        <div class="MemeAdminPage-itemName" title={meme.display_name}>
                                            {meme.display_name}
                                        </div>
                                        {meme.status === 'rejected' && meme.rejection_reason && (
                                            <div class="MemeMyPage-rejectReason" title={meme.rejection_reason}>
                                                {meme.rejection_reason}
                                            </div>
                                        )}
                                        <div class="MemeMyPage-controls">
                                            <button
                                                type="button"
                                                class={`MemeMyPage-visibilityBtn ${isPrivate ? 'is-private' : 'is-public'}`}
                                                onclick={() => this.editVisibility(meme)}
                                                title={
                                                    app.translator.trans(
                                                        'tangyuan-meme-tangyuan.forum.visibility.edit_button'
                                                    ) as unknown as string
                                                }
                                            >
                                                <i class={isPrivate ? 'fas fa-lock' : 'fas fa-globe'} />
                                                <span>
                                                    {isPrivate
                                                        ? app.translator.trans(
                                                              'tangyuan-meme-tangyuan.forum.visibility.private_with_count',
                                                              { count: allowedCount }
                                                          )
                                                        : app.translator.trans(
                                                              'tangyuan-meme-tangyuan.forum.visibility.public'
                                                          )}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                class="MemeMyPage-renameBtn"
                                                onclick={() => this.renameMeme(meme)}
                                                title={
                                                    app.translator.trans(
                                                        'tangyuan-meme-tangyuan.forum.gallery.mine.rename'
                                                    ) as unknown as string
                                                }
                                            >
                                                <i class="fas fa-pen" />
                                            </button>
                                            <button
                                                type="button"
                                                class="MemeMyPage-selectBtn"
                                                onclick={() => this.toggleSelect(meme.id)}
                                            >
                                                <i
                                                    class={
                                                        this.selected.has(meme.id)
                                                            ? 'fas fa-check-square'
                                                            : 'far fa-square'
                                                    }
                                                />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
