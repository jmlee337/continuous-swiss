import {Ladders} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';

import {check} from 'meteor/check';
import {queuePlayerCommon} from '/server/main.js';

Meteor.methods({
  queuePlayer: function(ladderId, playerId) {
    check(ladderId, String);
    check(playerId, String);

    const ladder = Ladders.findOne(ladderId);
    if(!ladder) {
      throw new Meteor.Error('BAD_REQUEST', 'ladder does not exist');
    }
    if (ladder.closed) {
      throw new Meteor.Error('PRECONDITION_FAILED', 'ladder is closed');
    }

    queuePlayerCommon(ladderId, playerId, true);
  },
});
