import { extend, override } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import IndexPage from 'flarum/forum/components/IndexPage';
import NotificationGrid from 'flarum/forum/components/NotificationGrid';
import LinkButton from 'flarum/common/components/LinkButton';
import ItemList from 'flarum/common/utils/ItemList';

import addMemeButton from './addMemeButton';
import MemeGalleryPage from './components/MemeGalleryPage';
import MemeOfficialPage from './components/MemeOfficialPage';
import MemePendingPage from './components/MemePendingPage';
import MemeUsersPage from './components/MemeUsersPage';
import MemeMyPage from './components/MemeMyPage';
import MemeApprovedNotification from './components/MemeApprovedNotification';
import MemeRejectedNotification from './components/MemeRejectedNotification';

app.initializers.add('tangyuan-meme-tangyuan', () => {
    app.notificationComponents.memeApproved = MemeApprovedNotification as any;
    app.notificationComponents.memeRejected = MemeRejectedNotification as any;
    app.routes['tangyuan.meme.gallery'] = {
        path: '/memes',
        component: MemeGalleryPage as any,
    };
    app.routes['tangyuan.meme.official'] = {
        path: '/memes/official',
        component: MemeOfficialPage as any,
    };
    app.routes['tangyuan.meme.pending'] = {
        path: '/memes/pending',
        component: MemePendingPage as any,
    };
    app.routes['tangyuan.meme.users'] = {
        path: '/memes/users',
        component: MemeUsersPage as any,
    };
    app.routes['tangyuan.meme.my'] = {
        path: '/memes/my',
        component: MemeMyPage as any,
    };

    addMemeButton();

    extend(NotificationGrid.prototype as any, 'notificationTypes', function (items: ItemList<any>) {
        items.add('memeApproved', {
            name: 'memeApproved',
            icon: 'fas fa-check-circle',
            label: app.translator.trans('tangyuan-meme-tangyuan.forum.notifications.meme_approved'),
        });

        items.add('memeRejected', {
            name: 'memeRejected',
            icon: 'fas fa-times-circle',
            label: app.translator.trans('tangyuan-meme-tangyuan.forum.notifications.meme_rejected'),
        });
    });

    extend(IndexPage.prototype as any, 'navItems', function (items: ItemList<any>) {
        const user = app.session.user;
        if (!user) return;
        const canView =
            user.attribute('canViewMemes') ||
            user.attribute('canModerateMemes') ||
            user.attribute('canManageOfficialMemes');
        if (!canView) return;

        items.add(
            'tangyuan-memes',
            LinkButton.component(
                {
                    href: app.route('tangyuan.meme.gallery'),
                    icon: 'fas fa-images',
                },
                app.translator.trans('tangyuan-meme-tangyuan.forum.sidebar.nav_title')
            ) as any,
            -10
        );
    });
});
