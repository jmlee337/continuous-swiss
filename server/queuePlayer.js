import {Meteor} from 'meteor/meteor';

import {check} from 'meteor/check';
import {queuePlayerCommon} from '/server/main.js';

Meteor.methods({
  queuePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    queuePlayerCommon(ladderId, playerId, true);
  },
});
