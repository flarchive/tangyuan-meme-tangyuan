import Modal from 'flarum/common/components/Modal';
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';
import { formatBytes } from '../utils/formatBytes';

interface UploadAttrs {
    target: 'user' | 'official';
    onUploaded?: (payload: { created: any[]; errors: any[] }) => void;
}

interface QueuedFile {
    file: File;
    previewUrl: string;
    error: string | null;
}

interface Quota {
    allow_uploads: boolean;
    can_moderate: boolean;
    can_manage_official: boolean;
    max_count: number;
    max_size: number;
    used_count: number;
    used_size: number;
    allowed_formats: string;
}

export default class MemeUploadModal extends Modal<UploadAttrs> {
    files: QueuedFile[] = [];
    quota: Quota | null = null;
    loading = true;
    submitting = false;
    dragOver = false;
    uploadResult: { created: number; errors: { filename: string | null; error: string }[] } | null = null;

    className(): string {
        return 'MemeUploadModal Modal--medium';
    }

    title() {
        return app.translator.trans('tangyuan-meme-tangyuan.forum.upload.modal_title');
    }

    oninit(vnode: Mithril.Vnode): void {
        super.oninit(vnode);
        this.loadQuota();
    }

    async loadQuota(): Promise<void> {
        try {
            const res = await app.request<{ quota: Quota }>({
                method: 'GET',
                url: '/meme-list?scope=picker',
            });
            this.quota = res.quota;
        } catch (err) {
            console.error('Failed to load quota', err);
        }
        this.loading = false;
        m.redraw();
    }

    onremove(vnode: Mithril.VnodeDOM): void {
        super.onremove(vnode);
        this.files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    }

    addFiles(fileList: FileList | File[] | null): void {
        if (!fileList) return;
        const arr = Array.from(fileList);
        const regex = this.quota?.allowed_formats ?? '/\\.(png|jpe?g|gif|webp)$/i';
        const pattern = this.parseRegex(regex);

        for (const file of arr) {
            let err: string | null = null;
            if (pattern && !pattern.test(file.name)) {
                err = 'format_not_allowed';
            }
            this.files.push({
                file,
                previewUrl: URL.createObjectURL(file),
                error: err,
            });
        }
        m.redraw();
    }

    parseRegex(str: string): RegExp | null {
        try {
            const match = str.match(/^\/(.+)\/([a-z]*)$/i);
            if (match) {
                return new RegExp(match[1], match[2]);
            }
            return new RegExp(str, 'i');
        } catch {
            return null;
        }
    }

    removeFile(index: number): void {
        const [removed] = this.files.splice(index, 1);
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        m.redraw();
    }

    clearFiles(): void {
        this.files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        this.files = [];
        m.redraw();
    }

    get usableFiles(): QueuedFile[] {
        return this.files.filter((f) => !f.error);
    }

    async submit(): Promise<void> {
        const usable = this.usableFiles;
        if (usable.length === 0) {
            app.alerts.show(
                { type: 'error' },
                app.translator.trans('tangyuan-meme-tangyuan.forum.upload.no_files_selected') as any
            );
            return;
        }

        this.submitting = true;
        m.redraw();

        const form = new FormData();
        form.append('target', this.attrs.target);
        usable.forEach((f) => form.append('files[]', f.file, f.file.name));

        try {
            const response = await fetch(app.forum.attribute('apiUrl').replace(/\/api$/, '') + '/meme-upload', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-Token': app.session.csrfToken || '',
                    Accept: 'application/json',
                },
                body: form,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'upload_failed');
            }

            this.uploadResult = {
                created: data.created?.length ?? 0,
                errors: data.errors ?? [],
            };

            const createdCount = data.created?.length ?? 0;
            const errCount = data.errors?.length ?? 0;

            if (createdCount > 0 && errCount === 0) {
                app.alerts.show(
                    { type: 'success' },
                    app.translator.trans('tangyuan-meme-tangyuan.forum.upload.success', { count: createdCount }) as any
                );
            } else if (createdCount > 0 && errCount > 0) {
                app.alerts.show(
                    { type: 'warning' },
                    app.translator.trans('tangyuan-meme-tangyuan.forum.upload.partial_success', {
                        success: createdCount,
                        failed: errCount,
                    }) as any
                );
            }

            if (this.attrs.onUploaded) {
                this.attrs.onUploaded({ created: data.created ?? [], errors: data.errors ?? [] });
            }

            if (errCount === 0) {
                this.hide();
                return;
            }

