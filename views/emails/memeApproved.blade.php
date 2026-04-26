{!! app('translator')->trans('tangyuan-meme-tangyuan.email.meme_approved.body', [
    'count' => $blueprint->getData()['count'],
    'name' => $blueprint->getData()['display_name'],
    'forum' => $settings->get('forum_title'),
    'url' => $url->to('forum')->route('tangyuan.meme.gallery'),
]) !!}
