<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Service\MemeStorage;

class MemeServeController implements RequestHandlerInterface
{
    use JsonResponder;

    private const MIME_TYPES = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
    ];

    public function __construct(private MemeStorage $storage)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $id = (int) Arr::get($params, 'id', 0);
        $src = (string) Arr::get($params, 'src', '');
        $filename = (string) Arr::get($params, 'filename', '');

        $meme = null;
        if ($id > 0) {
            $meme = Meme::find($id);
        } elseif ($src !== '') {
            // BBCode src — numeric = id, string = filename
            if (ctype_digit($src)) {
                $meme = Meme::find((int) $src);
            } else {
                $meme = Meme::official()->approved()->where('filename', basename($src))->first();
                if (!$meme) {
                    $meme = Meme::userType()->approved()->where('filename', basename($src))->first();
                }
            }
        } elseif ($filename !== '') {
            $meme = Meme::official()->approved()->where('filename', basename($filename))->first();
            if (!$meme) {
                $meme = Meme::userType()->approved()->where('filename', basename($filename))->first();
            }
        }

        if (!$meme) {
            return $this->textResponse('Not Found', 404);
        }

        $actor = RequestUtil::getActor($request);
        if ($meme->status !== Meme::STATUS_APPROVED) {
            $canSee = $actor->hasPermission('tangyuan-meme.moderateMeme')
                || ($actor->exists && (int) $actor->id === (int) $meme->uploader_id);
            if (!$canSee) {
                return $this->textResponse('Not Found', 404);
            }
        }

        if (!$meme->isOfficial()) {
            $canSee = $actor->hasPermission('tangyuan-meme.moderateMeme')
                || $meme->isPublic()
                || ($actor->exists && (int) $actor->id === (int) $meme->uploader_id)
                || (($actor->exists ? (int) $actor->id : 0) > 0 && $meme->visibilityUsers()->where('user_id', (int) $actor->id)->exists());

            if (!$canSee) {
                return $this->textResponse('Not Found', 404);
            }
        }

        $this->storage->ensureBuiltInOfficialFilesSeeded();
        $this->storage->ensureCached($meme);

        $sourcePath = $this->storage->cachePathFor($meme);
        if (!file_exists($sourcePath)) {
            $sourcePath = $this->storage->storagePathFor($meme);
        }

        if (!file_exists($sourcePath)) {
            return $this->textResponse('Not Found', 404);
        }

        $ext = strtolower(pathinfo($meme->filename, PATHINFO_EXTENSION));
        $mime = self::MIME_TYPES[$ext] ?? ($meme->mime ?: 'application/octet-stream');

        $handle = fopen($sourcePath, 'rb');
        if ($handle === false) {
            return $this->textResponse('Unable to read file', 500);
        }

        return (new Response())
            ->withStatus(200)
            ->withHeader('Content-Type', $mime)
            ->withHeader('Content-Length', (string) filesize($sourcePath))
            ->withHeader('Cache-Control', 'public, max-age=2592000, immutable')
            ->withBody(new Stream($handle));
    }

    private function textResponse(string $body, int $status = 200): ResponseInterface
    {
        $resource = fopen('php://temp', 'r+');
        fwrite($resource, $body);
        rewind($resource);

        return (new Response())
            ->withStatus($status)
            ->withHeader('Content-Type', 'text/plain')
            ->withBody(new Stream($resource));
    }
}
