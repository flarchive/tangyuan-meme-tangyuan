import Modal from 'flarum/common/components/Modal';
import app from 'flarum/forum/app';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';
import { attachLongPress } from '../utils/longPress';
import MemeUploadModal from './MemeUploadModal';

interface MemeItem {
    id: number;
    type: 'official' | 'user';
    uploader_id: number | null;
    filename: string;
    display_name: string;
    default_name: string;
    status: string;
    url: string;
    is_favorite: boolean;
    visibility?: 'public' | 'private';
    allowed_user_ids?: number[];
}

interface UploaderInfo {
    id: number;
    username: string;
    avatar_url: string | null;
}

interface PickerResponse {
    official: MemeItem[];
    mine: MemeItem[];
    favorites: number[];
    custom_names: Record<string, string>;
    pinned_uploader_ids: number[];
    uploaders: UploaderInfo[];
    cache_base_url: string;
    quota: {
        allow_uploads: boolean;
        can_moderate: boolean;
        can_manage_official: boolean;
        max_count: number;
        max_size: number;
        used_count: number;
        used_size: number;
        allowed_formats: string;
    };
}

type TabKey = 'official' | 'mine' | 'favorites' | string; // 'user-<id>'

interface MemeAttrs {
    composer: any;
    onSelect: (meme: { id: number; filename: string; name: string }) => void;
}

export default class MemePickerModal extends Modal<MemeAttrs> {
    official: MemeItem[] = [];
    mine: MemeItem[] = [];
    userMemesByUploader: Record<number, MemeItem[]> = {};
    loadingUserIds: Record<number, boolean> = {};
    favorites: Set<number> = new Set();
    pinnedUploaderIds: number[] = [];
    uploaders: UploaderInfo[] = [];
    quota: PickerResponse['quota'] | null = null;

    loading: boolean = true;
    searchQuery: string = '';
    activeTab: TabKey = 'official';

    // Context menu state for a meme item
    contextMenuMeme: MemeItem | null = null;
    contextMenuPos: { x: number; y: number } = { x: 0, y: 0 };

    // Context menu state for a user tab
    contextMenuUploader: UploaderInfo | null = null;
    tabContextMenuPos: { x: number; y: number } = { x: 0, y: 0 };

    // Name input dialog
    showNameInput: boolean = false;
    initialEditingName: string = '';

    private portalEl: HTMLDivElement | null = null;
    private boundOutsideClick: (e: MouseEvent) => void = this.handleOutsideClick.bind(this);
    private boundEscapeKey: (e: KeyboardEvent) => void = this.handleEscapeKey.bind(this);
    private tabCleanups: Array<() => void> = [];
    private itemCleanups: Array<() => void> = [];

    className(): string {
        return 'MemePickerModal Modal--large';
    }

    title() {
        return app.translator.trans('tangyuan-meme-tangyuan.forum.modal.title');
    }

    oncreate(vnode: Mithril.VnodeDOM): void {
        super.oncreate(vnode);
        this.portalEl = document.createElement('div');
        this.portalEl.className = 'MemeContextMenuPortal';
        document.body.appendChild(this.portalEl);
        document.addEventListener('mousedown', this.boundOutsideClick, true);
        document.addEventListener('keydown', this.boundEscapeKey, true);
        this.loadInitial();
    }

    onupdate(vnode: Mithril.VnodeDOM): void {
        super.onupdate(vnode);
        this.renderPortal();
        this.attachLongPressHandlers(vnode.dom as HTMLElement);
    }

    onremove(vnode: Mithril.VnodeDOM): void {
        super.onremove(vnode);
        document.removeEventListener('mousedown', this.boundOutsideClick, true);
        document.removeEventListener('keydown', this.boundEscapeKey, true);
        this.tabCleanups.forEach((fn) => fn());
        this.itemCleanups.forEach((fn) => fn());
        if (this.portalEl) {
            m.render(this.portalEl, null);
            this.portalEl.remove();
            this.portalEl = null;
        }
    }

