import rateLimit from 'express-rate-limit';
const bfd = require('bfd-api-redux');
import express from 'express';
import AutoPoster from 'topgg-autoposter';
import { Api, Webhook } from '@top-gg/sdk';
import { client, handle } from '../cluster';
import DiscordUser from '../models/discordUser';
import User from '../models/user';
import { now } from '../utils/helperFunctions';

/** Updates server count on vote websites, starts event listeners to store successful votes, and adds structure to client to request individual votes */
export async function execute(
): Promise<void> {

	const limiter = rateLimit({
		windowMs: 60 * 1_000,
		max: 20,
	});

	if (handle.votes.bfd && handle.votes.bfd.token !== '' && handle.votes.bfd.authorization !== '') {

		handle.votes.bfd.client = new bfd(handle.votes.bfd.token, client.user?.id);
		handle.votes.bfd.client.setServers((await client.guilds.fetch()).size);

		const bfdApp = express();

		bfdApp.use(express.json());
		bfdApp.use(limiter);

		bfdApp.post('/discords', async (request, response) => {

			if (request.headers.authorization === handle.votes.bfd?.authorization) {

				const discordUser = await DiscordUser.findByPk(request.body.user, {
					include: [{ model: User, as: 'user' }],
				}) ?? undefined;
				const user = discordUser?.user;

				if (user) { await user.update({ lastRecordedDiscordsVote: now() }); }
				else { console.error(new Error(`Couldn't update lastRecordedDiscordsVote: No database entry was found for ${request.body.user}`)); }
			}

			response.status(200).end();
		});

		bfdApp.on('error', (err) => {
			console.error(err);
		});

		bfdApp.listen(3002, () => { console.log('Now listening to discords.com requests.'); });
	}

	if (handle.votes.top && handle.votes.top.token !== '' && handle.votes.top.authorization !== '') {

		AutoPoster(handle.votes.top.token, client);

		handle.votes.top.client = new Api(handle.votes.top.token);
		const webhook = new Webhook(handle.votes.top.authorization);

		const topApp = express();

		topApp.use(express.json());
		topApp.use(limiter);

		topApp.post('/top', webhook.listener(async vote => {

			const discordUser = await DiscordUser.findByPk(vote.user, {
				include: [{ model: User, as: 'user' }],
			}) ?? undefined;
			const user = discordUser?.user;

			if (user) { await user.update({ lastRecordedTopVote: now() }); }
			else { console.error(new Error(`Couldn't update lastRecordedTopVote: No database entry was found for ${vote.user}`)); }
		}));

		topApp.on('error', (err) => {
			console.error(err);
		});

		topApp.listen(3000, () => { console.log('Now listening to top.gg requests.'); });
	}

	if (handle.votes.dbl && handle.votes.dbl.token !== '' && handle.votes.dbl.authorization !== '') {

		const dblApp = express();

		dblApp.use(express.json());
		dblApp.use(limiter);

		dblApp.post('/dbl', async (request, response) => {

			if (request.headers.authorization === handle.votes.dbl?.authorization) {

				const discordUser = await DiscordUser.findByPk(request.body.id, {
					include: [{ model: User, as: 'user' }],
				}) ?? undefined;
				const user = discordUser?.user;

				if (user) { await user.update({ lastRecordedDblVote: now() }); }
				else { console.error(new Error(`Couldn't update lastRecordedDblVote: No database entry was found for ${request.body.id}`)); }
			}

			response.status(200).end();
		});

		dblApp.on('error', (err) => {
			console.error(err);
		});

		dblApp.listen(3001, () => { console.log('Now listening to top.gg requests.'); });
	}
}