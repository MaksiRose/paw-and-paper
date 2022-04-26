// @ts-check
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { hasCooldown } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { pronoun } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('./attack');
const { checkRankRequirements } = require('../../utils/checkRoleRequirements');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'rank';
module.exports.aliases = ['role'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await hasCooldown(message, profileData, [module.exports.name].concat(module.exports.aliases))) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (profileData.unlockedRanks === 1 && profileData.rank == 'Youngling') {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { rank: 'Apprentice' } },
		);

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*An elderly smiles down at the young ${profileData.rank}.*\n"${profileData.name}, you have proven strength for the first time. I believe you are ready to explore the wild, and learn your strengths and weaknesses. Good luck in your rank as Apprentice" *they say. ${profileData.name}'s breast swells with pride.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await checkRankRequirements(serverData, message, message.member, 'Apprentice');

		return;
	}

	if (profileData.unlockedRanks === 2 && profileData.rank === 'Apprentice') {

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					title: `What rank should ${profileData.name} have?`,
					footer: { text: 'Available options: \n\nHealer (recommended for herbivores)\nHunter (recommended for carnivores)' },
				}], components: [ new MessageActionRow({
					components: [ new MessageButton({
						customId: 'rank-healer',
						label: 'Healer',
						emoji: '🛡️',
						style: 'SUCCESS',
					}), new MessageButton({
						customId: 'rank-hunter',
						label: 'Hunter',
						emoji: '⚔️',
						style: 'SUCCESS',
					})],
				})],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		createCommandCollector(message.author.id, message.guild.id, botReply);
		interactionCollector(botReply);
		return;
	}

	if (profileData.unlockedRanks === 3 && (profileData.rank === 'Hunter' || profileData.rank === 'Healer')) {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { rank: 'Elderly' } },
		);

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `"We are here to celebrate the nomination of ${profileData.name} to the highest rank, Elderly. The ${profileData.species} has shown incredible skills and persistence, and we congratulate ${pronoun(profileData, 1)} to their new title." *A mixture of howls, crows, meows, roars and squeaks are heard all around the hill, on which the Alpha stoof to announce this special event. It is not every day that a packmate gets the title of Elderly.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await checkRankRequirements(serverData, message, message.member, 'Elderly');

		return;
	}

	await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} looks at the Elderly with puppy eyes, trying to convince them.*\n"I'm sorry, little ${profileData.species}, you haven't proven yourself worthy of moving up a rank yet. Try again once you were able to put your strength, agility and decision-making to the test!" *the Elderly says.*`,
				footer: { text: `Go ${profileData.rank === 'Youngling' ? 'playing' : 'exploring'} until you find a quest! Once you have completed the quest, you can move up a rank.` },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;

	async function interactionCollector(botReply) {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.isButton() && (i.customId === 'rank-healer' || i.customId === 'rank-hunter') && i.user.id == message.author.id;

		await botReply
			.awaitMessageComponent({ filter, time: 30_000 })
			.then(async ({ customId }) => {

				if (customId === 'rank-healer') {

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { rank: 'Healer' } },
					);

					await botReply
						.edit({
							embeds: [{
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*${profileData.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${profileData.name}, you are now a fully-fledged Healer. I am certain you will contribute greatly to the pack in this role."\n*The ${profileData.species} grins from ear to ear.*`,
							}],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					await checkRankRequirements(serverData, message, message.member, 'Healer');

					return;
				}

				if (customId === 'rank-hunter') {

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { rank: 'Hunter' } },
					);

					await botReply
						.edit({
							embeds: [{
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*${profileData.name} stands before one of the eldest, excited to hear their following words.* "Congratulations, ${profileData.name}, you are now a fully-fledged Hunter. I am certain you will contribute greatly to the pack in this role."\n*The ${profileData.species} grins from ear to ear.*`,
							}],
							components: disableAllComponents(botReply.components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					await checkRankRequirements(serverData, message, message.member, 'Hunter');

					return;
				}

				return await interactionCollector();
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
	}
};