import { Template } from 'meteor/templating';

import { Players } from '../lib/collections.js';

import './main.html';

Template.body.helpers({
	players() {
    return Players.find({});
  },
});
