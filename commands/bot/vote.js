const config = require('../../config.json');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const startCooldown = require('../../utils/startCooldown');
const fs = require('fs');
const profileModel = require('../../models/profileModel');

module.exports = {
	name: 'vote',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		const botReply = await message
			.reply({
				embeds: [...embedArray, {
					color: config.default_color,
					description: 'Click a button to be sent to that websites bot page. After voting for this bot, select the website you voted on from the drop-down menu to get +30 energy.',
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [
						{ type: 'BUTTON', label: 'top.gg', url: 'https://top.gg/bot/862718885564252212', style: 'LINK' },
						{ type: 'BUTTON', label: 'discords.com', url: 'https://discords.com/bots/bot/862718885564252212', style: 'LINK' },
						{ type: 'BUTTON', label: 'discordbotlist.com', url: 'https://discordbotlist.com/bots/paw-and-paper', style: 'LINK' },
					],
				}, {
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						customId: 'vote-options',
						placeholder: 'Select the site on which you voted',
						options: [
							{ label: 'top.gg', value: 'top.gg-vote' },
							{ label: 'discords.com', value: 'discords.com-vote' },
							{ label: 'discordbotlist.com', value: 'discordbotlist.com-vote' },
						],
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);

		const filter = i => i.user.id === message.author.id && i.customId === 'vote-options';

		botReply
			.awaitMessageComponent({ filter })
			.then(async interaction => {

				const voteCache = JSON.parse(fs.readFileSync('./database/voteCache.json'));
				const twelveHoursInMs = 43200000;

				await interaction.message
					.edit({
						components: [],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				const successfulTopVote = interaction.values[0] === 'top.gg-vote' && (voteCache[message.author.id]?.lastRecordedTopVote > Date.now() - twelveHoursInMs || await client.votes.top.hasVoted(message.author.id));
				const redeemedTopVote = successfulTopVote && Date.now() < voteCache[message.author.id]?.nextRedeemableTopVote;

				const discordsVote = await client.votes.bfd.checkVote(message.author.id);
				const successfulDiscordsVote = interaction.values[0] === 'discords.com-vote' && (voteCache[message.author.id]?.lastRecordedDiscordsVote > Date.now() - twelveHoursInMs || discordsVote.voted);
				const redeemedDiscordsVote = successfulDiscordsVote && Date.now() < voteCache[message.author.id]?.nextRedeemableDiscordsVote;

				const successfulDblVote = interaction.values[0] === 'discordbotlist.com-vote' && voteCache[message.author.id]?.lastRecordedDblVote > Date.now() - twelveHoursInMs;
				const redeemedDblVote = successfulDblVote && Date.now() < voteCache[message.author.id]?.nextRedeemableDblVote;

				if (successfulTopVote === true || successfulDiscordsVote === true || successfulDblVote === true) {

					if (redeemedTopVote === true || redeemedDiscordsVote === true || redeemedDblVote === true) {

						return await interaction
							.followUp({
								content: 'You already collected your reward for this vote!',
								ephemeral: true,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}

					voteCache[message.author.id] = voteCache[message.author.id] ?? {};

					if (successfulTopVote === true) { voteCache[message.author.id].nextRedeemableTopVote = (voteCache[message.author.id].lastRecordedTopVote || Date.now()) + twelveHoursInMs; }
					if (successfulDiscordsVote === true) { voteCache[message.author.id].nextRedeemableDiscordsVote = voteCache[message.author.id]?.lastRecordedDiscordsVote > Date.now() - twelveHoursInMs ? voteCache[message.author.id].lastRecordedDiscordsVote + twelveHoursInMs : Number(discordsVote.votes[0].expires); }
					if (successfulDblVote === true) { voteCache[message.author.id].nextRedeemableDblVote = voteCache[message.author.id].lastRecordedDblVote + twelveHoursInMs; }

					fs.writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));

					const energyPoints = profileData.maxEnergy - profileData.energy < 30 ? profileData.maxEnergy - profileData.energy : 30;

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { energy: energyPoints } },
					);

					return await interaction
						.followUp({
							embeds: [{
								color: config.default_color,
								title: 'Thank you for voting!',
								footer: { text: `+${energyPoints} energy` },
							}],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				return await interaction
					.followUp({
						content: 'You haven\'t voted on this website in the last 12 hours!',
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			})
			.catch(async () => {

				return await botReply
					.edit({
						components: [],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			});
	},
};