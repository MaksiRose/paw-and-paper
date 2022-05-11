// @ts-check
const { hasNoName } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
const profileModel = require('../../models/profileModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { stopResting } = require('../../utils/executeResting');
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');

module.exports.name = 'accounts';
module.exports.aliases = ['switch'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];

	if (Object.keys(userData.characters).length === 0) {

		await hasNoName(message, characterData);
		return;
	}

	let accountsPage = 0;

	/* Checking if the user has a character, and if they do, it starts the cooldown. */
	if (characterData != null) {

		userData = await startCooldown(message);
	}

	let botReply = await message
		.reply({
			content: `Please choose an account that you want to switch to. You are currently on \`${characterData?.name || 'Empty Slot'}\`.`,
			components: [new MessageActionRow({ components: [getAccountsPage(userData, accountsPage)] })],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.isSelectMenu() && i.customId === 'accounts-options' && i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return null; });

		await botReply
			.edit({
				components: disableAllComponents(botReply.components),
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		/* Checking if the user has not clicked on any of the options, and if they haven't, it will return. */
		if (interaction === null) {

			return;
		}

		/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will
		increase the page number by 1, and if the page number is greater than the total number of pages,
		it will set the page number to 0. Then, it will edit the bot reply to show the next page of
		accounts, and then it will call the interactionCollector function again. */
		if (interaction.isSelectMenu() && interaction.values[0] === 'accounts_page') {

			accountsPage++;
			if (accountsPage >= Math.ceil((Object.keys(userData.characters).length + 1) / 24)) {

				accountsPage = 0;
			}

			botReply = await botReply
				.edit({
					components: [new MessageActionRow({ components: [getAccountsPage(userData, accountsPage)] })],
				})
				.catch((error) => { throw new Error(error); });

			await interactionCollector();
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

			/* Checking if the user is resting, and if they are, it will stop the resting. */
			if (characterData?.profiles?.[message.guild.id]?.isResting === true) {

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].isResting = false;
					},
				));

				stopResting(message.author.id, message.guild.id);
			}

			/* Getting the id of the account the user has clicked on, and then it is updating the user's current
			character to the account they have clicked on. */
			const _id = interaction.values[0].split('-').slice(1, -1).join('-');
			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					if (interaction.values[0].endsWith('-0')) { p.currentCharacter[message.guild.id] = _id; }
					else {delete p.currentCharacter[message.guild.id];}
				},
			));

			/* Getting the new character data, and then it is checking if the user has clicked on an account,
			and if they have, it will add the roles of the account to the user. */
			let newCharacterData = userData.characters[userData.currentCharacter[message.guild.id]];
			let profileData = newCharacterData.profiles[message.guild.id];

			if (newCharacterData != null) {

				if (!profileData) {

					userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							p.characters[newCharacterData._id].profiles[message.guild.id] = {
								serverId: message.guild.id,
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
									meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
								},
								roles: [],
							};
						},
					));
					newCharacterData = userData.characters[userData.currentCharacter[message.guild.id]];
					profileData = newCharacterData.profiles[message.guild.id];
				}

				try {

					for (const role of newCharacterData.profiles[message.guild.id].roles) {

						if (message.member.roles.cache.has(role.roleId) === false) {

							message.member.roles.add(role.roleId);
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, message, message.member);
				}
			}

			/* Checking if the user has any roles from the old account, and if they do, it will remove them. */
			try {

				for (const role of characterData?.profiles?.[message.guild.id]?.roles || []) {

					const isInNewRoles = newCharacterData !== null && newCharacterData.profiles[message.guild.id].roles.some(r => r.roleId === role.roleId && r.wayOfEarning === role.wayOfEarning && r.requirement === role.requirement);
					if (isInNewRoles === false && message.member.roles.cache.has(role.roleId)) {

						message.member.roles.remove(role.roleId);
					}
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, message, message.member);
			}

			/* Sending a follow up message to the user saying that they have successfully switched to the
			account they have clicked on. */
			setTimeout(async () => {

				await interaction
					.followUp({
						content: `You successfully switched to \`${newCharacterData?.name || 'Empty Slot'}\`!`,
						ephemeral: true,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}, 500);
		}
	}
};

/**
 * It takes in a profile, a list of inactive profiles, and a page number, and returns a menu with the
 * profile and inactive profiles as options.
 * @param {import('../../typedef').ProfileSchema} userData - The user data.
 * @param {number} accountsPage - The current page of accounts the user is on.
 * @returns {import('discord.js').MessageSelectMenu} A MessageSelectMenu object
 */
function getAccountsPage(userData, accountsPage) {

	const accountsMenu = new MessageSelectMenu({
		customId: 'accounts-options',
		placeholder: 'Select an account',
	});

	for (const character of Object.values(userData.characters)) {

		accountsMenu.addOptions({ label: character.name, value: `switchto-${character._id}-0` });
	}

	accountsMenu.addOptions({ label: 'Empty Slot', value: 'switchto-Empty Slot-1' });

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(accountsPage * 24, (accountsPage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more accounts', value: 'accounts_page', description: `You are currently on page ${accountsPage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}

