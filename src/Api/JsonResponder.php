<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ResponseInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Model\MemeFavorite;
use Tangyuan\Meme\Model\MemeTabPin;
use Tangyuan\Meme\Service\MemeStorage;

trait JsonResponder
{
    protected function jsonResponse(array $body, int $status = 200): ResponseInterface
    {
        $resource = fopen('php://temp', 'r+');
        fwrite($resource, json_encode($body));
        rewind($resource);

        return (new Response())
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Cache-Control', 'no-cache')
            ->withBody(new Stream($resource));
    }
}
