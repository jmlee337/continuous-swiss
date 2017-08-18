import {Template} from 'meteor/templating';

import {Pairings} from '../lib/collections.js';
import {Players} from '../lib/collections.js';
import {Queue} from '../lib/queue.js';

import './main.html';

Template.body.helpers({
	'unqueued': function() {
    return Players.find({queue: Queue.NONE}, {sort: [['queueTime', 'asc']]});
  },

  'matchmaking': function() {
    return Players.find({queue: Queue.MATCHMAKING}, {sort: [['queueTime', 'asc']]});
  },

  'waiting': function() {
    return Pairings.find({queue: Queue.WAITING}, {sort: [['queueTime', 'asc']]});
  },

  'playing': function() {
    return Pairings.find({queue: Queue.PLAYING}, {sort: [['queueTime', 'asc']]});
  },

  'standings': function() {
    return Players.find({}, {sort: [['score', 'desc'], ['losses', 'asc']]});
  }
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