            this.clearFiles();
        } catch (err: any) {
            app.alerts.show({ type: 'error' }, String(err?.message ?? err));
        }

        this.submitting = false;
        m.redraw();
    }

    content(): Mithril.Children {
        if (this.loading) {
            return (
                <div class="Modal-body MemeUploadModal-body">
                    <LoadingIndicator />
                </div>
            );
        }

        const q = this.quota;
        const target = this.attrs.target;
        const errorKey = (code: string) => {
            const mapped = app.translator.trans(`tangyuan-meme-tangyuan.forum.upload.file_errors.${code}`);
            return typeof mapped === 'string' && mapped.includes('tangyuan-meme-tangyuan') ? code : mapped;
        };

        return (
            <div class="Modal-body MemeUploadModal-body">
                {target === 'user' && q && (
                    <div class="MemeUploadModal-quota">
                        {app.translator.trans('tangyuan-meme-tangyuan.forum.upload.quota_label', {
                            usedCount: q.used_count,
                            maxCount: q.max_count,
                            usedSize: formatBytes(q.used_size),
                            maxSize: formatBytes(q.max_size),
                        })}
                    </div>
                )}

                <div class="MemeUploadModal-notices">
                    <div class="MemeUploadModal-notice">
                        <i class="fas fa-info-circle" />
                        {app.translator.trans('tangyuan-meme-tangyuan.forum.upload.compress_notice')}
                    </div>
                    <div class="MemeUploadModal-notice">
                        <i class="fas fa-info-circle" />
                        {app.translator.trans('tangyuan-meme-tangyuan.forum.upload.filename_notice')}
                    </div>
                    {target === 'user' && q?.allow_uploads && (
                        <div class="MemeUploadModal-notice MemeUploadModal-notice--warn">
                            <i class="fas fa-shield-alt" />
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.upload.moderation_notice')}
                        </div>
                    )}
                </div>

                <label
                    class={`MemeUploadModal-dropzone ${this.dragOver ? 'is-dragover' : ''}`}
                    ondragover={(e: DragEvent) => {
                        e.preventDefault();
                        this.dragOver = true;
                        m.redraw();
                    }}
                    ondragleave={() => {
                        this.dragOver = false;
                        m.redraw();
                    }}
                    ondrop={(e: DragEvent) => {
                        e.preventDefault();
                        this.dragOver = false;
                        this.addFiles(e.dataTransfer?.files ?? null);
                    }}
                >
                    <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        onchange={(e: Event) => {
                            const input = e.target as HTMLInputElement;
                            this.addFiles(input.files);
                            input.value = '';
                        }}
                    />
                    <div class="MemeUploadModal-dropzoneLabel">
                        <i class="fas fa-cloud-upload-alt" />
                        <span>{app.translator.trans('tangyuan-meme-tangyuan.forum.upload.drag_hint')}</span>
                    </div>
                </label>

                {this.files.length > 0 && (
                    <div class="MemeUploadModal-previewList">
                        {this.files.map((f, i) => (
                            <div class={`MemeUploadModal-preview ${f.error ? 'has-error' : ''}`} key={i}>
                                <img src={f.previewUrl} alt={f.file.name} />
                                <span class="MemeUploadModal-previewName" title={f.file.name}>
                                    {f.file.name}
                                </span>
                                <span class="MemeUploadModal-previewSize">{formatBytes(f.file.size)}</span>
                                {f.error && <span class="MemeUploadModal-previewError">{errorKey(f.error)}</span>}
                                <button
                                    type="button"
                                    class="MemeUploadModal-previewRemove"
                                    onclick={() => this.removeFile(i)}
                                    aria-label="Remove"
                                >
                                    <i class="fas fa-times" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div class="MemeUploadModal-actions">
                    {this.files.length > 0 && (
                        <Button class="Button" onclick={() => this.clearFiles()} disabled={this.submitting}>
                            {app.translator.trans('tangyuan-meme-tangyuan.forum.upload.clear_all')}
                        </Button>
                    )}
                    <Button
                        class="Button Button--primary"
                        loading={this.submitting}
                        disabled={this.submitting || this.usableFiles.length === 0}
                        onclick={() => this.submit()}
                    >
                        {this.submitting
                            ? app.translator.trans('tangyuan-meme-tangyuan.forum.upload.submitting')
                            : app.translator.trans('tangyuan-meme-tangyuan.forum.upload.submit', {
                                  count: this.usableFiles.length,
                              })}
                    </Button>
                </div>
            </div>
        );
    }
}
