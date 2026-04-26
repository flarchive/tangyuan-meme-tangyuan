{!! app('translator')->trans('tangyuan-meme-tangyuan.email.meme_rejected.body', [
    'count' => $blueprint->getData()['count'],
    'name' => $blueprint->getData()['display_name'],
    'reason' => $blueprint->getData()['reason'] ?? '',
    'forum' => $settings->get('forum_title'),
    'url' => $url->to('forum')->route('tangyuan.meme.gallery'),
]) !!}
