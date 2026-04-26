import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

interface UploaderSummary {
    id: number;
    username: string;
    avatar_url: string | null;
    count: number;
}

interface UserMeme {
    id: number;
    filename: string;
    display_name: string;
    url: string;
}

export default class MemeUsersPage extends Page {
    uploaders: UploaderSummary[] = [];
    selectedUploader: UploaderSummary | null = null;
    userMemes: UserMeme[] = [];
    loading: boolean = true;
    loadingMemes: boolean = false;

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        (this as any).bodyClass = 'App--memes';
        this.loadUploaders();
    }

    async loadUploaders(): Promise<void> {
        this.loading = true;
        try {
            const res = await app.request<{ uploaders: UploaderSummary[] }>({
                method: 'GET',
                url: '/meme-list?scope=uploaders',
            });
            this.uploaders = res.uploaders || [];
        } catch (err) {
            console.error('Load uploaders failed', err);
        }
        this.loading = false;
        m.redraw();
    }

    async selectUploader(u: UploaderSummary): Promise<void> {
        this.selectedUploader = u;
        this.loadingMemes = true;
        this.userMemes = [];
        m.redraw();

        try {
            const res = await app.request<{ memes: UserMeme[] }>({
                method: 'GET',
                url: `/meme-list?scope=user&uploader_id=${u.id}`,
            });
            this.userMemes = res.memes || [];
        } catch (err) {
            console.error('Load user memes failed', err);
        }
        this.loadingMemes = false;
        m.redraw();
    }

    back(): void {
        this.selectedUploader = null;
        this.userMemes = [];
        m.redraw();
    }

    view(): Mithril.Children {
        if (this.selectedUploader) {
            return (
                <div class="MemeAdminPage MemeUsersPage">
                    <div class="container">
                        <div class="MemeAdminPage-header">
                            <button type="button" class="MemeAdminPage-back" onclick={() => this.back()}>
                                <i class="fas fa-chevron-left" />
                                {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.users.back_to_list')}
                            </button>
                            <h2>
                                <img
                                    src={this.selectedUploader.avatar_url || ''}
                                    alt={this.selectedUploader.username}
                                    class="MemeUsersPage-avatar"
                                />
                                {this.selectedUploader.username}
                            </h2>
                        </div>

                        {this.loadingMemes ? (
                            <LoadingIndicator />
                        ) : this.userMemes.length === 0 ? (
                            <div class="MemeGallery-empty">
                                {app.translator.trans('tangyuan-meme-tangyuan.forum.modal.no_user_memes')}
                            </div>
                        ) : (
                            <div class="MemeAdminPage-grid">
                                {this.userMemes.map((meme) => (
                                    <div key={meme.id} class="MemeAdminPage-item MemeAdminPage-item--view">
                                        <div class="MemeAdminPage-itemImage">
                                            <img src={meme.url} alt={meme.display_name} loading="lazy" />
                                        </div>
                                        <div class="MemeAdminPage-itemName" title={meme.display_name}>
                                            {meme.display_name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div class="MemeAdminPage MemeUsersPage">
                <div class="container">
                    <div class="MemeAdminPage-header">
                        <a href={app.route('tangyuan.meme.gallery')} class="MemeAdminPage-back">
                            <i class="fas fa-chevron-left" />
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.back')}
                        </a>
                        <h2>{app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.users.title')}</h2>
                    </div>

                    {this.loading ? (
                        <LoadingIndicator />
                    ) : this.uploaders.length === 0 ? (
                        <div class="MemeGallery-empty">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.users.empty')}
                        </div>
                    ) : (
                        <div class="MemeUsersPage-list">
                            {this.uploaders.map((u) => (
                                <button
                                    type="button"
                                    key={u.id}
                                    class="MemeUsersPage-card"
                                    onclick={() => this.selectUploader(u)}
                                >
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} alt={u.username} class="MemeUsersPage-cardAvatar" />
                                    ) : (
                                        <span class="MemeUsersPage-cardAvatarFallback">
                                            {u.username.slice(0, 1).toUpperCase()}
                                        </span>
                                    )}
                                    <div class="MemeUsersPage-cardBody">
                                        <h4>{u.username}</h4>
                                        <p>
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.gallery.users.count',
                                                { count: u.count }
                                            )}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
