<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Model\MemeFavorite;
use Tangyuan\Meme\Model\MemeTabPin;
use Tangyuan\Meme\Model\MemeVisibilityUser;
use Tangyuan\Meme\Service\MemeStorage;

class MemeListController implements RequestHandlerInterface
{
    use JsonResponder;

    public function __construct(private MemeStorage $storage)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->storage->ensureBuiltInOfficialFilesSeeded();

        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();
        $scope = Arr::get($params, 'scope', 'picker');

        if ($scope === 'picker') {
            return $this->handlePicker($actor);
        }

        if ($scope === 'official') {
            return $this->handleOfficialList($actor);
        }

        if ($scope === 'pending') {
            return $this->handlePendingList($actor);
        }

        if ($scope === 'uploaders') {
            return $this->handleOtherUploadersList($actor);
        }

        if ($scope === 'user') {
            $uploaderId = (int) Arr::get($params, 'uploader_id', 0);
            return $this->handleUserMemes($actor, $uploaderId);
        }

        if ($scope === 'mine') {
            return $this->handleMineMemes($actor);
        }

        return $this->jsonResponse(['error' => 'Unknown scope'], 400);
    }

    /**
     * Pre-warm cache + return official memes + favorites + pinned tab ids.
     * User-tab memes are lazy-loaded via scope=user.
     */
    private function handlePicker(User $actor): ResponseInterface
    {
        $this->storage->ensureOfficialCachePrewarm();

        $officialMemes = Meme::official()->approved()->orderBy('display_name')->get();
        foreach ($officialMemes as $meme) {
            $this->storage->ensureCached($meme);
        }
        $officialPayload = $officialMemes->map(fn(Meme $m) => $this->serializeMeme($m, $actor))->all();

        $favorites = [];
        $customNames = [];
        $pinnedUploaderIds = [];
        $uploadersWithApproved = collect();
        $mineMemes = [];
        $quota = null;

        if ($actor->exists) {
            $favRecords = MemeFavorite::where('user_id', $actor->id)->get();
            foreach ($favRecords as $rec) {
                if ($rec->is_favorite) {
                    $favorites[] = (int) $rec->meme_id;
                }
                if ($rec->custom_name !== null && $rec->custom_name !== '') {
                    $customNames[(int) $rec->meme_id] = $rec->custom_name;
                }
            }

            $pinnedUploaderIds = MemeTabPin::where('user_id', $actor->id)
                ->orderBy('position')
                ->pluck('pinned_uploader_id')
                ->map(fn($id) => (int) $id)
                ->all();

            $mine = Meme::userType()
                ->approved()
                ->where('uploader_id', $actor->id)
                ->orderBy('display_name')
                ->get();
            foreach ($mine as $meme) {
                $this->storage->ensureCached($meme);
            }
            $mineMemes = $mine->map(fn(Meme $m) => $this->serializeMeme($m, $actor))->all();
        }

        $visibleQuery = Meme::userType()->approved()->whereNotNull('uploader_id');
        if ($actor->exists) {
            $visibleQuery->where('uploader_id', '<>', $actor->id);
            if (!$actor->hasPermission('tangyuan-meme.moderateMeme')) {
                $visibleQuery->visibleTo((int) $actor->id);
            }
        } else {
            $visibleQuery->where('visibility', Meme::VISIBILITY_PUBLIC);
        }

        $uploadersWithApproved = $visibleQuery
            ->select('uploader_id')
            ->groupBy('uploader_id')
            ->pluck('uploader_id')
            ->map(fn($id) => (int) $id);

        $uploaderUsers = User::whereIn('id', $uploadersWithApproved->all())->get(['id', 'username', 'avatar_url']);

        return $this->jsonResponse([
            'official' => $officialPayload,
            'mine' => $mineMemes,
            'favorites' => $favorites,
            'custom_names' => $customNames,
            'pinned_uploader_ids' => $pinnedUploaderIds,
            'uploaders' => $uploaderUsers->map(fn(User $u) => [
                'id' => (int) $u->id,
                'username' => $u->username,
                'avatar_url' => $u->avatar_url,
            ])->all(),
            'cache_base_url' => $this->storage->getCacheBaseUrl(),
            'quota' => $this->buildQuota($actor),
        ]);
    }

    private function handleOfficialList(User $actor): ResponseInterface
    {
        if (!$this->hasGalleryAccess($actor)) {
            return $this->jsonResponse(['error' => 'Forbidden'], 403);
        }

        $memes = Meme::official()->approved()->orderBy('display_name')->get();
        foreach ($memes as $meme) {
            $this->storage->ensureCached($meme);
        }
        return $this->jsonResponse([
            'memes' => $memes->map(fn(Meme $m) => $this->serializeMeme($m, $actor))->all(),
            'cache_base_url' => $this->storage->getCacheBaseUrl(),
        ]);
    }

    private function handlePendingList(User $actor): ResponseInterface
    {
        if (!$actor->hasPermission('tangyuan-meme.moderateMeme')) {
            return $this->jsonResponse(['error' => 'Forbidden'], 403);
        }

        $memes = Meme::pending()->orderBy('created_at', 'asc')->with('uploader')->get();
        foreach ($memes as $meme) {
            $this->storage->ensureCached($meme);
        }
        return $this->jsonResponse([
            'memes' => $memes->map(function (Meme $m) use ($actor) {
                $payload = $this->serializeMeme($m, $actor);
                if ($m->uploader) {
                    $payload['uploader'] = [
                        'id' => (int) $m->uploader->id,
                        'username' => $m->uploader->username,
                        'avatar_url' => $m->uploader->avatar_url,
                    ];
                }
                return $payload;
            })->all(),
            'cache_base_url' => $this->storage->getCacheBaseUrl(),
        ]);
    }

    private function handleOtherUploadersList(User $actor): ResponseInterface
    {
        if (!$this->hasGalleryAccess($actor)) {
            return $this->jsonResponse(['error' => 'Forbidden'], 403);
        }

        $base = Meme::userType()
            ->approved()
            ->whereNotNull('uploader_id');

        if ($actor->exists) {
            $base->where('uploader_id', '<>', $actor->id);
            if (!$actor->hasPermission('tangyuan-meme.moderateMeme')) {
                $base->visibleTo((int) $actor->id);
            }
        } else {
            $base->where('visibility', Meme::VISIBILITY_PUBLIC);
        }

        $groups = $base
            ->selectRaw('uploader_id, COUNT(*) AS meme_count, MAX(updated_at) AS latest')
            ->groupBy('uploader_id')
            ->orderByDesc('latest')
            ->get();

        $uploaderIds = $groups->pluck('uploader_id')->all();
        $users = User::whereIn('id', $uploaderIds)->get(['id', 'username', 'avatar_url'])->keyBy('id');

        $payload = $groups->map(function ($group) use ($users) {
            $user = $users->get((int) $group->uploader_id);
            if (!$user) return null;
            return [
                'id' => (int) $user->id,
                'username' => $user->username,
                'avatar_url' => $user->avatar_url,
                'count' => (int) $group->meme_count,
            ];
        })->filter()->values()->all();

        return $this->jsonResponse([
            'uploaders' => $payload,
        ]);
    }

    private function handleUserMemes(User $actor, int $uploaderId): ResponseInterface
    {
        if ($uploaderId <= 0) {
            return $this->jsonResponse(['error' => 'Invalid uploader'], 400);
        }

        $query = Meme::userType()
            ->approved()
            ->where('uploader_id', $uploaderId);

        $isSelf = $actor->exists && (int) $actor->id === $uploaderId;
        if (!$isSelf && !$actor->hasPermission('tangyuan-meme.moderateMeme')) {
            $query->visibleTo($actor->exists ? (int) $actor->id : null);
        }

        $memes = $query->orderBy('display_name')->get();

        foreach ($memes as $meme) {
            $this->storage->ensureCached($meme);
        }

        $uploader = User::find($uploaderId);

        return $this->jsonResponse([
            'memes' => $memes->map(fn(Meme $m) => $this->serializeMeme($m, $actor))->all(),
            'cache_base_url' => $this->storage->getCacheBaseUrl(),
            'uploader' => $uploader ? [
                'id' => (int) $uploader->id,
                'username' => $uploader->username,
                'avatar_url' => $uploader->avatar_url,
            ] : null,
        ]);
    }

    private function handleMineMemes(User $actor): ResponseInterface
    {
        if (!$actor->exists) {
            return $this->jsonResponse(['error' => 'Unauthorized'], 401);
        }

        $memes = Meme::where('uploader_id', $actor->id)
            ->orderByDesc('created_at')
            ->get();

        foreach ($memes as $meme) {
            $this->storage->ensureCached($meme);
        }

        return $this->jsonResponse([
            'memes' => $memes->map(fn(Meme $m) => $this->serializeMeme($m, $actor))->all(),
            'cache_base_url' => $this->storage->getCacheBaseUrl(),
            'quota' => $this->buildQuota($actor),
        ]);
    }

    private function serializeMeme(Meme $meme, User $actor): array
    {
        $fav = $actor->exists
            ? MemeFavorite::where('user_id', $actor->id)->where('meme_id', $meme->id)->first()
            : null;

        $isOwner = $actor->exists && $meme->uploader_id && (int) $actor->id === (int) $meme->uploader_id;
        $canEditVisibility = $isOwner || ($actor->exists && $actor->hasPermission('tangyuan-meme.moderateMeme'));

        $payload = [
            'id' => (int) $meme->id,
            'type' => $meme->type,
            'uploader_id' => $meme->uploader_id ? (int) $meme->uploader_id : null,
            'filename' => $meme->filename,
            'original_filename' => $meme->original_filename,
            'display_name' => $fav && $fav->custom_name ? $fav->custom_name : ($meme->display_name ?: pathinfo($meme->filename, PATHINFO_FILENAME)),
            'default_name' => $meme->display_name ?: pathinfo($meme->filename, PATHINFO_FILENAME),
            'status' => $meme->status,
            'rejection_reason' => $meme->rejection_reason,
            'rejected_at' => $meme->rejected_at?->toIso8601String(),
            'size' => (int) $meme->size,
            'mime' => $meme->mime,
            'url' => $this->storage->cacheUrlFor($meme),
            'is_favorite' => $fav ? (bool) $fav->is_favorite : false,
            'visibility' => $meme->visibility ?? Meme::VISIBILITY_PUBLIC,
        ];

        if ($canEditVisibility) {
            $payload['allowed_user_ids'] = MemeVisibilityUser::where('meme_id', $meme->id)
                ->pluck('user_id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return $payload;
    }

    private function buildQuota(User $actor): ?array
    {
        if (!$actor->exists) {
            return null;
        }

        $settings = app(\Flarum\Settings\SettingsRepositoryInterface::class);
        $allowUploads = (bool) $settings->get('tangyuan-meme.allowUserUploads', false);
        $maxCount = (int) $settings->get('tangyuan-meme.maxUploadsPerUser', 100);
        $maxSize = (int) $settings->get('tangyuan-meme.maxTotalSizePerUser', 10 * 1024 * 1024);

        $usedCount = Meme::where('uploader_id', $actor->id)
            ->whereIn('status', [Meme::STATUS_APPROVED, Meme::STATUS_PENDING])
            ->count();

        $usedSize = (int) Meme::where('uploader_id', $actor->id)
            ->whereIn('status', [Meme::STATUS_APPROVED, Meme::STATUS_PENDING])
            ->sum('size');

        return [
            'allow_uploads' => $allowUploads && $actor->hasPermission('tangyuan-meme.uploadMeme'),
            'can_view' => $this->hasGalleryAccess($actor),
            'can_moderate' => $actor->hasPermission('tangyuan-meme.moderateMeme'),
            'can_manage_official' => $actor->hasPermission('tangyuan-meme.manageOfficialMemes'),
            'max_count' => $maxCount,
            'max_size' => $maxSize,
            'used_count' => $usedCount,
            'used_size' => $usedSize,
            'allowed_formats' => (string) $settings->get('tangyuan-meme.allowedFormatsRegex', '/\.(png|jpe?g|gif|webp)$/i'),
        ];
    }

    private function hasGalleryAccess(User $actor): bool
    {
        return $actor->hasPermission('tangyuan-meme.viewMemes')
            || $actor->hasPermission('tangyuan-meme.moderateMeme')
            || $actor->hasPermission('tangyuan-meme.manageOfficialMemes');
    }
}
