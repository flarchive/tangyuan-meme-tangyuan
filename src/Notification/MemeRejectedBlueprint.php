<?php

namespace Tangyuan\Meme\Notification;

use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Notification\MailableInterface;
use Tangyuan\Meme\Model\Meme;

class MemeRejectedBlueprint implements BlueprintInterface, MailableInterface
{
    public function __construct(
        protected Meme $meme,
        protected ?string $reason = null,
        protected ?int $notificationUserId = null,
    ) {
    }

    public function getFromUser()
    {
        return $this->meme->uploader;
    }

    public function getSubject()
    {
        return $this->meme;
    }

    public function getData()
    {
        return [
            'display_name' => $this->meme->display_name,
            'reason' => $this->reason,
            'notification_user_id' => $this->notificationUserId,
        ];
    }

    public static function getType()
    {
        return 'memeRejected';
    }

    public static function getSubjectModel()
    {
        return Meme::class;
    }

    public function getEmailView()
    {
        return ['text' => 'tangyuan-meme::emails.memeRejected'];
    }

    public function getEmailSubject(\Symfony\Contracts\Translation\TranslatorInterface $translator)
    {
        return $translator->trans('tangyuan-meme-tangyuan.email.meme_rejected.subject', [
            'count' => 1,
        ]);
    }
}
