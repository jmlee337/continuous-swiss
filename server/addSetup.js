import {Meteor} from 'meteor/meteor';
import {Setups} from '/lib/collections.js';

import {check} from 'meteor/check';
import {tryPromote} from '/server/main.js';

Meteor.methods({
  addSetup: function(ladderId) {
    check(ladderId, String);

    const setups =
        Setups.find({ladderId: ladderId}, {sort: [['number', 'asc']]}).fetch();
    if (setups.length === 0) {
      Setups.insert({ladderId: ladderId, number: 1});
    } else if (setups[setups.length - 1].number === setups.length) {
      // if there's no gap in numbering, add the new setup at the end.
      Setups.insert({ladderId: ladderId, number: setups.length + 1});
    } else {
      // there's a gap somewhere, find it and fill it.
      for (let i = 0; i < setups.length; i++) {
        if (setups[i].number !== i + 1) {
          Setups.insert({ladderId: ladderId, number: i + 1});
          break;
        }
      }
    }
    tryPromote(ladderId);
  },
});
