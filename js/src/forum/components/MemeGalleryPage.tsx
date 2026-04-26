import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LinkButton from 'flarum/common/components/LinkButton';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';
import MemeUploadModal from './MemeUploadModal';

export default class MemeGalleryPage extends Page {
    pendingCount: number = 0;
    mineCount: number = 0;
    userUploadersCount: number = 0;
    loading: boolean = true;
    canModerate: boolean = false;
    canManageOfficial: boolean = false;
    canUpload: boolean = false;

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        (this as any).bodyClass = 'App--memes';
        this.load();
    }

    async load(): Promise<void> {
        try {
            const picker = await app.request<any>({ method: 'GET', url: '/meme-list?scope=picker' });
            this.canModerate = !!picker?.quota?.can_moderate;
            this.canManageOfficial = !!picker?.quota?.can_manage_official;
            this.canUpload = !!picker?.quota?.allow_uploads;
            this.userUploadersCount = (picker?.uploaders || []).length;
            this.mineCount = (picker?.mine || []).length;

            if (this.canModerate) {
                const pending = await app.request<any>({ method: 'GET', url: '/meme-list?scope=pending' });
                this.pendingCount = (pending?.memes || []).length;
            }
        } catch (err) {
            console.error('Gallery load failed', err);
        }

        this.loading = false;
        m.redraw();
    }

    openUpload(): void {
        app.modal.show(MemeUploadModal as any, {
            target: 'user',
            onUploaded: () => this.load(),
        });
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
            <div class="MemeGalleryPage IndexPage">
                <div class="container">
                    <div class="MemeGallery-headingRow">
                        <h2 class="MemeGallery-heading">
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.page_title')}
                        </h2>
                        {this.canUpload && !this.loading && (
                            <Button
                                class="Button Button--primary MemeGallery-uploadBtn"
                                icon="fas fa-upload"
                                onclick={() => this.openUpload()}
                            >
                                {app.translator.trans('tangyuan-meme-tangyuan.forum.gallery.upload_button')}
                            </Button>
                        )}
                    </div>

                    {this.loading ? (
                        <LoadingIndicator />
                    ) : (
                        <div class="MemeGallery-cards">
                            <LinkButton
                                class="MemeGallery-card MemeGallery-card--official"
                                href={app.route('tangyuan.meme.official')}
                            >
                                <div class="MemeGallery-cardIcon">
                                    <i class="fas fa-star-of-life" />
                                </div>
                                <div class="MemeGallery-cardBody">
                                    <h3>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.cards.official.title'
                                        )}
                                    </h3>
                                    <p>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.cards.official.subtitle'
                                        )}
                                    </p>
                                </div>
                            </LinkButton>

                            <LinkButton
                                class="MemeGallery-card MemeGallery-card--mine"
                                href={app.route('tangyuan.meme.my')}
                            >
                                <div class="MemeGallery-cardIcon">
                                    <i class="fas fa-user" />
                                    {this.mineCount > 0 && (
                                        <span class="MemeGallery-cardBadge">{this.mineCount}</span>
                                    )}
                                </div>
                                <div class="MemeGallery-cardBody">
                                    <h3>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.cards.mine.title'
                                        )}
                                    </h3>
                                    <p>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.cards.mine.subtitle',
                                            { count: this.mineCount }
                                        )}
                                    </p>
                                </div>
                            </LinkButton>

                            {this.canModerate && (
                                <LinkButton
                                    class={`MemeGallery-card MemeGallery-card--pending ${
                                        this.pendingCount > 0 ? 'has-pending' : ''
                                    }`}
                                    href={app.route('tangyuan.meme.pending')}
                                >
                                    <div class="MemeGallery-cardIcon">
                                        <i class="fas fa-hourglass-half" />
                                        {this.pendingCount > 0 && (
                                            <span class="MemeGallery-cardBadge">{this.pendingCount}</span>
                                        )}
                                    </div>
                                    <div class="MemeGallery-cardBody">
                                        <h3>
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.gallery.cards.pending.title'
                                            )}
                                        </h3>
                                        <p>
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.gallery.cards.pending.subtitle',
                                                { count: this.pendingCount }
                                            )}
                                        </p>
                                    </div>
                                </LinkButton>
                            )}

                            <LinkButton
                                class="MemeGallery-card MemeGallery-card--users"
                                href={app.route('tangyuan.meme.users')}
                            >
                                <div class="MemeGallery-cardIcon">
                                    <i class="fas fa-users" />
                                </div>
                                <div class="MemeGallery-cardBody">
                                    <h3>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.cards.users.title'
                                        )}
                                    </h3>
                                    <p>
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.gallery.cards.users.subtitle'
                                        )}
                                    </p>
                                </div>
                            </LinkButton>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
