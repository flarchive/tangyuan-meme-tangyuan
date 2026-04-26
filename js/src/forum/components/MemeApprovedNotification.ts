import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

export default class MemeApprovedNotification extends Notification {
    icon() {
        return 'fas fa-check-circle';
    }

    href() {
        return app.route('tangyuan.meme.my');
    }

    content() {
        return app.translator.trans('tangyuan-meme-tangyuan.forum.notifications.meme_approved');
    }

    excerpt() {
        return this.attrs.notification.content()?.display_name || null;
    }
}
