import {check} from 'meteor/check';
import {Meteor} from 'meteor/meteor';

import {Ladders} from '/lib/collections.js';
import {Matches} from '/lib/collections.js';
import {Pairings} from '/lib/collections.js';
import {Players} from '/lib/collections.js';
import {Setups} from '/lib/collections.js';

Meteor.publish('ladders', () => {
  return Ladders.find();
});

Meteor.publish('matches', (ladderId) => {
  check(ladderId, String);

  return Matches.find({ladderId: ladderId});
});

Meteor.publish('pairings', (ladderId) => {
  check(ladderId, String);

  return Pairings.find({ladderId: ladderId});
});

Meteor.publish('players', (ladderId) => {
  check(ladderId, String);

  return Players.find({ladderId: ladderId});
});

Meteor.publish('setups', (ladderId) => {
  check(ladderId, String);

  return Setups.find({ladderId: ladderId});
});
