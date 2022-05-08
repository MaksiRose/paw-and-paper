// @ts-check
const { MessageActionRow, MessageButton } = require('discord.js');
const serverModel = require('../models/serverModel');
const { createCommandCollector } = require('./commandCollector');
const disableAllComponents = require('./disableAllComponents');
const { pronounAndPlural } = require('./getPronouns');
const { generateRandomNumber } = require('./randomizers');
const { prefix } = require('../config.json');
const { execute } = require('../events/messageCreate');
const { client } = require('../paw');

/**
 * Sends message informing the user that the entrance is blocked off.
 * @param {import('discord.js').Message} message
 * @param {null | string} messageContent
 * @param {import('../typedef').Character} characterData
 * @param {import('../typedef').ServerSchema} serverData
 * @param {'sleeping dens' | 'medicine den' | 'food den'} den
 * @returns {Promise<void>}
 */
async function blockEntrance(message, messageContent, characterData, serverData, den) {

	const possibleBlockages = ['vines', 'burrow', 'tree trunk', 'boulder'];
	const block = serverData.blockedEntrance.blockedKind === null ? possibleBlockages[generateRandomNumber(possibleBlockages.length, 0)] : serverData.blockedEntrance.blockedKind;

	if (serverData.blockedEntrance.den === null) {

		await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			(/** @type {import('../typedef').ServerSchema} */ s) => {
				s.blockedEntrance = { den: den, blockedKind: /** @type {'vines' | 'burrow' | 'tree trunk' | 'boulder'} */ (block) };
			},
		);
	}

	/** @type {null | string} */
	let blockText = null;
	if (block === 'vines') blockText = 'thick vines appear to have grown over';
	if (block === 'burrow') blockText = 'someone seems to have built a big burrow right under';
	if (block === 'tree trunk') blockText = 'a rotten tree trunk has fallen in front of';
	if (block === 'boulder') blockText = 'a boulder has rolled in front of';

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [{
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} is about to enter the ${den}, when ${pronounAndPlural(characterData, 0, 'notice')} that ${blockText} the entrance to the ${den}, making it impossible to enter safely. That will take a lot of strength to dispose of!*`,
				footer: { text: 'Use the button below or type "rp dispose" to dispose of the blockage!' },
			}],
			components: [new MessageActionRow({
				components: [new MessageButton({
					customId: 'dispose',
					label: 'Dispose',
					style: 'PRIMARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);

	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId === 'dispose' && i.user.id === message.author.id;

	botReply
		.awaitMessageComponent({ filter, time: 60_000 })
		.then(async interaction => {

			await /** @type {import('discord.js').Message} */ (interaction.message)
				.delete()
				.catch(async (error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			message.content = `${prefix}dispose`;

			return await execute(client, message);
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

	return;
}
module.exports = blockEntrance;