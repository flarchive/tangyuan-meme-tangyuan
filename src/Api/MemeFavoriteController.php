<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Model\MemeFavorite;
use Tangyuan\Meme\Model\MemeTabPin;

class MemeFavoriteController implements RequestHandlerInterface
{
    use JsonResponder;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->exists) {
            return $this->jsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = $request->getParsedBody();
        $action = Arr::get($body, 'action', '');
        $memeId = (int) Arr::get($body, 'meme_id', 0);

        if ($action === 'toggle_favorite' || $action === 'set_custom_name') {
            if ($memeId <= 0) {
                return $this->jsonResponse(['error' => 'meme_id required'], 400);
            }
            $meme = Meme::find($memeId);
            if (!$meme) {
                return $this->jsonResponse(['error' => 'Meme not found'], 404);
            }

            $record = MemeFavorite::firstOrCreate(
                ['user_id' => $actor->id, 'meme_id' => $memeId],
                ['is_favorite' => false, 'custom_name' => null]
            );

            if ($action === 'toggle_favorite') {
                $record->is_favorite = !$record->is_favorite;
            }

            if ($action === 'set_custom_name') {
                $name = trim((string) Arr::get($body, 'custom_name', ''));
                $name = mb_substr($name, 0, 15);
                $record->custom_name = $name === '' ? null : $name;
            }

            $record->save();

            return $this->jsonResponse([
                'meme_id' => (int) $memeId,
                'is_favorite' => (bool) $record->is_favorite,
                'custom_name' => $record->custom_name,
            ]);
        }

        if ($action === 'pin_uploader' || $action === 'unpin_uploader') {
            $uploaderId = (int) Arr::get($body, 'uploader_id', 0);
            if ($uploaderId <= 0) {
                return $this->jsonResponse(['error' => 'uploader_id required'], 400);
            }

            if ($action === 'unpin_uploader') {
                MemeTabPin::where('user_id', $actor->id)
                    ->where('pinned_uploader_id', $uploaderId)
                    ->delete();
                return $this->jsonResponse(['pinned_uploader_ids' => $this->getPinnedIds((int) $actor->id)]);
            }

            $maxPos = (int) MemeTabPin::where('user_id', $actor->id)->max('position');
            MemeTabPin::firstOrCreate(
                ['user_id' => $actor->id, 'pinned_uploader_id' => $uploaderId],
                ['position' => $maxPos + 1]
            );

            return $this->jsonResponse(['pinned_uploader_ids' => $this->getPinnedIds((int) $actor->id)]);
        }

        return $this->jsonResponse(['error' => 'Unknown action'], 400);
    }

    private function getPinnedIds(int $userId): array
    {
        return MemeTabPin::where('user_id', $userId)
            ->orderBy('position')
            ->pluck('pinned_uploader_id')
            ->map(fn($id) => (int) $id)
            ->all();
    }
}
