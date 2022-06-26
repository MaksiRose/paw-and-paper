// @ts-check
const { MessageEmbed, MessageSelectMenu, MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { hasName } = require('../../utils/checkAccountCompletion');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { hasCooldown } = require('../../utils/checkValidity');
const disableAllComponents = require('../../utils/disableAllComponents');
const { stopResting } = require('../../utils/executeResting');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap, materialsMap, specialPlantsMap } = require('../../utils/itemsInfo');
const { error_color } = require('../../config.json');
const getUserIds = require('../../utils/getUserIds');

module.exports.name = 'profile';
module.exports.aliases = ['info', 'about', 'profiles', 'character', 'characters', 'account', 'accounts', 'switch'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema | null} userData
 * @param {import('../../typedef').ServerSchema | null} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	let characterData = userData ? userData.characters[userData.currentCharacter[message.guildId || 'DM']] : null;
	let isYourself = true;

	/* Checking if a user was mentioned and if that user has an account. */
	if (getUserIds(message).length > 0) {

		userData = /** @type {import('../../typedef').ProfileSchema | null} */ (await profileModel.findOne({ userId: getUserIds(message)[0] }));
		characterData = userData ? userData.characters[userData.currentCharacter[message.guildId || 'DM']] : null;
		isYourself = false;

		if (!userData) {

			await message
				.reply({
					embeds: [{
						color: /** @type {`#${string}`} */ (error_color),
						title: 'This user has no account!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	}
	/* Checking if the userData is empty. If it is, it will call the hasName function. */
	else if (!userData) {

		hasName(message, characterData);
		return;
	}
	/* Checking if the user has a cooldown. */
	else if (characterData && message.inGuild() && await hasCooldown(message, userData, module.exports.aliases.concat(module.exports.name))) {

		return;
	}

	await module.exports.sendProfile(client, message, embedArray, userData, characterData, isYourself);
};


/**
 * Sends a profile
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').Character | null} characterData
 * @param {boolean} isYourself
 * @param {import('discord.js').MessageContextMenuInteraction<"cached">} [contextMenuInteraction]
 * @returns
 */
module.exports.sendProfile = async (client, message, embedArray, userData, characterData, isYourself, contextMenuInteraction) => {

	let charactersPage = 0;
	let response = await getMessageContent(client, userData.userId, characterData, isYourself, embedArray);
	const selectMenu = getAccountsPage(userData, charactersPage, isYourself);

	let botReply = (!contextMenuInteraction ?
		(await message
			.reply({
				...response,
				failIfNotExists: false,
				components: (selectMenu.options.length > 0) ? [new MessageActionRow({ components: [selectMenu] })] : [],
			})
			.catch((error) => { throw new Error(error); }))
		: (await contextMenuInteraction
			.reply({
				...response,
				components: [ new MessageActionRow({
					components: [ new MessageButton({
						customId: `learnabout-${userData?.userId}-${characterData?._id}`,
						label: 'Learn more (sends a DM)',
						style: 'SUCCESS',
					})],
				})],
				ephemeral: true,
				fetchReply: true,
			})
			.catch((error) => { throw new Error(error); }))
	);

	interactionCollector();

	async function interactionCollector() {

		const interaction = await botReply
			.awaitMessageComponent({
				filter: i => i.user.id === (!contextMenuInteraction ? message.author.id : contextMenuInteraction.user.id),
				time: 86_400_000,
			})
			.catch(() => { return null; });

		if (interaction === null) {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus === 403) { console.error('Missing Access: Cannot edit this message'); }
					else if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (interaction.isButton() && interaction.customId.includes('learnabout')) {

			const dmChannel = await interaction.user
				.createDM()
				.catch((error) => { throw new Error(error); });

			botReply.channelId = dmChannel.id;
			botReply.author.id = interaction.user.id;

			await module.exports.sendProfile(client, botReply, embedArray, userData, characterData, false);

			interactionCollector();
			return;
		}

		/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will
		increase the page number by 1, and if the page number is greater than the total number of pages,
		it will set the page number to 0. Then, it will edit the bot reply to show the next page of
		accounts, and then it will call the interactionCollector function again. */
		if (interaction.isSelectMenu() && interaction.values[0] === 'characters_page') {

			charactersPage++;
			if (charactersPage >= Math.ceil((Object.keys(userData.characters).length + 1) / 24)) {

				charactersPage = 0;
			}

			botReply = await botReply
				.edit({
					components: [new MessageActionRow({ components: [getAccountsPage(userData, charactersPage, isYourself)] })],
				})
				.catch((error) => { throw new Error(error); });

			interactionCollector();
			return;
		}

		/* It checks if the user has clicked on one of the accounts, and if they have, it will check if the
				user is resting, and if they are, it will stop the resting. Then, it will get the name of the
				account the user has clicked on, and it will update the user's current character to the account
				they have clicked on. Then, it will get the new character data, and it will check if the user has
				clicked on an account, and if they have, it will add the roles of the account to the user. Then,
				it will check if the user has any roles from the old account, and if they do, it will remove them.
				Then, it will send a follow up message to the user saying that they have successfully switched to
				the account they have clicked on. */
		if (interaction.isSelectMenu() && interaction.values[0].includes('switchto')) {

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
			characterData = userData.characters[userData.currentCharacter[message.guildId || 'DM']];
			if (characterData?.profiles?.[message.guildId || 'DM'].hasCooldown === true) {

				(async (content) => {
					await interaction
						.reply(content)
						.catch(async () => {
							await interaction.followUp(content);
						});
				})({
					content: 'You can\'t switch characters because your current character is busy!',
					ephemeral: true,
				})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				interactionCollector();
				return;
			}

			/* Checking if the user is resting, and if they are, it will stop the resting. */
			if (message.inGuild() && characterData?.profiles?.[message.guildId]?.isResting === true) {

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].isResting = false;
					},
				));

				stopResting(message.author.id, message.guildId);
			}

			/* Getting the id of the account the user has clicked on, and then it is updating the user's current
					character to the account they have clicked on. */
			const _id = interaction.values[0].split('-').slice(1, -1).join('-');
			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					if (interaction.values[0].endsWith('-0')) { p.currentCharacter[message.guildId || 'DM'] = _id; }
					else { delete p.currentCharacter[message.guildId || 'DM']; }
				},
			));

			/* Getting the new character data, and then it is checking if the user has clicked on an account,
					and if they have, it will add the roles of the account to the user. */
			let newCharacterData = userData ? userData.characters[userData.currentCharacter[message.guildId || 'DM']] : null;
			let profileData = newCharacterData ? newCharacterData?.profiles?.[message.guildId || 'DM'] : null;

			if (message.inGuild()) {

				const member = message.member ? message.member : (await message.guild.members.fetch(message.author.id).catch((error) => { throw new Error(error); }));

				if (newCharacterData) {

					if (!profileData) {

						userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ uuid: userData.uuid },
							(/** @type {import('../../typedef').ProfileSchema} */ p) => {
								// @ts-ignore
								p.characters[newCharacterData._id].profiles[message.guildId] = {
									serverId: message.guildId,
									rank: 'Youngling',
									levels: 1,
									experience: 0,
									health: 100,
									energy: 100,
									hunger: 100,
									thirst: 100,
									maxHealth: 100,
									maxEnergy: 100,
									maxHunger: 100,
									maxThirst: 100,
									temporaryStatIncrease: {},
									isResting: false,
									hasCooldown: false,
									hasQuest: false,
									currentRegion: 'ruins',
									unlockedRanks: 0,
									sapling: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null },
									injuries: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
									inventory: {
										commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
										uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
										rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
										specialPlants: Object.fromEntries([...specialPlantsMap.keys()].sort().map(key => [key, 0])),
										meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
										materials: Object.fromEntries([...materialsMap.keys()].sort().map(key => [key, 0])),
									},
									roles: [],
									skills: { global: {}, personal: {} },
								};
							},
						));
						newCharacterData = userData.characters[userData.currentCharacter[message.guildId]];
						profileData = newCharacterData.profiles[message.guildId];
					}

					try {

						for (const role of newCharacterData.profiles[message.guildId].roles) {

							if (member.roles.cache.has(role.roleId) === false) {

								await member.roles.add(role.roleId);
							}
						}
					}
					catch (error) {

						await checkRoleCatchBlock(error, message, member);
					}
				}

				/* Checking if the user has any roles from the old account, and if they do, it will remove them. */
				try {

					for (const role of characterData?.profiles?.[message.guildId || 'DM']?.roles || []) {

						const isInNewRoles = newCharacterData !== null && newCharacterData?.profiles?.[message.guildId || 'DM']?.roles.some(r => r.roleId === role.roleId && r.wayOfEarning === role.wayOfEarning && r.requirement === role.requirement);
						if (isInNewRoles === false && member.roles.cache.has(role.roleId)) {

							await member.roles.remove(role.roleId);
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, member);
				}
			}

			characterData = newCharacterData;

			/* Sending a follow up message to the user saying that they have successfully switched to the
					account they have clicked on. */
			response = await getMessageContent(client, userData.userId, characterData, isYourself, embedArray);
			const selectMenu = getAccountsPage(userData, charactersPage, isYourself);

			botReply = await botReply
				.edit({
					...response,
					components: (selectMenu.options.length > 0) ? [new MessageActionRow({ components: [selectMenu] })] : [],
				})
				.catch((error) => { throw new Error(error); });

			(async (content) => {
				await interaction
					.reply(content)
					.catch(async () => {
						await interaction.followUp(content);
					});
			})({
				content: `You successfully switched to \`${characterData?.name || 'Empty Slot'}\`!`,
				ephemeral: true,
			})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			interactionCollector();
			return;
		}

		/* The below code is checking if the user has clicked on the view button, and if they have, it will
				edit the message to show the character they have clicked on. */
		if (interaction.isSelectMenu() && interaction.values[0].includes('view')) {

			/* Getting the id of the account the user has clicked on, and then it is updating the user's current
					character to the account they have clicked on. */
			const _id = interaction.values[0].split('-').slice(1, -1).join('-');
			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
			characterData = userData?.characters?.[_id];

			/* Getting the message content and then checking if the accounts page has more than one option. If
					it does, it will add the accounts page to the message. Then editing the message that the bot sent. */
			response = await getMessageContent(client, userData.userId, characterData, isYourself, embedArray);
			const selectMenu = getAccountsPage(userData, charactersPage, isYourself);

			botReply = await botReply
				.edit({
					... /** @type {import('discord.js').MessageEditOptions} */(response),
					components: (selectMenu.options.length > 0) ? [new MessageActionRow({ components: [selectMenu] })] : [],
				})
				.catch((error) => { throw new Error(error); });

			interactionCollector();
			return;
		}

	}
};

