import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import MemeUploadModal from './MemeUploadModal';

interface MemeItem {
    id: number;
    type: string;
    filename: string;
    display_name: string;
    url: string;
    size: number;
}

export default class MemeOfficialPage extends Page {
    memes: MemeItem[] = [];
    selected: Set<number> = new Set();
    loading: boolean = true;
    canManage: boolean = false;

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        (this as any).bodyClass = 'App--memes';
        this.load();
    }

    async load(): Promise<void> {
        this.loading = true;
        try {
            const [list, picker] = await Promise.all([
                app.request<{ memes: MemeItem[] }>({ method: 'GET', url: '/meme-list?scope=official' }),
                app.request<any>({ method: 'GET', url: '/meme-list?scope=picker' }),
            ]);
            this.memes = list.memes || [];
            this.canManage = !!picker?.quota?.can_manage_official;
        } catch (err) {
            console.error('Load official memes failed', err);
        }
        this.loading = false;
        m.redraw();
    }

    toggleSelect(id: number): void {
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        m.redraw();
    }

    selectAll(): void {
        if (this.selected.size === this.memes.length) {
            this.selected.clear();
        } else {
            this.memes.forEach((m) => this.selected.add(m.id));
        }
        m.redraw();
    }

    openUpload(): void {
        app.modal.show(MemeUploadModal as any, {
            target: 'official',
            onUploaded: () => this.load(),
        });
    }

    async deleteSelected(): Promise<void> {
        if (this.selected.size === 0) return;
        const count = this.selected.size;
        const confirmed = window.confirm(
            (app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.official.confirm_delete', {
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
            this.load();
        } catch (err) {
            console.error('Delete failed', err);
        }
    }

    view(): Mithril.Children {
        return (
            <div class="MemeAdminPage MemeOfficialPage">
                <div class="container">
                    <div class="MemeAdminPage-header">
                        <a href={app.route('tangyuan.meme.gallery')} class="MemeAdminPage-back">
                            <i class="fas fa-chevron-left" />
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.back')}
                        </a>
                        <h2>{app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.official.title')}</h2>
                        {this.canManage && (
                            <div class="MemeAdminPage-actions">
                                <Button class="Button" onclick={() => this.selectAll()}>
                                    {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.official.select_all')}
                                </Button>
                                {this.selected.size > 0 && (
                                    <Button class="Button Button--danger" onclick={() => this.deleteSelected()}>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.official.delete_selected',
                                            { count: this.selected.size }
                                        )}
                                    </Button>
                                )}
                                <Button class="Button Button--primary" icon="fas fa-upload" onclick={() => this.openUpload()}>
                                    {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.official.upload')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {this.loading ? (
                        <LoadingIndicator />
                    ) : this.memes.length === 0 ? (
                        <div class="MemeGallery-empty">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.official.empty')}
                        </div>
                    ) : (
                        <div class="MemeAdminPage-grid">
                            {this.memes.map((meme) => (
                                <div
                                    key={meme.id}
                                    class={`MemeAdminPage-item ${this.selected.has(meme.id) ? 'is-selected' : ''}`}
                                    onclick={(e: MouseEvent) => {
                                        if (!this.canManage) return;
                                        e.preventDefault();
                                        this.toggleSelect(meme.id);
                                    }}
                                >
                                    <div class="MemeAdminPage-itemImage">
                                        <img src={meme.url} alt={meme.display_name} loading="lazy" />
                                    </div>
                                    <div class="MemeAdminPage-itemName" title={meme.display_name}>
                                        {meme.display_name}
                                    </div>
                                    {this.canManage && (
                                        <div class="MemeAdminPage-itemCheckbox">
                                            <i
                                                class={
                                                    this.selected.has(meme.id) ? 'fas fa-check-square' : 'far fa-square'
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
