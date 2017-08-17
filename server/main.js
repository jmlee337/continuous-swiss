import { Meteor } from 'meteor/meteor';

import { Players } from '../lib/collections.js';
import { Queue } from '../lib/queue.js';

Meteor.methods({
  addPlayer: function(playerName) {
    Players.insert({
      name: playerName,
      queue: Queue.NONE,
    });
  },

	clearDb: function() {
		Players.remove({});
	},
});
