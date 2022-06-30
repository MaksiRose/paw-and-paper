// @ts-check
const { default_color } = require('../../../config.json');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { readFileSync, writeFileSync } = require('fs');
const profileModel = require('../../models/profileModel');
const { MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'vote';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema | null} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	const characterData = userData ? userData.characters[userData.currentCharacter[message.guildId || 'DM']] : null;
	const profileData = characterData?.profiles?.[message.guildId || 'DM'];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (message.inGuild() && await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);

	const botReply = await message
		.reply({
			embeds: [...embedArray, {
				color: /** @type {`#${string}`} */ (default_color),
				description: 'Click a button to be sent to that websites bot page. After voting for this bot, select the website you voted on from the drop-down menu to get +30 energy.',
			}],
			components: [ new MessageActionRow({
				components: [
					new MessageButton({ label: 'top.gg', url: 'https://top.gg/bot/862718885564252212', style: 'LINK' }),
					new MessageButton({ label: 'discords.com', url: 'https://discords.com/bots/bot/862718885564252212', style: 'LINK' }),
					new MessageButton({ label: 'discordbotlist.com', url: 'https://discordbotlist.com/bots/paw-and-paper', style: 'LINK' }),
				],
			}), new MessageActionRow({
				components: [ new MessageSelectMenu({
					customId: 'vote-options',
					placeholder: 'Select the site on which you voted',
					options: [
						{ label: 'top.gg', value: 'top.gg-vote' },
						{ label: 'discords.com', value: 'discords.com-vote' },
						{ label: 'discordbotlist.com', value: 'discordbotlist.com-vote' },
					],
					disabled: !message.inGuild(),
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === message.author.id && i.customId === 'vote-options';

	botReply
		.awaitMessageComponent({ filter, time: 600_000 })
		.then(async interaction => {

			const voteCache = JSON.parse(readFileSync('./database/voteCache.json', 'utf-8'));
			const twelveHoursInMs = 43200000;

			/** @type {boolean} */
			const successfulTopVote = /** @type {import('discord.js').SelectMenuInteraction} */ (interaction).values[0] === 'top.gg-vote' && (voteCache['id_' + message.author.id]?.lastRecordedTopVote > Date.now() - twelveHoursInMs || await /** @type {import('@top-gg/sdk').Api} */ (client.votes.top).hasVoted(message.author.id));
			/** @type {boolean} */
			const redeemedTopVote = successfulTopVote && Date.now() < voteCache['id_' + message.author.id]?.nextRedeemableTopVote;

			/** @type {{voted: boolean, votes: Array<{expires: number}>}} */
			const discordsVote = await /** @type {import('bfd-api-redux/src/main')} */ (client.votes.bfd).checkVote(message.author.id);
			/** @type {boolean} */
			const successfulDiscordsVote = /** @type {import('discord.js').SelectMenuInteraction} */ (interaction).values[0] === 'discords.com-vote' && (voteCache['id_' + message.author.id]?.lastRecordedDiscordsVote > Date.now() - twelveHoursInMs || discordsVote.voted);
			/** @type {boolean} */
			const redeemedDiscordsVote = successfulDiscordsVote && Date.now() < voteCache['id_' + message.author.id]?.nextRedeemableDiscordsVote;

			/** @type {boolean} */
			const successfulDblVote = /** @type {import('discord.js').SelectMenuInteraction} */ (interaction).values[0] === 'discordbotlist.com-vote' && voteCache['id_' + message.author.id]?.lastRecordedDblVote > Date.now() - twelveHoursInMs;
			/** @type {boolean} */
			const redeemedDblVote = successfulDblVote && Date.now() < voteCache['id_' + message.author.id]?.nextRedeemableDblVote;

			if (successfulTopVote === true || successfulDiscordsVote === true || successfulDblVote === true) {

				if (redeemedTopVote === true || redeemedDiscordsVote === true || redeemedDblVote === true) {

					await interaction
						.followUp({
							content: 'You already collected your reward for this vote!',
							ephemeral: true,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
					return;
				}

				voteCache['id_' + message.author.id] = voteCache['id_' + message.author.id] ?? {};

				if (successfulTopVote === true) { voteCache['id_' + message.author.id].nextRedeemableTopVote = (voteCache['id_' + message.author.id].lastRecordedTopVote || Date.now()) + twelveHoursInMs; }
				if (successfulDiscordsVote === true) { voteCache['id_' + message.author.id].nextRedeemableDiscordsVote = voteCache['id_' + message.author.id]?.lastRecordedDiscordsVote > Date.now() - twelveHoursInMs ? voteCache['id_' + message.author.id].lastRecordedDiscordsVote + twelveHoursInMs : Number(discordsVote.votes[0].expires); }
				if (successfulDblVote === true) { voteCache['id_' + message.author.id].nextRedeemableDblVote = voteCache['id_' + message.author.id].lastRecordedDblVote + twelveHoursInMs; }

				writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));

				// @ts-ignore, since profileData always exists in servers and interactions are only enabled in servers
				const energyPoints = profileData.maxEnergy - profileData.energy < 30 ? profileData.maxEnergy - profileData.energy : 30;

				await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						// @ts-ignore, since interactions are only enabled in servers
						p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy += energyPoints;
					},
				);

				await interaction
					.followUp({
						embeds: [{
							color: /** @type {`#${string}`} */ (default_color),
							title: 'Thank you for voting!',
							footer: { text: `+${energyPoints} energy` },
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
				return;
			}

			await interaction
				.followUp({
					content: 'You haven\'t voted on this website in the last 12 hours!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
			return;
		})
		.catch(async () => {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		});
};