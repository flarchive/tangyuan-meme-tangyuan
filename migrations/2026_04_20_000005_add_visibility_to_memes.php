<?php

use Flarum\Database\Migration;

return Migration::addColumns('meme_items', [
    'visibility' => ['string', 'length' => 16, 'default' => 'public'],
]);
