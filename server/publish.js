import {Meteor} from 'meteor/meteor';

import {Ladders} from '../lib/collections.js';
import {Matches} from '../lib/collections.js';
import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Setups} from '../lib/collections.js';

Meteor.publish('ladders', () => {
  return Ladders.find();
});

Meteor.publish('matches', (ladderId) => {
  return Matches.find({ladderId: ladderId});
});

Meteor.publish('pairings', (ladderId) => {
  return Pairings.find({ladderId: ladderId});
});

Meteor.publish('players', (ladderId) => {
  return Players.find({ladderId: ladderId});
});

Meteor.publish('setups', (ladderId) => {
  return Setups.find({ladderId: ladderId});
});
