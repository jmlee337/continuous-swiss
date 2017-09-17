import {Meteor} from 'meteor/meteor';

import {check} from 'meteor/check';
import {tryPromote} from '/server/main.js';

Meteor.methods({
  manualPromote: function(ladderId) {
    check(ladderId, String);

    tryPromote(ladderId);
  }
});
