import Modal from 'flarum/common/components/Modal';
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

interface UserHit {
    id: number;
    username: string;
    avatar_url: string | null;
}

interface VisibilityAttrs {
    memeId: number;
    initialVisibility: 'public' | 'private';
    initialAllowedUserIds: number[];
    onSaved: (payload: { visibility: 'public' | 'private'; allowed_user_ids: number[] }) => void;
}

export default class MemeVisibilityModal extends Modal<VisibilityAttrs> {
    visibility: 'public' | 'private' = 'public';
    allowed: UserHit[] = [];
    loadingAllowed: boolean = true;
    query: string = '';
    results: UserHit[] = [];
    searching: boolean = false;
    saving: boolean = false;

    private searchTimer: number | null = null;

    className(): string {
        return 'MemeVisibilityModal Modal--medium';
    }

    title() {
        return app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.title');
    }

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        this.visibility = this.attrs.initialVisibility || 'public';
        this.loadAllowedUsers();
    }

    async loadAllowedUsers(): Promise<void> {
        const ids = this.attrs.initialAllowedUserIds || [];
        if (ids.length === 0) {
            this.allowed = [];
            this.loadingAllowed = false;
            m.redraw();
            return;
        }
        try {
            const res = await app.request<{ users: UserHit[] }>({
                method: 'GET',
                url: `/meme-user-search?ids=${encodeURIComponent(ids.join(','))}`,
            });
            this.allowed = res.users || [];
        } catch (err) {
            console.error('Failed to load allowed users', err);
        }
        this.loadingAllowed = false;
        m.redraw();
    }

    handleQueryChange(value: string): void {
        this.query = value;
        if (this.searchTimer !== null) {
            window.clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
        const q = value.trim();
        if (q.length === 0) {
            this.results = [];
            m.redraw();
            return;
        }
        this.searchTimer = window.setTimeout(() => this.doSearch(q), 250);
    }

    async doSearch(q: string): Promise<void> {
        this.searching = true;
        m.redraw();
        try {
            const res = await app.request<{ users: UserHit[] }>({
                method: 'GET',
                url: `/meme-user-search?q=${encodeURIComponent(q)}`,
            });
            this.results = res.users || [];
        } catch (err) {
            console.error('User search failed', err);
            this.results = [];
        }
        this.searching = false;
        m.redraw();
    }

    addAllowed(user: UserHit): void {
        if (this.allowed.some((u) => u.id === user.id)) return;
        this.allowed.push(user);
        m.redraw();
    }

    removeAllowed(userId: number): void {
        this.allowed = this.allowed.filter((u) => u.id !== userId);
        m.redraw();
    }

    async save(): Promise<void> {
        this.saving = true;
        m.redraw();
        try {
            const res = await app.request<{ visibility: 'public' | 'private'; allowed_user_ids: number[] }>({
                method: 'POST',
                url: '/meme-visibility',
                body: {
                    meme_id: this.attrs.memeId,
                    visibility: this.visibility,
                    allowed_user_ids: this.visibility === 'private' ? this.allowed.map((u) => u.id) : [],
                },
            });
            this.attrs.onSaved({ visibility: res.visibility, allowed_user_ids: res.allowed_user_ids });
            this.hide();
        } catch (err) {
            console.error('Save visibility failed', err);
            app.alerts.show({ type: 'error' }, 'Failed to save');
        }
        this.saving = false;
        m.redraw();
    }

    content(): Mithril.Children {
        return (
            <div class="Modal-body MemeVisibilityModal-body">
                <div class="MemeVisibilityModal-options">
                    <label class={`MemeVisibilityModal-option ${this.visibility === 'public' ? 'is-active' : ''}`}>
                        <input
                            type="radio"
                            name="visibility"
                            checked={this.visibility === 'public'}
                            onchange={() => {
                                this.visibility = 'public';
                                m.redraw();
                            }}
                        />
                        <div class="MemeVisibilityModal-optionContent">
                            <i class="fas fa-globe" />
                            <div>
                                <h4>{app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.public')}</h4>
                                <p>{app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.public_desc')}</p>
                            </div>
                        </div>
                    </label>
                    <label class={`MemeVisibilityModal-option ${this.visibility === 'private' ? 'is-active' : ''}`}>
                        <input
                            type="radio"
                            name="visibility"
                            checked={this.visibility === 'private'}
                            onchange={() => {
                                this.visibility = 'private';
                                m.redraw();
                            }}
                        />
                        <div class="MemeVisibilityModal-optionContent">
                            <i class="fas fa-lock" />
                            <div>
                                <h4>{app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.private')}</h4>
                                <p>{app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.private_desc')}</p>
                            </div>
                        </div>
                    </label>
                </div>

                {this.visibility === 'private' && (
                    <div class="MemeVisibilityModal-section">
                        <h4>{app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.allowed_list')}</h4>
                        {this.loadingAllowed ? (
                            <LoadingIndicator />
                        ) : (
                            <div class="MemeVisibilityModal-allowedList">
                                {this.allowed.length === 0 && (
                                    <div class="MemeVisibilityModal-emptyList">
                                        {app.translator.trans(
                                            'tangyuan-meme-tangyuan.forum.visibility.no_allowed_users'
                                        )}
                                    </div>
                                )}
                                {this.allowed.map((user) => (
                                    <div key={user.id} class="MemeVisibilityModal-chip">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt={user.username} />
                                        ) : (
                                            <span class="MemeVisibilityModal-chipFallback">
                                                {user.username.slice(0, 1).toUpperCase()}
                                            </span>
                                        )}
                                        <span>{user.username}</span>
                                        <button
                                            type="button"
                                            onclick={() => this.removeAllowed(user.id)}
                                            aria-label="Remove"
                                        >
                                            <i class="fas fa-times" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div class="MemeVisibilityModal-searchBox">
                            <input
                                type="text"
                                class="FormControl"
                                placeholder={
                                    app.translator.trans(
                                        'tangyuan-meme-tangyuan.forum.visibility.search_placeholder'
                                    ) as unknown as string
                                }
                                value={this.query}
                                oninput={(e: Event) => this.handleQueryChange((e.target as HTMLInputElement).value)}
                            />
                            {this.query.trim() !== '' && (
                                <div class="MemeVisibilityModal-searchResults">
                                    {this.searching ? (
                                        <LoadingIndicator />
                                    ) : this.results.length === 0 ? (
                                        <div class="MemeVisibilityModal-searchEmpty">
                                            {app.translator.trans(
                                                'tangyuan-meme-tangyuan.forum.visibility.no_search_results'
                                            )}
                                        </div>
                                    ) : (
                                        this.results
                                            .filter((r) => !this.allowed.some((a) => a.id === r.id))
                                            .map((user) => (
                                                <button
                                                    type="button"
                                                    key={user.id}
                                                    class="MemeVisibilityModal-searchResult"
                                                    onclick={() => this.addAllowed(user)}
                                                >
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt={user.username} />
                                                    ) : (
                                                        <span class="MemeVisibilityModal-chipFallback">
                                                            {user.username.slice(0, 1).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <span>{user.username}</span>
                                                    <i class="fas fa-plus" />
                                                </button>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div class="MemeVisibilityModal-actions">
                    <Button
                        class="Button Button--primary"
                        loading={this.saving}
                        disabled={this.saving}
                        onclick={() => this.save()}
                    >
                        {app.translator.trans('tangyuan-meme-tangyuan.forum.visibility.save')}
                    </Button>
                </div>
            </div>
        );
    }
}
