import app from 'flarum/admin/app';

app.initializers.add('tangyuan-meme-tangyuan', () => {
    const trans = (key: string, params?: any) =>
        app.translator.trans(`tangyuan-meme-tangyuan.admin.${key}`, params);

    app.extensionData
        .for('tangyuan-meme-tangyuan')
        .registerPermission(
            {
                icon: 'fas fa-images',
                label: trans('permissions.view_memes'),
                permission: 'tangyuan-meme.viewMemes',
            },
            'view'
        )
        .registerPermission(
            {
                icon: 'fas fa-upload',
                label: trans('permissions.upload_meme'),
                permission: 'tangyuan-meme.uploadMeme',
            },
            'reply'
        )
        .registerPermission(
            {
                icon: 'fas fa-gavel',
                label: trans('permissions.moderate_meme'),
                permission: 'tangyuan-meme.moderateMeme',
            },
            'moderate'
        )
        .registerPermission(
            {
                icon: 'fas fa-star',
                label: trans('permissions.manage_official_memes'),
                permission: 'tangyuan-meme.manageOfficialMemes',
            },
            'moderate'
        )
        .registerSetting({
            setting: 'tangyuan-meme.allowUserUploads',
            label: trans('settings.allow_user_uploads'),
            type: 'boolean',
        })
        .registerSetting({
            setting: 'tangyuan-meme.enableModeration',
            label: trans('settings.enable_moderation'),
            type: 'boolean',
        })
        .registerSetting({
            setting: 'tangyuan-meme.deleteUserMemesOnUploadsDisabled',
            label: trans('settings.delete_user_memes_on_disable'),
            type: 'boolean',
        })
        .registerSetting({
            setting: 'tangyuan-meme.maxUploadsPerUser',
            label: trans('settings.max_uploads_per_user'),
            type: 'number',
        })
        .registerSetting({
            setting: 'tangyuan-meme.maxTotalSizePerUser',
            label: trans('settings.max_total_size_per_user'),
            type: 'number',
        })
        .registerSetting({
            setting: 'tangyuan-meme.allowedFormatsRegex',
            label: trans('settings.allowed_formats_regex'),
            type: 'text',
        });
});
