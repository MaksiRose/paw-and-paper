const bfd = require('bfd-api-redux');
const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const express = require('express');
const DiscordBotListAPI = require('dbl-api');

module.exports = {
	async execute(client) {

		const bfdClient = new bfd(client.votes.bfd.token, '862718885564252212');
		client.votes.bfd = bfdClient;

		const serverCount = client.guilds.cache.size;
		client.votes.bfd.setServers(serverCount);
		/*
		Structure:
			{
				voted: true,
				votes: [ { userid: '268402976844939266', expires: '1649111130698' } ]
			}
		Questions:
			Does "voted" turn false after 12h?
			Are new votes appearing at the front of the votes array or at the end?
		*/


		AutoPoster(client.votes.top.token, client);

		const topApi = new Topgg.Api(client.votes.top.token);
		const app = express();
		const webhook = new Topgg.Webhook(client.votes.top.authorization);

		client.votes.top = topApi;
		client.votes.top.users = {};

		app.post('/top', webhook.listener(async vote => {

			console.log(vote);
			const twelveHoursInMs = 43200000;
			client.votes.top.users[vote.user] = Date.now() + twelveHoursInMs;
		}));

		app.listen(3000);

		// in vote structure:
		// if (Date.now() > client.votes.top.users[userid] && await client.votes.api.hasVoted(userid)) {

		// 	client.votes.top.users[userid] = Date.now() + twelveHoursInMs;
		// }


		// const dblApi = new DiscordBotListAPI({ port: 3000, path: '/' });
		// dblApi.on('upvote', (user, bot) => console.log(`Upvote by ${user} for bot ${bot}`));

		// app.post('/', () => {

		// 	console.log('test');
		// });
	},
};