const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { pronoun } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const serverModel = require('../../models/serverModel');
const { pullFromWeightedTable } = require('../../utils/randomizers');

module.exports = {
	name: 'dispose',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (profileData.rank === 'Youngling' || profileData.rank === 'Healer') {

			const embed = {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A hunter rushes to stop the ${profileData.rank}.*\n"${profileData.name}, you are not trained to dispose things that are blocking the dens, it is very dangerous! I don't ever wanna see you again in here without supervision!"\n*${profileData.name} lowers ${pronoun(profileData, 2)} head and leaves in shame.*`,
			};

			return await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (serverData.blockedEntranceObject.den === null) {

			const embed = {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} patrols around the pack, looking for anything that blocks entrances or might be a hazard. Luckily, it seems like everything is in order as of now.*`,
			};

			return await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let blockText = null;
		if (serverData.blockedEntranceObject.blockedKind === 'vines') blockText = 'thick vines appear to have grown over';
		if (serverData.blockedEntranceObject.blockedKind === 'burrow') blockText = 'someone seems to have built a big burrow right under';
		if (serverData.blockedEntranceObject.blockedKind === 'tree trunk') blockText = 'a rotten tree trunk has fallen in front of';
		if (serverData.blockedEntranceObject.blockedKind === 'boulder') blockText = 'a boulder has rolled in front of';

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} patrols around the pack, looking for anything that blocks entrances or might be a hazard. And indeed, ${blockText} the entrance to the ${serverData.blockedEntranceObject.den}, making it impossible to enter safely. The ${profileData.species} should remove it immediately! But what would be the best way?*`,
		};

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'dispose-bite',
						label: 'Bite through',
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'dispose-soil',
						label: 'Throw soil',
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'dispose-trample',
						label: 'Trample',
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'dispose-push',
						label: 'Push away',
						style: 'SECONDARY',
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		const filter = i => i.user.id === message.author.id;

		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 60000 })
			.catch(() => { return null; });

		if (interaction === null) {

			await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return;
		}

		if ((interaction.customId === 'dispose-bite' && serverData.blockedEntranceObject.blockedKind === 'vines') || (interaction.customId === 'dispose-soil' && serverData.blockedEntranceObject.blockedKind === 'burrow') || (interaction.customId === 'dispose-trample' && serverData.blockedEntranceObject.blockedKind === 'tree trunk') || (interaction.customId === 'dispose-push' && serverData.blockedEntranceObject.blockedKind === 'boulder')) {

			if (profileData.rank === 'Apprentice' && pullFromWeightedTable({ 0: 50, 1: 50 + profileData.saplingObject.waterCycles }) === 0) {

				return await botReply
					.edit({
						content: messageContent,
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*${profileData.name} wasn't strong enough and has to try again!* PLACEHOLDER`,
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { blockedEntranceObject: { den: null, blockedKind: null } } },
			);

			return await botReply
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} is successful!* PLACEHOLDER`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
		else {

			return await botReply
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} is unsuccessful!* PLACEHOLDER`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
	},
};