    async loadInitial(): Promise<void> {
        try {
            const response = await app.request<PickerResponse>({
                method: 'GET',
                url: '/meme-list?scope=picker',
            });

            this.official = response.official || [];
            this.mine = response.mine || [];
            this.favorites = new Set(response.favorites || []);
            this.pinnedUploaderIds = response.pinned_uploader_ids || [];
            this.uploaders = response.uploaders || [];
            this.quota = response.quota;

            for (const id of Object.keys(response.custom_names || {})) {
                const memeId = Number(id);
                const customName = response.custom_names[id];
                const target = [...this.official, ...this.mine].find((m) => m.id === memeId);
                if (target) target.display_name = customName;
            }

            this.official.forEach((m) => (m.is_favorite = this.favorites.has(m.id)));
            this.mine.forEach((m) => (m.is_favorite = this.favorites.has(m.id)));
        } catch (err) {
            console.error('Failed to load memes', err);
        }
        this.loading = false;
        m.redraw();
    }

    async loadUserMemes(uploaderId: number): Promise<void> {
        if (this.userMemesByUploader[uploaderId]) return;
        this.loadingUserIds[uploaderId] = true;
        m.redraw();
        try {
            const res = await app.request<{ memes: MemeItem[] }>({
                method: 'GET',
                url: `/meme-list?scope=user&uploader_id=${uploaderId}`,
            });
            this.userMemesByUploader[uploaderId] = res.memes || [];
            this.userMemesByUploader[uploaderId].forEach((m) => (m.is_favorite = this.favorites.has(m.id)));
        } catch (err) {
            console.error('Failed to load user memes', err);
            this.userMemesByUploader[uploaderId] = [];
        }
        this.loadingUserIds[uploaderId] = false;
        m.redraw();
    }

    handleOutsideClick(e: MouseEvent): void {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (this.showNameInput) return;
        if (target.closest('.MemeContextMenu')) return;
        if (target.closest('.MemeTabContextMenu')) return;
        let changed = false;
        if (this.contextMenuMeme) {
            this.contextMenuMeme = null;
            changed = true;
        }
        if (this.contextMenuUploader) {
            this.contextMenuUploader = null;
            changed = true;
        }
        if (changed) m.redraw();
    }

    handleEscapeKey(e: KeyboardEvent): void {
        if (e.key !== 'Escape') return;
        if (this.showNameInput) {
            e.stopPropagation();
            this.showNameInput = false;
            this.contextMenuMeme = null;
            m.redraw();
        } else if (this.contextMenuMeme || this.contextMenuUploader) {
            e.stopPropagation();
            this.contextMenuMeme = null;
            this.contextMenuUploader = null;
            m.redraw();
        }
    }

    async toggleFavorite(meme: MemeItem, e: MouseEvent): Promise<void> {
        e.stopPropagation();
        e.preventDefault();
        try {
            const response = await app.request<{ is_favorite: boolean }>({
                method: 'POST',
                url: '/meme-favorite',
                body: { meme_id: meme.id, action: 'toggle_favorite' },
            });
            meme.is_favorite = response.is_favorite;
            if (response.is_favorite) this.favorites.add(meme.id);
            else this.favorites.delete(meme.id);
            this.contextMenuMeme = null;
            m.redraw();
        } catch (err) {
            console.error('Failed to toggle favorite', err);
        }
    }

    async saveCustomName(meme: MemeItem, inputEl: HTMLInputElement | null): Promise<void> {
        let name = inputEl ? inputEl.value : '';
        if (name.length > 15) name = name.substring(0, 15);
        name = name.trim();

        try {
            await app.request<any>({
                method: 'POST',
                url: '/meme-favorite',
                body: { meme_id: meme.id, action: 'set_custom_name', custom_name: name },
            });
            meme.display_name = name || meme.default_name;
            this.showNameInput = false;
            this.contextMenuMeme = null;
            m.redraw();
        } catch (err) {
            console.error('Failed to update custom name', err);
        }
    }

