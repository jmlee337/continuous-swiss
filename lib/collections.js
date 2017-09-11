import {Mongo} from 'meteor/mongo';

/**
 * slug: the url slug of this ladder.
 * name: the name of this ladder.
 * started: if this ladder has started.
 * numSeeds: number of players who have an explicit seed.
 * closed: if the ladder is closed (no queuing).
 */
export const Ladders = new Mongo.Collection('ladders');

/**
 * ladderId: the _id of the ladder.
 * name: the name of this player.
 * tier: the relative skill level of the player. Higher is better. Only used
 *    before ladder start to help determine seed.
 * seed: the seed of this player. Lower is better, 0 is the highest.
 * score: this player's score.
 * wins: the number of wins this player has.
 * losses: the nubmer of losses this player has.
 * games: the number of games this player has played.
 * lastMatchId: the _id of this player's last match.
 * results: an array of Results.
 * opponents: an array of opponent Player's _ids.
 * bonuses: how many games to apply late entrant provision to this player.
 * queue: the queue this player is in.
 * queueTime: the time that this player enetered the current queue.
 */
export const Players = new Mongo.Collection('players');

/**
 * ladderId: the _id of the ladder.
 * score: the mutual score of the players in this pairing.
 * player1Id: the _id of the player.
 * player1Name: the name of the player.
 * player1Bonus: if the player has a bonus.
 * player1Seed: the seed of the player.
 * player2Id: the _id of the player.
 * player2Name: the name of the player.
 * player2Bonus: if the player has a bonus.
 * player2Seed: the seed of the player.
 * queue: the queue this pairing is in. Only Queue.MATCHMAKING or Queue.PLAYING.
 * queueTime: the time that this pairing entered the current queue.
 * setupId: the _id of the setup if this pairing is playing. If non-existent
 *    while queue is Queue.PLAYING, then the pairing is frozen.
 * setupNumber: the number of the setup if this pairing is playing. If
 *    non-existent while queue is Queue.PLAYING, then the pairing is frozen.
 */
export const Pairings = new Mongo.Collection('pairings');

/**
 * ladderId: the _id of the ladder.
 * number: the number of this setup.
 * pairingId: the _id of the pairing playing on this setup if any.
 */
export const Setups = new Mongo.Collection('setups');

/**
 * ladderId: the _id of the ladder.
 * winnerId: the _id of the player that won.
 * winnerName: the name of the player that won.
 * winnerBonus: if the winner had a bonus.
 * winnerSeed: the original seed of the winner.
 * loserId: the _id of the player that lost.
 * loserName: the name of the player that lost.
 * loserBonus: if the loser had a bonus.
 * loserSeed: the original seed of the loser.
 * forfeited: if the match was decided by forfeit.
 * unfixable: true if the result of this match cannot be changed.
 * time: the time that this match finished.
 * duration: how long the match took.
 */
export const Matches = new Mongo.Collection('matches');