/**
 * It takes in a client, userId, characterData, and isYourself, and returns a message object
 * @param {import('../../paw').client} client - Discords Client
 * @param {string} userId - The user's ID
 * @param {import('../../typedef').Character | null} characterData - The character data from the database.
 * @param {boolean} isYourself - Whether the character is by the user who executed the command
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<{content: string | null, embeds: Array<import('discord.js').MessageEmbed>, components: Array<import('discord.js').MessageActionRow>}>} The message object.
 */
async function getMessageContent(client, userId, characterData, isYourself, embedArray) {

	const user = await client.users
		.fetch(userId)
		.catch((error) => {
			throw new Error(error);
		});

	const message = {
		content: !characterData ? (isYourself ? 'You are on an Empty Slot. Select a character to switch to below.' : 'Select a character to view below.') : null,
		embeds: !characterData ? embedArray : [...embedArray, new MessageEmbed({
			color: characterData.color,
			title: characterData.name,
			author: { name: `Profile - ${user.tag}` },
			description: characterData.description,
			thumbnail: { url: characterData.avatarURL },
			fields: [
				{ name: '**🦑 Species**', value: characterData.displayedSpecies ? (characterData.displayedSpecies.charAt(0).toUpperCase() + characterData.displayedSpecies.slice(1)) : characterData.species ? (characterData.species.charAt(0).toUpperCase() + characterData.species.slice(1)) : '/', inline: true },
				{ name: '**🔑 Proxy**', value: !characterData.proxy.startsWith && !characterData.proxy.endsWith ? 'No proxy set' : `${characterData.proxy.startsWith}text${characterData.proxy.endsWith}`, inline: true },
				{ name: '**🍂 Pronouns**', value: characterData.pronounSets.map(pronounSet => `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join('\n') || '/' },

			],
			footer: { text: `Character ID: ${characterData._id}` },
		})],
		components: [],
	};

	return message;
}

/**
 * It takes in a profile, a list of inactive profiles, and a page number, and returns a menu with the
 * profile and inactive profiles as options.
 * @param {import('../../typedef').ProfileSchema} userData - The user data.
 * @param {number} charactersPage - The current page of accounts the user is on.
 * @param {boolean} isYourself - Whether the character is by the user who executed the command
 * @returns {import('discord.js').MessageSelectMenu} A MessageSelectMenu object
 */
function getAccountsPage(userData, charactersPage, isYourself) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'characters-options',
		placeholder: `Select a character ${isYourself ? 'to switch to' : 'to view'}`,
	});

	for (const character of Object.values(userData.characters)) {

		accountsMenu.addOptions({ label: character.name, value: `${isYourself ? 'switchto' : 'view'}-${character._id}-0` });
	}

	if (isYourself) { accountsMenu.addOptions({ label: 'Empty Slot', value: 'switchto-Empty Slot-1' }); }

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(charactersPage * 24, (charactersPage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more characters', value: 'characters_page', description: `You are currently on page ${charactersPage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}

