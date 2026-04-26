<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Model\MemeVisibilityUser;

class MemeVisibilityController implements RequestHandlerInterface
{
    use JsonResponder;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->exists) {
            return $this->jsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = $request->getParsedBody();
        $memeId = (int) Arr::get($body, 'meme_id', 0);
        if ($memeId <= 0) {
            return $this->jsonResponse(['error' => 'meme_id required'], 400);
        }

        $meme = Meme::find($memeId);
        if (!$meme) {
            return $this->jsonResponse(['error' => 'Meme not found'], 404);
        }

        $isOwner = $meme->uploader_id && (int) $meme->uploader_id === (int) $actor->id;
        $isModerator = $actor->hasPermission('tangyuan-meme.moderateMeme');
        if (!$isOwner && !$isModerator) {
            return $this->jsonResponse(['error' => 'Forbidden'], 403);
        }

        $visibility = (string) Arr::get($body, 'visibility', Meme::VISIBILITY_PUBLIC);
        if (!in_array($visibility, [Meme::VISIBILITY_PUBLIC, Meme::VISIBILITY_PRIVATE], true)) {
            return $this->jsonResponse(['error' => 'Invalid visibility'], 400);
        }

        $meme->visibility = $visibility;
        $meme->save();

        if ($visibility === Meme::VISIBILITY_PUBLIC) {
            MemeVisibilityUser::where('meme_id', $meme->id)->delete();
        } else {
            $ids = Arr::get($body, 'allowed_user_ids', []);
            $ids = array_values(array_unique(array_filter(array_map('intval', (array) $ids), fn ($v) => $v > 0)));

            MemeVisibilityUser::where('meme_id', $meme->id)
                ->whereNotIn('user_id', $ids ?: [0])
                ->delete();

            foreach ($ids as $uid) {
                MemeVisibilityUser::firstOrCreate([
                    'meme_id' => $meme->id,
                    'user_id' => $uid,
                ]);
            }
        }

        $allowed = MemeVisibilityUser::where('meme_id', $meme->id)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $this->jsonResponse([
            'meme_id' => (int) $meme->id,
            'visibility' => $meme->visibility,
            'allowed_user_ids' => $allowed,
        ]);
    }
}
