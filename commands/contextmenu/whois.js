// @ts-check

const { MessageEmbed } = require('discord.js');
const { readFileSync } = require('fs');
const profileModel = require('../../models/profileModel');
const { sendProfile } = require('../profile/profile');

module.exports.name = 'Who is ❓';
module.exports.data = {
	'name': module.exports.name,
	'type': 3,
};

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').MessageContextMenuInteraction<"cached">} interaction
 * @returns {Promise<void>}
 */
module.exports.sendCommand = async (client, interaction) => {

	let userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: interaction.targetMessage.author.id }));

	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	if (webhookCache[interaction.targetId] !== undefined && webhookCache[interaction.targetId].split('_')[1] !== undefined) {

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: webhookCache[interaction.targetId].split('_')[0] }));
		userData.currentCharacter[interaction.guild.id] = webhookCache[interaction.targetId].split('_')[1];
		interaction.targetMessage.author.id = userData.userId;
	}

	if (userData === null) {

		await interaction
			.reply({
				content: 'The user of the message that you clicked on has no account!',
				ephemeral: true,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guild.id]];

	const member = !interaction.targetMessage.member ? await interaction.guild.members.fetch(interaction.targetMessage.author.id) : interaction.targetMessage.member;

	const embedArray = [new MessageEmbed({
		color: member?.displayColor || interaction.targetMessage.author.accentColor || '#ffffff',
		author: {
			name: member?.displayName || interaction.targetMessage.author?.tag,
			icon_url: member?.displayAvatarURL() || interaction.targetMessage.author?.avatarURL(),
		},
		description: `${interaction.targetMessage.content}\n[jump](${interaction.targetMessage.url})`,
		fields: [
			{
				name: 'Sent by:',
				value: `${interaction.targetMessage.author.toString()} ${member?.nickname ? `/ ${member?.nickname}` : ''}`,
			},
		],
		timestamp: new Date(),
	})];

	await sendProfile(client, interaction.targetMessage, embedArray, userData, characterData, false, true, interaction);
};