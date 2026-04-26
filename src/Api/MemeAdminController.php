<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Flarum\Notification\NotificationSyncer;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Notification\MemeApprovedBlueprint;
use Tangyuan\Meme\Notification\MemeRejectedBlueprint;
use Tangyuan\Meme\Service\MemeStorage;

class MemeAdminController implements RequestHandlerInterface
{
    use JsonResponder;

    public function __construct(
        private MemeStorage $storage,
        private NotificationSyncer $notifications,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->exists) {
            return $this->jsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = $request->getParsedBody();
        $action = (string) Arr::get($body, 'action', '');
        $ids = (array) Arr::get($body, 'ids', []);
        $ids = array_values(array_filter(array_map('intval', $ids), fn($v) => $v > 0));

        $reason = trim((string) Arr::get($body, 'reason', ''));

        // set-all-private doesn't need ids
        if ($action === 'set-all-private') {
            return $this->setAllPrivate($actor);
        }

        if (empty($ids)) {
            return $this->jsonResponse(['error' => 'ids required'], 400);
        }

        if ($action === 'approve') {
            if (!$actor->hasPermission('tangyuan-meme.moderateMeme')) {
                return $this->jsonResponse(['error' => 'Forbidden'], 403);
            }
            return $this->approve($ids);
        }

        if ($action === 'reject') {
            if (!$actor->hasPermission('tangyuan-meme.moderateMeme')) {
                return $this->jsonResponse(['error' => 'Forbidden'], 403);
            }
            return $this->reject($ids, $reason);
        }

        if ($action === 'delete') {
            return $this->delete($ids, $actor);
        }

        if ($action === 'rename') {
            return $this->rename($ids, $actor, $body);
        }

        return $this->jsonResponse(['error' => 'Unknown action'], 400);
    }

    private function approve(array $ids): ResponseInterface
    {
        $memes = Meme::whereIn('id', $ids)->get();
        $notifyByUploader = [];

        foreach ($memes as $meme) {
            if ($meme->status === Meme::STATUS_APPROVED) continue;
            $meme->status = Meme::STATUS_APPROVED;
            $meme->rejection_reason = null;
            $meme->rejected_at = null;
            $meme->save();
            $this->storage->ensureCached($meme);

            if ($meme->uploader_id) {
                $notifyByUploader[(int) $meme->uploader_id][] = $meme;
            }
        }

        foreach ($notifyByUploader as $uploaderId => $list) {
            $first = $list[0];
            $user = $first->uploader;
            if ($user) {
                try {
                    ob_start();
                    $this->notifications->sync(
                        new MemeApprovedBlueprint($first, (int) $uploaderId),
                        [$user]
                    );
                    ob_end_clean();
                } catch (\Throwable $e) {
                    while (ob_get_level() > 0) ob_end_clean();
                }
            }
        }

        return $this->jsonResponse([
            'approved_ids' => $memes->pluck('id')->map(fn($id) => (int) $id)->all(),
        ]);
    }

    private function reject(array $ids, string $reason): ResponseInterface
    {
        $memes = Meme::whereIn('id', $ids)->get();
        $now = \Carbon\Carbon::now();
        $notifyByUploader = [];

        foreach ($memes as $meme) {
            if ($meme->status === Meme::STATUS_REJECTED) continue;
            $meme->status = Meme::STATUS_REJECTED;
            $meme->rejection_reason = $reason !== '' ? $reason : null;
            $meme->rejected_at = $now;
            $meme->save();

            if ($meme->uploader_id) {
                $notifyByUploader[(int) $meme->uploader_id][] = $meme;
            }
        }

        foreach ($notifyByUploader as $uploaderId => $list) {
            $first = $list[0];
            $user = $first->uploader;
            if ($user) {
                try {
                    ob_start();
                    $this->notifications->sync(
                        new MemeRejectedBlueprint($first, $reason !== '' ? $reason : null, (int) $uploaderId),
                        [$user]
                    );
                    ob_end_clean();
                } catch (\Throwable $e) {
                    while (ob_get_level() > 0) ob_end_clean();
                }
            }
        }

        return $this->jsonResponse([
            'rejected_ids' => $memes->pluck('id')->map(fn($id) => (int) $id)->all(),
        ]);
    }

    private function delete(array $ids, $actor): ResponseInterface
    {
        $memes = Meme::whereIn('id', $ids)->get();
        $deletedIds = [];

        foreach ($memes as $meme) {
            $canDelete = false;

            if ($meme->isOfficial() && $actor->hasPermission('tangyuan-meme.manageOfficialMemes')) {
                $canDelete = true;
            } elseif (!$meme->isOfficial()) {
                if ($actor->hasPermission('tangyuan-meme.moderateMeme')) {
                    $canDelete = true;
                } elseif ((int) $meme->uploader_id === (int) $actor->id) {
                    $canDelete = true;
                }
            }

            if (!$canDelete) continue;

            $this->storage->deleteMemeFiles($meme);
            $meme->delete();
            $deletedIds[] = (int) $meme->id;
        }

        return $this->jsonResponse(['deleted_ids' => $deletedIds]);
    }

    private function rename(array $ids, $actor, array $body): ResponseInterface
    {
        $newName = trim((string) Arr::get($body, 'display_name', ''));
        if ($newName === '') {
            return $this->jsonResponse(['error' => 'display_name required'], 400);
        }
        $newName = mb_substr($newName, 0, 191);

        $memes = Meme::whereIn('id', $ids)->get();
        $renamed = [];

        foreach ($memes as $meme) {
            $isOwner = $meme->uploader_id && (int) $meme->uploader_id === (int) $actor->id;
            $isModerator = $actor->hasPermission('tangyuan-meme.moderateMeme');
            if (!$isOwner && !$isModerator) continue;

            $meme->display_name = $newName;
            $meme->save();
            $renamed[] = (int) $meme->id;
        }

        return $this->jsonResponse(['renamed_ids' => $renamed]);
    }

    private function setAllPrivate($actor): ResponseInterface
    {
        $updated = Meme::where('uploader_id', $actor->id)
            ->where('visibility', Meme::VISIBILITY_PUBLIC)
            ->update(['visibility' => Meme::VISIBILITY_PRIVATE]);

        return $this->jsonResponse(['updated_count' => (int) $updated]);
    }
}
