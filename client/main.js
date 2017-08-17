import { Template } from 'meteor/templating';

import { Players } from '../lib/collections.js';

import './main.html';

Template.body.helpers({
	'players': function() {
    return Players.find({});
  },
});

Template.body.events({
  'submit .addPlayer': function(event) {
    Players.insert({name: event.target.playerName.value});
    return false;
  },

  'click .clear': function(event) {
    Meteor.call('clearDb');
  },
});
