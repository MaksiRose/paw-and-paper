// @ts-check
const { hasNoName } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');
const profileModel = require('../../models/profileModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkRoleCatchBlock } = require('../../utils/checkRoleRequirements');
const { stopResting } = require('../../utils/executeResting');
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

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

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];

	if (Object.keys(userData.characters).length === 0) {

		await hasNoName(message, characterData);
		return;
	}

	let accountsPage = 0;

	/* Checking if the user has a profile, and if they do, it checks if they have a cooldown, and if they
	do, it returns.
	If they don't have a cooldown, it checks if they are resting, and if they are, it stops their resting.
	Then, it starts a cooldown. */
	if (characterData !== null) {

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

		if (interaction === null) {

			return;
		}

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

		if (interaction.isSelectMenu() && interaction.values[0].includes('switchto')) {

			if (characterData?.profiles?.[message.guild.id]?.isResting === true) {

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].isResting = false;
					},
				));

				stopResting(message.author.id, message.guild.id);
			}

			const name = interaction.values[0].split('-').slice(1, -1).join('-');

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					if (interaction.values[0].endsWith('-0')) { p.currentCharacter[message.guild.id] = name; }
					else {delete p.currentCharacter[message.guild.id];}
				},
			));
			const newCharacterData = userData.characters[userData.currentCharacter[message.guild.id]];

			if (interaction.values[0].endsWith('-0')) {

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

			setTimeout(async () => {

				await interaction
					.followUp({
						content: `You successfully switched to \`${name}\`!`,
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

		accountsMenu.addOptions({ label: character.name, value: `switchto-${character.name}-0` });
	}

	accountsMenu.addOptions({ label: 'Empty Slot', value: 'switchto-Empty Slot-1' });

	if (accountsMenu.options.length > 25) {

		accountsMenu.options = accountsMenu.options.splice(accountsPage * 24, (accountsPage + 1) * 24);
		accountsMenu.addOptions({ label: 'Show more accounts', value: 'accounts_page', description: `You are currently on page ${accountsPage + 1}`, emoji: '📋' });
	}

	return accountsMenu;
}

