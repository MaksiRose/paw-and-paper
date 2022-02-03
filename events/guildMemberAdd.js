const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const config = require('../config.json');

module.exports = {
	name: 'guildMemberAdd',
	once: false,
	async execute(client, member) {

		const profileData = await profileModel.findOne({
			userId: member.id,
			serverId: member.guild.id,
		});

		const serverData = await serverModel.findOne({
			serverId: member.guild.id,
		});

		if (!profileData || !serverData || serverData.accountsToDelete.get(`${member.id}`) == undefined) {

			return;
		}

		const accountDeletionValues = serverData.accountsToDelete.get(`${member.id}`);
		const botReply = await member.dmChannel.messages.fetch(accountDeletionValues.privateMessageId);

		await botReply
			.edit({
				embeds: [{
					color: config.default_color,
					author: { name: `${member.guild.name}`, icon_url: member.guild.iconURL() },
					title: 'Your account deletion was canceled!',
					description: '',
				}],
				components: [],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await serverData.accountsToDelete.delete(`${member.id}`);
		await serverData.save();
	},
};