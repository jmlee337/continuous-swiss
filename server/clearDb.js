import {Ladders} from '/lib/collections.js';
import {Matches} from '/lib/collections.js';
import {Meteor} from 'meteor/meteor';
import {Pairings} from '/lib/collections.js';
import {Players} from '/lib/collections.js';
import {Setups} from '/lib/collections.js';

Meteor.methods({
  clearDb: function() {
    Ladders.remove({});
    Players.remove({});
    Pairings.remove({});
    Setups.remove({});
    Matches.remove({});
  },
});
