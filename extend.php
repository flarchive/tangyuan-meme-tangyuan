<?php

use Flarum\Api\Serializer\CurrentUserSerializer;
use Flarum\Extend;
use s9e\TextFormatter\Configurator;
use Tangyuan\Meme\Api\MemeAdminController;
use Tangyuan\Meme\Api\MemeFavoriteController;
use Tangyuan\Meme\Api\MemeListController;
use Tangyuan\Meme\Api\MemeServeController;
use Tangyuan\Meme\Api\MemeUploadController;
use Tangyuan\Meme\Api\MemeUserSearchController;
use Tangyuan\Meme\Api\MemeVisibilityController;
use Tangyuan\Meme\Api\Serializer\MemeSerializer;
use Tangyuan\Meme\Notification\MemeApprovedBlueprint;
use Tangyuan\Meme\Notification\MemeRejectedBlueprint;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less')
        ->route('/memes', 'tangyuan.meme.gallery')
        ->route('/memes/official', 'tangyuan.meme.official')
        ->route('/memes/pending', 'tangyuan.meme.pending')
        ->route('/memes/users', 'tangyuan.meme.users')
        ->route('/memes/my', 'tangyuan.meme.my'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js')
        ->css(__DIR__ . '/less/admin.less'),

    (new Extend\Locales(__DIR__ . '/locale')),

    (new Extend\View())
        ->namespace('tangyuan-meme', __DIR__ . '/views'),

    (new Extend\Settings())
        ->default('tangyuan-meme.allowUserUploads', false)
        ->default('tangyuan-meme.maxUploadsPerUser', 100)
        ->default('tangyuan-meme.maxTotalSizePerUser', 10 * 1024 * 1024)
        ->default('tangyuan-meme.allowedFormatsRegex', '/\.(png|jpe?g|gif|webp)$/i')
        ->default('tangyuan-meme.enableModeration', true)
        ->default('tangyuan-meme.deleteUserMemesOnUploadsDisabled', false)
        ->serializeToForum('tangyuanMemeAllowUserUploads', 'tangyuan-meme.allowUserUploads', 'boolval')
        ->serializeToForum('tangyuanMemeMaxUploadsPerUser', 'tangyuan-meme.maxUploadsPerUser', 'intval')
        ->serializeToForum('tangyuanMemeMaxTotalSizePerUser', 'tangyuan-meme.maxTotalSizePerUser', 'intval')
        ->serializeToForum('tangyuanMemeAllowedFormatsRegex', 'tangyuan-meme.allowedFormatsRegex')
        ->serializeToForum('tangyuanMemeEnableModeration', 'tangyuan-meme.enableModeration', 'boolval'),

    (new Extend\Routes('forum'))
        ->get('/meme-list', 'tangyuan.meme.list', MemeListController::class)
        ->get('/meme-serve', 'tangyuan.meme.serve', MemeServeController::class)
        ->get('/meme-user-search', 'tangyuan.meme.user_search', MemeUserSearchController::class)
        ->post('/meme-favorite', 'tangyuan.meme.favorite', MemeFavoriteController::class)
        ->post('/meme-upload', 'tangyuan.meme.upload', MemeUploadController::class)
        ->post('/meme-admin', 'tangyuan.meme.admin', MemeAdminController::class)
        ->post('/meme-visibility', 'tangyuan.meme.visibility', MemeVisibilityController::class),

    (new Extend\Formatter)
        ->configure(function (Configurator $config) {
            $config->BBCodes->addCustom(
                '[tangyuan-meme src={TEXT}][/tangyuan-meme]',
                '<img class="flarum-meme" src="/meme-serve?src={@src}" alt="{@src}" loading="lazy" />'
            );
        }),

    (new Extend\Notification())
        ->beforeSending(function ($blueprint, array $recipients) {
            $notificationUserId = method_exists($blueprint, 'getData')
                ? (($blueprint->getData()['notification_user_id'] ?? null))
                : null;

            if (!$notificationUserId) {
                return $recipients;
            }

            return array_values(array_filter($recipients, function ($user) use ($notificationUserId) {
                return (int) $user->id === (int) $notificationUserId;
            }));
        })
        ->type(MemeApprovedBlueprint::class, MemeSerializer::class, ['alert', 'email'])
        ->type(MemeRejectedBlueprint::class, MemeSerializer::class, ['alert', 'email']),

    (new Extend\ApiSerializer(CurrentUserSerializer::class))
        ->attribute('canViewMemes', function ($serializer, $user) {
            return (bool) $user->hasPermission('tangyuan-meme.viewMemes');
        })
        ->attribute('canUploadMeme', function ($serializer, $user) {
            return (bool) $user->hasPermission('tangyuan-meme.uploadMeme');
        })
        ->attribute('canModerateMemes', function ($serializer, $user) {
            return (bool) $user->hasPermission('tangyuan-meme.moderateMeme');
        })
        ->attribute('canManageOfficialMemes', function ($serializer, $user) {
            return (bool) $user->hasPermission('tangyuan-meme.manageOfficialMemes');
        }),
];
