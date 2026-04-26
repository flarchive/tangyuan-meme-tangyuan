import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

interface PendingMeme {
    id: number;
    filename: string;
    display_name: string;
    original_filename: string;
    url: string;
    size: number;
    uploader?: { id: number; username: string; avatar_url: string | null };
    created_at?: string;
}

export default class MemePendingPage extends Page {
    memes: PendingMeme[] = [];
    selected: Set<number> = new Set();
    loading: boolean = true;
    submitting: boolean = false;
    showReasonDialog: boolean = false;

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        (this as any).bodyClass = 'App--memes';
        this.load();
    }

    async load(): Promise<void> {
        this.loading = true;
        try {
            const res = await app.request<{ memes: PendingMeme[] }>({ method: 'GET', url: '/meme-list?scope=pending' });
            this.memes = res.memes || [];
            this.selected.clear();
        } catch (err) {
            console.error('Pending load failed', err);
        }
        this.loading = false;
        m.redraw();
    }

    toggleSelect(id: number): void {
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        m.redraw();
    }

    async approveAll(): Promise<void> {
        const ids = this.memes.map((m) => m.id);
        await this.doModerate('approve', ids);
    }

    async approveSelected(): Promise<void> {
        const ids = Array.from(this.selected);
        if (ids.length === 0) return;
        await this.doModerate('approve', ids);
    }

    async rejectSelected(): Promise<void> {
        const ids = Array.from(this.selected);
        if (ids.length === 0) return;
        const reason = window.prompt(
            app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.pending.reason_prompt') as unknown as string,
            ''
        );
        if (reason === null) return;
        await this.doModerate('reject', ids, reason);
    }

    async doModerate(action: 'approve' | 'reject', ids: number[], reason?: string): Promise<void> {
        if (ids.length === 0) return;
        this.submitting = true;
        m.redraw();
        try {
            await app.request<any>({
                method: 'POST',
                url: '/meme-admin',
                body: { action, ids, reason: reason ?? null },
            });
            await this.load();
        } catch (err) {
            console.error('Moderation action failed', err);
        }
        this.submitting = false;
        m.redraw();
    }

    view(): Mithril.Children {
        return (
            <div class="MemeAdminPage MemePendingPage">
                <div class="container">
                    <div class="MemeAdminPage-header">
                        <a href={app.route('tangyuan.meme.gallery')} class="MemeAdminPage-back">
                            <i class="fas fa-chevron-left" />
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.back')}
                        </a>
                        <h2>{app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.pending.title')}</h2>
                        {this.memes.length > 0 && (
                            <div class="MemeAdminPage-actions">
                                <Button class="Button Button--primary" loading={this.submitting} onclick={() => this.approveAll()}>
                                    {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.pending.approve_all')}
                                </Button>
                                {this.selected.size > 0 && (
                                    <>
                                        <Button
                                            class="Button"
                                            loading={this.submitting}
                                            onclick={() => this.approveSelected()}
                                        >
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.gallery.pending.approve_selected',
                                                { count: this.selected.size }
                                            )}
                                        </Button>
                                        <Button
                                            class="Button Button--danger"
                                            loading={this.submitting}
                                            onclick={() => this.rejectSelected()}
                                        >
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.gallery.pending.reject_selected',
                                                { count: this.selected.size }
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {this.loading ? (
                        <LoadingIndicator />
                    ) : this.memes.length === 0 ? (
                        <div class="MemeGallery-empty">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.pending.empty')}
                        </div>
                    ) : (
                        <div class="MemeAdminPage-grid">
                            {this.memes.map((meme) => (
                                <div
                                    key={meme.id}
                                    class={`MemeAdminPage-item MemeAdminPage-item--pending ${
                                        this.selected.has(meme.id) ? 'is-selected' : ''
                                    }`}
                                    onclick={(e: MouseEvent) => {
                                        e.preventDefault();
                                        this.toggleSelect(meme.id);
                                    }}
                                >
                                    <div class="MemeAdminPage-itemImage">
                                        <img src={meme.url} alt={meme.display_name} loading="lazy" />
                                    </div>
                                    <div class="MemeAdminPage-itemName" title={meme.original_filename}>
                                        {meme.original_filename}
                                    </div>
                                    {meme.uploader && (
                                        <div class="MemeAdminPage-itemMeta">
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.gallery.pending.from_user',
                                                { uploaderName: meme.uploader.username }
                                            )}
                                        </div>
                                    )}
                                    <div class="MemeAdminPage-itemCheckbox">
                                        <i
                                            class={
                                                this.selected.has(meme.id) ? 'fas fa-check-square' : 'far fa-square'
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
