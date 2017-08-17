import { Mongo } from 'meteor/mongo';

/**
 * name: the name of the player
 */
export const Players = new Mongo.Collection('players');