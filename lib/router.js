import {BlazeLayout} from 'meteor/kadira:blaze-layout';
import {FlowRouter} from 'meteor/kadira:flow-router';

FlowRouter.route('/', {
  action: function() {
    BlazeLayout.render('appBody', {main: 'index'});
  },
});

FlowRouter.route('/ladder/:slug/admin', {
  action: function(params) {
    BlazeLayout.render('appBody', {main: 'ladderAdmin'});
  },
});

FlowRouter.route('/ladder/:slug/reporting', {
  action: function(params) {
    BlazeLayout.render('appBody', {main: 'ladderReporting'});
  },
});
