import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

export default class MemeRejectedNotification extends Notification {
    icon() {
        return 'fas fa-times-circle';
    }

    href() {
        return app.route('tangyuan.meme.my');
    }

    content() {
        return app.translator.trans('tangyuan-meme-tangyuan.forum.notifications.meme_rejected');
    }

    excerpt() {
        const content = this.attrs.notification.content() as { display_name?: string; reason?: string } | undefined;
        return content?.reason || content?.display_name || null;
    }
}
