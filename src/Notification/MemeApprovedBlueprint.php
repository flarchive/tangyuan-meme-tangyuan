<?php

namespace Tangyuan\Meme\Notification;

use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Notification\MailableInterface;
use Tangyuan\Meme\Model\Meme;

class MemeApprovedBlueprint implements BlueprintInterface, MailableInterface
{
    public function __construct(
        protected Meme $meme,
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
            'notification_user_id' => $this->notificationUserId,
        ];
    }

    public static function getType()
    {
        return 'memeApproved';
    }

    public static function getSubjectModel()
    {
        return Meme::class;
    }

    public function getEmailView()
    {
        return ['text' => 'tangyuan-meme::emails.memeApproved'];
    }

    public function getEmailSubject(\Symfony\Contracts\Translation\TranslatorInterface $translator)
    {
        return $translator->trans('tangyuan-meme-tangyuan.email.meme_approved.subject', [
            'count' => 1,
        ]);
    }
}
