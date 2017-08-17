import { Meteor } from 'meteor/meteor';

import { Players } from '../lib/collections.js';

Meteor.methods({
	clearDb: function() {
		Players.remove({});
	},
});