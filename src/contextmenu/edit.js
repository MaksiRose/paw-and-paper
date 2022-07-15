// @ts-check

const { Modal, MessageActionRow, TextInputComponent } = require('discord.js');
const { readFileSync } = require('fs');
const profileModel = require('../../models/profileModel');

module.exports.name = 'Edit 📝';
module.exports.data = {
	'name': module.exports.name,
	'type': 3,
	'dm_permission': false,
};

/**
 *
 * @param {import('../paw').client} client
 * @param {import('discord.js').MessageContextMenuInteraction} interaction
 * @returns {Promise<void>}
 */
module.exports.sendCommand = async (client, interaction) => {

	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	const userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: webhookCache?.[interaction.targetId]?.split('_')?.[0] }));

	if (userData === null || userData.userId !== interaction.user.id) {

		await interaction
			.reply({
				content: 'With this command, you can edit a proxied message you sent. The message you selected is not a proxied message sent by you!',
				ephemeral: true,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	await interaction.showModal(new Modal()
		.setCustomId(`edit-${interaction.targetId}`)
		.setTitle('Edit a message')
		.addComponents(
			new MessageActionRow({
				components: [ new TextInputComponent()
					.setCustomId('edit-textinput')
					.setLabel('Text')
					.setStyle('PARAGRAPH')
					.setMinLength(1)
					.setMaxLength(2048)
					.setValue(interaction.targetMessage.content),
				],
			}),
		),
	);
};