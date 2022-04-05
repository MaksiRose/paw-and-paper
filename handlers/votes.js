const bfd = require('bfd-api-redux');
const { AutoPoster } = require('topgg-autoposter');
const Topgg = require('@top-gg/sdk');
const express = require('express');

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
		const topApp = express();
		const webhook = new Topgg.Webhook(client.votes.top.authorization);

		client.votes.top = topApi;
		client.votes.top.users = {};

		topApp.post('/top', webhook.listener(async vote => {

			const twelveHoursInMs = 43200000;
			client.votes.top.users[vote.user] = Date.now() + twelveHoursInMs;
		}));

		topApp.listen(3000);


		const dblApp = express();
		client.votes.dbl.users = {};

		dblApp.use(express.json());

		dblApp.post('/dbl', (request, response) => {

			// It seems as though the authorization isn't working yet. Other than that, this works!
			console.log('body:', request.body);
			console.log('authorization:', typeof request.headers.authorization, typeof client.votes.dbl.authorization);
			if (request.headers.authorization === client.votes.dbl.authorization) {

				const twelveHoursInMs = 43200000;
				client.votes.dbl.users[request.body.id] = Date.now() + twelveHoursInMs;
			}

			response.status(200).end();
		});

		dblApp.listen(3001);
	},
};