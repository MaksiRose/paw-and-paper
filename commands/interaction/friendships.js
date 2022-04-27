// @ts-check
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { readFileSync } = require('fs');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const disableAllComponents = require('../../utils/disableAllComponents');
const { getFriendshipPoints, getFriendshipHearts } = require('../../utils/friendshipHandling');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'friendships';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	profileData = await startCooldown(message, profileData);

	/** @type {import('../../typedef').FriendsList} */
	const friendshipList = JSON.parse(readFileSync('./database/friendshipList.json', 'utf-8'));

	/** @type {Array<string>} */
	const friendships = [];

	for (const key of Object.keys(friendshipList)) {

		if (key.includes(profileData.uuid)) {

			let otherProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: key.replace(profileData.uuid, '').replace('_', '') }));
			if (otherProfileData === null) { otherProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await otherProfileModel.findOne({ uuid: key.replace(profileData.uuid, '').replace('_', '') })); }

			if (otherProfileData !== null) {

				const friendshipHearts = getFriendshipHearts(getFriendshipPoints(friendshipList[key][profileData.uuid], friendshipList[key][otherProfileData.uuid]));

				friendships.push(`${otherProfileData.name} (<@${otherProfileData.userId}>) - ${'❤️'.repeat(friendshipHearts) + '🖤'.repeat(10 - friendshipHearts)}`);
			}
		}
	}


	const friendshipPageComponent = new MessageActionRow({
		components: [ new MessageButton({
			customId: 'friendship-left',
			emoji: '⬅️',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'friendship-right',
			emoji: '➡️',
			style: 'SECONDARY',
		})],
	});

	let pageNumber = 0;
	let botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: friendships.length > 0 ? friendships.slice(pageNumber, 25).join('\n') : 'You have not formed any friendships yet :(',
			})],
			components: friendships.length > 25 ? [friendshipPageComponent] : [],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('friendship') && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				if (interaction.customId === 'friendship-left') {

					pageNumber -= 1;

					if (pageNumber < 0) {

						pageNumber = Math.ceil(friendships.length / 25) - 1;
					}

				}

				if (interaction.customId === 'friendship-right') {

					pageNumber += 1;

					if (pageNumber >= Math.ceil(friendships.length / 25)) {

						pageNumber = 0;
					}
				}

				botReply.embeds[0].description = friendships.slice(pageNumber, 25).join('\n');

				botReply = await botReply
					.edit({
						embeds: botReply.embeds,
						components: botReply.components,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				interactionCollector();
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