    async togglePinUploader(uploader: UploaderInfo): Promise<void> {
        const pinned = this.pinnedUploaderIds.includes(uploader.id);
        try {
            const res = await app.request<{ pinned_uploader_ids: number[] }>({
                method: 'POST',
                url: '/meme-favorite',
                body: {
                    action: pinned ? 'unpin_uploader' : 'pin_uploader',
                    uploader_id: uploader.id,
                },
            });
            this.pinnedUploaderIds = res.pinned_uploader_ids || [];
            this.contextMenuUploader = null;
            m.redraw();
        } catch (err) {
            console.error('Failed to toggle pin', err);
        }
    }

    showMemeContextMenu(meme: MemeItem, x: number, y: number): void {
        this.contextMenuMeme = meme;
        this.contextMenuUploader = null;
        this.showNameInput = false;
        const w = 180,
            h = 96;
        this.contextMenuPos = {
            x: Math.min(x, window.innerWidth - w - 8),
            y: Math.min(y, window.innerHeight - h - 8),
        };
        m.redraw();
    }

    showTabContextMenu(uploader: UploaderInfo, x: number, y: number): void {
        this.contextMenuMeme = null;
        this.contextMenuUploader = uploader;
        const w = 160,
            h = 48;
        this.tabContextMenuPos = {
            x: Math.min(x, window.innerWidth - w - 8),
            y: Math.min(y, window.innerHeight - h - 8),
        };
        m.redraw();
    }

    selectMeme(meme: MemeItem): void {
        this.hide();
        setTimeout(() => {
            this.attrs.onSelect({ id: meme.id, filename: meme.filename, name: meme.display_name });
        }, 250);
    }

    getSortedUploaderTabs(): UploaderInfo[] {
        const pinned: UploaderInfo[] = [];
        const others: UploaderInfo[] = [];
        for (const u of this.uploaders) {
            if (this.pinnedUploaderIds.includes(u.id)) pinned.push(u);
            else others.push(u);
        }
        pinned.sort((a, b) => this.pinnedUploaderIds.indexOf(a.id) - this.pinnedUploaderIds.indexOf(b.id));
        return [...pinned, ...others];
    }

    getCurrentMemes(): MemeItem[] {
        if (this.activeTab === 'official') return this.official;
        if (this.activeTab === 'mine') return this.mine;
        if (this.activeTab === 'favorites') {
            const union: MemeItem[] = [...this.official, ...this.mine];
            Object.values(this.userMemesByUploader).forEach((arr) => union.push(...arr));
            const seen = new Set<number>();
            return union.filter((m) => {
                if (!m.is_favorite) return false;
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });
        }
        if (this.activeTab.startsWith('user-')) {
            const id = Number(this.activeTab.slice(5));
            return this.userMemesByUploader[id] || [];
        }
        return [];
    }

    getFilteredMemes(): MemeItem[] {
        const list = this.getCurrentMemes();
        const q = this.searchQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter((m) => m.display_name.toLowerCase().includes(q));
    }

    setActiveTab(tab: TabKey): void {
        this.activeTab = tab;
        if (tab.startsWith('user-')) {
            const id = Number(tab.slice(5));
            if (!this.userMemesByUploader[id]) {
                this.loadUserMemes(id);
            }
        }
        m.redraw();
    }

    get favoriteCount(): number {
        return this.favorites.size;
    }

    openUploadModal(): void {
        if (!this.quota?.allow_uploads) return;
        const composer = this.attrs.composer;
        app.modal.show(MemeUploadModal as any, {
            target: 'user',
            onUploaded: () => {
                this.loadInitial();
            },
        });
        // Re-open the picker after upload is dismissed — Flarum stacks modals by
        // replacing, so we re-show this modal by having the composer reference.
        // (We rely on the user tapping the meme button again in practice; no-op here.)
        void composer;
    }

