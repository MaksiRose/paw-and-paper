// @ts-check
const { default_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber } = require('../../utils/randomizers');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { remindOfAttack } = require('../gameplay/attack');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');

module.exports.name = 'drink';

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

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (profileData.thirst >= profileData.maxThirst) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*Water sounds churned in ${profileData.name}'s ear, ${pronoun(profileData, 2)} mouth longing for just one more drink. It seems like ${pronoun(profileData, 0)} can never be as hydrated as ${pronounAndPlural(profileData, 0, 'want')}, but  ${pronoun(profileData, 0)} had plenty of water today.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (profileData.currentRegion !== 'lake') {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'lake' } },
		);
	}

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				description: 'For the next 15 seconds, click the button as many times as you can!',
			}],
			components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'water',
					emoji: '💧',
					style: 'PRIMARY',
				}],
			}],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	return await new Promise((resolve) => {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId === 'water' && i.user.id === message.author.id;

		const collector = message.channel.createMessageComponentCollector({ filter, time: 15000 });
		collector.on('end', async collected => {

			let thirstPoints = generateRandomNumber(3, collected.size);

			if (profileData.thirst + thirstPoints > profileData.maxThirst) {

				thirstPoints -= (profileData.thirst + thirstPoints) - profileData.maxThirst;
			}

			profileData.advice.drinking = true;

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: { thirst: +thirstPoints },
					$set: { advice: profileData.advice },
				},
			));

			await botReply
				.edit({
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${pronoun(profileData, 2)} throat and fills ${pronoun(profileData, 2)} body with new energy.*`,
						footer: { text: `+${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})${(profileData.currentRegion != 'lake') ? '\nYou are now at the lake' : ''}\n\nDon't forget to stay hydrated in real life too!` },
					}],
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return resolve();
		});
	});
};