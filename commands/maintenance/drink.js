// @ts-check
const { default_color } = require('../../config.json');
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber } = require('../../utils/randomizers');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { remindOfAttack } = require('../gameplay/attack');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'drink';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.thirst >= profileData.maxThirst) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*Water sounds churned in ${characterData.name}'s ear, ${pronoun(characterData, 2)} mouth longing for just one more drink. It seems like ${pronoun(characterData, 0)} can never be as hydrated as ${pronounAndPlural(characterData, 0, 'want')}, but  ${pronoun(characterData, 0)} had plenty of water today.*`,
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
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].currentRegion = 'lake';
			},
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
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'water',
					emoji: '💧',
					style: 'PRIMARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	return await new Promise((resolve) => {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId === 'water' && i.user.id === message.author.id;

		const collector = message.channel.createMessageComponentCollector({ filter, time: 15_000 });
		collector.on('end', async collected => {

			let thirstPoints = function(thirst) { return (profileData.thirst + thirst > profileData.maxThirst) ? (profileData.thirst + thirst) - profileData.maxThirst : thirst; }(generateRandomNumber(3, collected.size));

			if (profileData.thirst + thirstPoints > profileData.maxThirst) {

				thirstPoints -= (profileData.thirst + thirstPoints) - profileData.maxThirst;
			}

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst += thirstPoints;
					p.advice.drinking = true;
				},
			));

			await botReply
				.edit({
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*${characterData.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${pronoun(characterData, 2)} throat and fills ${pronoun(characterData, 2)} body with new energy.*`,
						footer: { text: `+${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})${(profileData.currentRegion != 'lake') ? '\nYou are now at the lake' : ''}\n\nDon't forget to stay hydrated in real life too!` },
					}],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return resolve();
		});
	});
};