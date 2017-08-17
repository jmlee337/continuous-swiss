import { Template } from 'meteor/templating';

import { Players } from '../lib/collections.js';
import { Queue } from '../lib/queue.js';

import './main.html';

Template.body.helpers({
	'unqueued': function() {
    return Players.find({queue: Queue.NONE});
  },

  'matchmaking': function() {
    return Players.find({queue: Queue.MATCHMAKING});
  },

  'waiting': function() {
    return Players.find({queue: Queue.WAITING});
  },

  'playing': function() {
    return Players.find({queue: Queue.PLAYING});
  },
});

Template.body.events({
  'submit .addPlayer': function(event) {
    let playerName = event.target.playerName;
    Meteor.call('addPlayer', playerName.value);
    playerName.value = "";
    return false;
  },

  'click .clear': function(event) {
    Meteor.call('clearDb');
  },
});