    attachLongPressHandlers(root: HTMLElement): void {
        this.tabCleanups.forEach((fn) => fn());
        this.tabCleanups = [];
        this.itemCleanups.forEach((fn) => fn());
        this.itemCleanups = [];

        root.querySelectorAll<HTMLElement>('.MemePickerModal-tab[data-uploader-id]').forEach((el) => {
            const id = Number(el.dataset.uploaderId || 0);
            const uploader = this.uploaders.find((u) => u.id === id);
            if (!uploader) return;
            const cleanup = attachLongPress(el, (x, y) => this.showTabContextMenu(uploader, x, y));
            this.tabCleanups.push(cleanup);
        });

        root.querySelectorAll<HTMLElement>('.MemePickerModal-item[data-meme-id]').forEach((el) => {
            const id = Number(el.dataset.memeId || 0);
            const list = this.getCurrentMemes();
            const meme = list.find((m) => m.id === id);
            if (!meme) return;
            const cleanup = attachLongPress(el, (x, y) => this.showMemeContextMenu(meme, x, y));
            this.itemCleanups.push(cleanup);
        });
    }

    content() {
        const uploaderTabs = this.getSortedUploaderTabs();
        const overlay = this.contextMenuMeme && this.showNameInput ? this.renderNameInputOverlay() : null;

        return (
            <div class="Modal-body MemePickerModal-body">
                <div class="MemePickerModal-tabs-row">
                    <div
                        class="MemePickerModal-tabs"
                        onwheel={(e: WheelEvent) => {
                            const el = e.currentTarget as HTMLElement;
                            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                el.scrollLeft += e.deltaY;
                                e.preventDefault();
                            }
                        }}
                    >
                        <button
                            type="button"
                            class={`MemePickerModal-tab ${this.activeTab === 'official' ? 'active' : ''}`}
                            onclick={() => this.setActiveTab('official')}
                        >
                            <i class="fas fa-star-of-life" />
                            <span>{app.translator.trans('tangyuan-meme-tangyuan.forum.modal.tab_official')}</span>
                            {this.official.length > 0 && (
                                <span class="MemePickerModal-count">{this.official.length}</span>
                            )}
                        </button>
                        {this.mine.length > 0 && (
                            <button
                                type="button"
                                class={`MemePickerModal-tab ${this.activeTab === 'mine' ? 'active' : ''}`}
                                onclick={() => this.setActiveTab('mine')}
                            >
                                <i class="fas fa-user" />
                                <span>
                                    {app.translator.trans('tangyuan-meme-tangyuan.forum.modal.tab_mine')}
                                </span>
                                <span class="MemePickerModal-count">{this.mine.length}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            class={`MemePickerModal-tab ${this.activeTab === 'favorites' ? 'active' : ''}`}
                            onclick={() => this.setActiveTab('favorites')}
                        >
                            <i class="fas fa-heart" />
                            <span>{app.translator.trans('tangyuan-meme-tangyuan.forum.modal.tab_favorites')}</span>
                            {this.favoriteCount > 0 && (
                                <span class="MemePickerModal-badge">{this.favoriteCount}</span>
                            )}
                        </button>
                        {uploaderTabs.map((u) => {
                            const pinned = this.pinnedUploaderIds.includes(u.id);
                            const active = this.activeTab === `user-${u.id}`;
                            return (
                                <button
                                    type="button"
                                    key={`user-${u.id}`}
                                    data-uploader-id={u.id}
                                    class={`MemePickerModal-tab MemePickerModal-tab--user ${active ? 'active' : ''} ${pinned ? 'is-pinned' : ''}`}
                                    onclick={() => this.setActiveTab(`user-${u.id}`)}
                                    oncontextmenu={(e: MouseEvent) => {
                                        e.preventDefault();
                                        this.showTabContextMenu(u, e.clientX, e.clientY);
                                    }}
                                    title={u.username}
                                >
                                    {pinned && <i class="fas fa-thumbtack MemePickerModal-tabPinIcon" />}
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} class="MemePickerModal-tabAvatar" alt={u.username} />
                                    ) : (
                                        <span class="MemePickerModal-tabAvatarFallback">
                                            {u.username.slice(0, 1).toUpperCase()}
                                        </span>
                                    )}
                                    <span class="MemePickerModal-tabUsername">{u.username}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div class="MemePickerModal-search">
                    <input
                        class="FormControl"
                        type="text"
                        placeholder={
                            app.translator.trans(
                                'tangyuan-meme-tangyuan.forum.modal.search_placeholder'
                            ) as unknown as string
                        }
                        value={this.searchQuery}
                        oninput={(e: Event) => {
                            this.searchQuery = (e.target as HTMLInputElement).value;
                            m.redraw();
                        }}
                    />
                </div>

                <div class="MemePickerModal-scroll">{this.renderGrid()}</div>

                {this.quota?.allow_uploads && (
                    <div class="MemePickerModal-uploadFooter">
                        <button type="button" class="MemePickerModal-uploadLink" onclick={() => this.openUploadModal()}>
                            <i class="fas fa-cloud-upload-alt" />
                            <span>
                                {app.translator.trans('tangyuan-meme-tangyuan.forum.modal.upload_footer')}
                            </span>
                        </button>
                    </div>
                )}

                {overlay}
            </div>
        );
    }

    renderGrid(): Mithril.Children {
        if (this.loading) {
            return (
                <div class="MemePickerModal-loading">
                    <LoadingIndicator size="large" />
                </div>
            );
        }

        if (this.activeTab.startsWith('user-')) {
            const id = Number(this.activeTab.slice(5));
            if (this.loadingUserIds[id]) {
                return (
                    <div class="MemePickerModal-loading">
                        <LoadingIndicator />
                    </div>
                );
            }
        }

        const memes = this.getFilteredMemes();
        if (memes.length === 0) {
            return (
                <div class="MemePickerModal-empty">
                    {this.activeTab === 'favorites'
                        ? app.translator.trans('tangyuan-meme-tangyuan.forum.modal.no_favorites')
                        : this.activeTab === 'mine'
                        ? app.translator.trans('tangyuan-meme-tangyuan.forum.modal.no_mine')
                        : this.activeTab.startsWith('user-')
                        ? app.translator.trans('tangyuan-meme-tangyuan.forum.modal.no_user_memes')
                        : this.searchQuery.trim()
                        ? app.translator.trans('tangyuan-meme-tangyuan.forum.modal.no_results')
                        : app.translator.trans('tangyuan-meme-tangyuan.forum.modal.no_memes')}
                </div>
            );
        }

        return (
            <div class="MemePickerModal-grid">
                {memes.map((meme) => (
                    <button
                        type="button"
                        class={`MemePickerModal-item ${meme.is_favorite ? 'is-favorite' : ''}`}
                        key={meme.id}
                        data-meme-id={meme.id}
                        title={meme.display_name}
                        onclick={() => this.selectMeme(meme)}
                        oncontextmenu={(e: MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.showMemeContextMenu(meme, e.clientX, e.clientY);
                        }}
                    >
                        <span class="MemePickerModal-itemImage">
                            <img
                                src={meme.url}
                                alt={meme.display_name}
                                loading="lazy"
                                decoding="async"
                                onerror={(e: Event) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.visibility = 'hidden';
                                }}
                            />
                        </span>
                        <span class="MemePickerModal-itemName">{meme.display_name}</span>
                        {meme.is_favorite && (
                            <span class="MemePickerModal-favIcon">
                                <i class="fas fa-heart" />
                            </span>
                        )}
                    </button>
                ))}
            </div>
        );
    }

    renderPortal(): void {
        if (!this.portalEl) return;
        let node: Mithril.Children = null;
        if (this.contextMenuMeme && !this.showNameInput) node = this.renderMemeContextMenu();
        else if (this.contextMenuUploader) node = this.renderTabContextMenu();
        m.render(this.portalEl, node);
    }

    renderMemeContextMenu(): Mithril.Children {
        const meme = this.contextMenuMeme!;
        return (
            <div
                class="MemeContextMenu"
                style={`left:${this.contextMenuPos.x}px;top:${this.contextMenuPos.y}px`}
                onclick={(e: MouseEvent) => e.stopPropagation()}
            >
                <div class="MemeContextMenu-item" onclick={(e: MouseEvent) => this.toggleFavorite(meme, e)}>
                    <i class={meme.is_favorite ? 'fas fa-heart' : 'far fa-heart'} />
                    <span>
                        {meme.is_favorite
                            ? app.translator.trans('tangyuan-meme-tangyuan.forum.modal.context.unfavorite')
                            : app.translator.trans('tangyuan-meme-tangyuan.forum.modal.context.favorite')}
                    </span>
                </div>
                <div
                    class="MemeContextMenu-item"
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        this.initialEditingName = meme.display_name;
                        this.showNameInput = true;
                        m.redraw();
                    }}
                >
                    <i class="fas fa-edit" />
                    <span>{app.translator.trans('tangyuan-meme-tangyuan.forum.modal.context.set_name')}</span>
                </div>
            </div>
        );
    }

    renderTabContextMenu(): Mithril.Children {
        const uploader = this.contextMenuUploader!;
        const pinned = this.pinnedUploaderIds.includes(uploader.id);
        return (
            <div
                class="MemeTabContextMenu MemeContextMenu"
                style={`left:${this.tabContextMenuPos.x}px;top:${this.tabContextMenuPos.y}px`}
                onclick={(e: MouseEvent) => e.stopPropagation()}
            >
                <div class="MemeContextMenu-item" onclick={() => this.togglePinUploader(uploader)}>
                    <i class={pinned ? 'fas fa-thumbtack' : 'far fa-thumbtack'} />
                    <span>
                        {pinned
                            ? app.translator.trans('tangyuan-meme-tangyuan.forum.modal.tab_context.unpin')
                            : app.translator.trans('tangyuan-meme-tangyuan.forum.modal.tab_context.pin')}
                    </span>
                </div>
            </div>
        );
    }

    renderNameInputOverlay(): Mithril.Children {
        const meme = this.contextMenuMeme!;
        const initial = this.initialEditingName;
        return (
            <div
                class="MemeNameInputOverlay"
                onclick={() => {
                    this.showNameInput = false;
                    this.contextMenuMeme = null;
                    m.redraw();
                }}
            >
                <div class="MemeNameInputModal" onclick={(e: MouseEvent) => e.stopPropagation()}>
                    <h4>{app.translator.trans('tangyuan-meme-tangyuan.forum.modal.context.name_dialog_title')}</h4>
                    <input
                        class="FormControl MemeNameInput"
                        type="text"
                        maxLength={15}
                        placeholder={
                            app.translator.trans(
                                'tangyuan-meme-tangyuan.forum.modal.context.name_placeholder'
                            ) as unknown as string
                        }
                        oncreate={(vnode: Mithril.VnodeDOM) => {
                            const input = vnode.dom as HTMLInputElement;
                            input.value = initial;
                            setTimeout(() => {
                                input.focus();
                                input.select();
                            }, 0);
                        }}
                        oninput={(e: Event) => {
                            const input = e.target as HTMLInputElement;
                            if (input.value.length > 15) {
                                input.value = input.value.substring(0, 15);
                            }
                            m.redraw();
                        }}
                        onkeydown={(e: KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                this.saveCustomName(meme, e.target as HTMLInputElement);
                            }
                        }}
                    />
                    <div class="MemeNameInputButtons">
                        <button
                            type="button"
                            class="Button"
                            onclick={() => {
                                this.showNameInput = false;
                                this.contextMenuMeme = null;
                                m.redraw();
                            }}
                        >
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.modal.context.cancel')}
                        </button>
                        <button
                            type="button"
                            class="Button Button--primary"
                            onclick={() => {
                                const input = document.querySelector<HTMLInputElement>('.MemeNameInput');
                                this.saveCustomName(meme, input);
                            }}
                        >
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.modal.context.save')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
