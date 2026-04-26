<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class MemeUserSearchController implements RequestHandlerInterface
{
    use JsonResponder;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->exists) {
            return $this->jsonResponse(['error' => 'Unauthorized'], 401);
        }

        $params = $request->getQueryParams();
        $q = trim((string) Arr::get($params, 'q', ''));
        $ids = Arr::get($params, 'ids');

        $query = User::query()->select(['id', 'username', 'avatar_url']);

        if (is_string($ids) && $ids !== '') {
            $idList = array_values(array_filter(array_map('intval', explode(',', $ids)), fn ($v) => $v > 0));
            if (!empty($idList)) {
                $users = $query->whereIn('id', $idList)->limit(50)->get();
                return $this->jsonResponse([
                    'users' => $users->map(fn (User $u) => [
                        'id' => (int) $u->id,
                        'username' => $u->username,
                        'avatar_url' => $u->avatar_url,
                    ])->all(),
                ]);
            }
        }

        if ($q === '') {
            return $this->jsonResponse(['users' => []]);
        }

        $users = $query
            ->where('username', 'like', $q . '%')
            ->where('id', '<>', $actor->id)
            ->orderBy('username')
            ->limit(10)
            ->get();

        return $this->jsonResponse([
            'users' => $users->map(fn (User $u) => [
                'id' => (int) $u->id,
                'username' => $u->username,
                'avatar_url' => $u->avatar_url,
            ])->all(),
        ]);
    }
}
