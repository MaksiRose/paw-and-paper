const profileModel = require('../models/profileSchema');
const serverModel = require('../models/serverSchema');
const config = require('../config.json');

module.exports = {
	name: 'guildMemberRemove',
	once: false,
	async execute(client, member) {

		const profileData = await profileModel
			.findOne({
				userId: member.id,
				serverId: member.guild.id,
			}).catch((error) => {
				console.error(error);
			});

		const serverData = await serverModel
			.findOne({
				serverId: member.guild.id,
			})
			.catch((error) => {
				console.error(error);
			});

		if (!profileData || !serverData) {

			return;
		}

		await member.createDM();
		const botReply = await member
			.send({
				embeds: [{
					color: config.default_color,
					author: { name: member.guild.name, icon_url: member.guild.iconURL() },
					title: 'You have an undeleted account on a server you left!',
					description: 'Click the button below to delete the account. This will be **permanent**!\nYour account will be deleted automatically in 30 days.',
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: `delete-account-${member.guild.id}`,
						label: 'Delete',
						emoji: { name: '🗑️' },
						style: 'DANGER',
					}],
				}],
			})
			.catch((error) => {
				console.error(error);
			});

		let currentDate = new Date();
		currentDate = currentDate.setDate(currentDate.getDate() + 30);

		if (serverData.accountsToDelete.get(`${member.id}`) == undefined) {

			await serverData.accountsToDelete.set(`${member.id}`, { deletionTimestamp: currentDate, userId: member.id, privateMessageId: botReply.id });
			await serverData.save();
		}

		setTimeout(async () => {

			await profileModel
				.findOneAndDelete({
					userId: member.id,
					serverId: member.guild.id,
				})
				.then((value) => {
					console.log('Deleted User: ' + value);
				})
				.catch((error) => {
					console.error(error);
				});

			await serverData.accountsToDelete.delete(`${member.id}`);
			await serverData.save();

			return await botReply
				.edit({
					embeds: [{
						color: config.default_color,
						author: { name: `${member.guild.name}`, icon_url: member.guild.iconURL() },
						title: 'Your account was deleted permanently!',
						description: '',
					}],
					components: [],
				})
				.catch((error) => {
					console.error(error);
				});
		}, 2592000000);
	},
};